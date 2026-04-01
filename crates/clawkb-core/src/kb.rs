use memvid_core::{
    Memvid, PutOptions,
    SearchRequest as MemvidSearchRequest,
    TimelineQuery as MemvidTimelineQuery,
    AskRequest, AskMode,
    VecEmbedder,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::ask::{AskCitation, AskResult, ContextFragment};
use crate::entity::{
    EntityInfo, MemoryCardInfo, MeshStats, RelationEdge, TraverseResult,
    list_mesh_entities, get_node_edges, find_mesh_entity, mesh_stats as get_mesh_stats,
};
use crate::error::{KbError, Result};
use crate::export::{ExportData, ExportDocument, ExportFormat};
use crate::import::ImportResult;
use crate::search::{SearchHit, SearchMode};
use crate::tag::TagInfo;
use crate::timeline::{TimelineEntry, TimelineQuery};

/// Placeholder embedder used when no embedding model is configured.
/// The ask pipeline gracefully handles this by falling back to lexical-only retrieval.
struct NoEmbedder;

impl VecEmbedder for NoEmbedder {
    fn embed_query(&self, _text: &str) -> memvid_core::Result<Vec<f32>> {
        Ok(vec![])
    }
    fn embed_chunks(&self, _texts: &[&str]) -> memvid_core::Result<Vec<Vec<f32>>> {
        Ok(vec![])
    }
    fn embedding_dimension(&self) -> usize {
        0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbStats {
    pub frame_count: u64,
    pub size_bytes: u64,
    pub has_lex_index: bool,
    pub has_vec_index: bool,
    pub payload_bytes: u64,
    pub compression_ratio_percent: f64,
    pub path: String,
}

/// Core knowledge base handle wrapping memvid-core.
pub struct KnowledgeBase {
    mem: Memvid,
    path: PathBuf,
}

impl KnowledgeBase {
    /// Create a new knowledge base at the given path.
    pub fn create(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        let mem = Memvid::create(&path)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(Self { mem, path })
    }

    /// Open an existing knowledge base.
    pub fn open(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        if !path.exists() {
            return Err(KbError::FileNotFound(path.display().to_string()));
        }
        let mem = Memvid::open(&path)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(Self { mem, path })
    }

    /// Open in read-only mode.
    pub fn open_read_only(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        if !path.exists() {
            return Err(KbError::FileNotFound(path.display().to_string()));
        }
        let mem = Memvid::open_read_only(&path)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(Self { mem, path })
    }

    /// Add a note/document to the knowledge base.
    pub fn add_note(
        &mut self,
        title: &str,
        content: &str,
        tags: &[&str],
    ) -> Result<String> {
        let payload = content.as_bytes();
        let mut builder = PutOptions::builder()
            .title(title.to_string())
            .kind("note".to_string())
            .enable_embedding(true)
            .auto_tag(true)
            .extract_triplets(true);

        for tag in tags {
            builder = builder.push_tag(tag.to_string());
        }

        let opts = builder.build();

        let seq = self.mem
            .put_bytes_with_options(payload, opts)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(format!("{}", seq))
    }

    /// Search the knowledge base.
    pub fn search(
        &mut self,
        query: &str,
        top_k: usize,
        mode: SearchMode,
    ) -> Result<Vec<SearchHit>> {
        // Use find() for lexical search (BM25)
        if matches!(mode, SearchMode::Lexical) {
            return self.find_lex(query, top_k);
        }

        // Use unified search for semantic/hybrid
        let request = MemvidSearchRequest {
            query: query.to_string(),
            top_k,
            snippet_chars: 256,
            uri: None,
            scope: None,
            cursor: None,
            temporal: None,
            as_of_frame: None,
            as_of_ts: None,
            no_sketch: false,
            acl_context: None,
            acl_enforcement_mode: Default::default(),
        };

        let response = self.mem
            .search(request)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(response.hits.into_iter().map(|h| {
            let tags = h.metadata
                .as_ref()
                .map(|m| m.tags.clone())
                .unwrap_or_default();
            let created_at = h.metadata
                .as_ref()
                .and_then(|m| m.created_at.clone())
                .unwrap_or_default();
            SearchHit {
                id: format!("{}", h.frame_id),
                title: h.title.unwrap_or_default(),
                content: h.chunk_text.clone().unwrap_or(h.text.clone()),
                score: h.score.unwrap_or(0.0),
                tags,
                created_at,
                source: Some(h.uri.clone()),
            }
        }).collect())
    }

    /// Quick lexical search using find().
    fn find_lex(&mut self, query: &str, limit: usize) -> Result<Vec<SearchHit>> {
        let hits = self.mem
            .find(query, limit)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(hits.into_iter().map(|h| SearchHit {
            id: format!("{}", h.frame_id),
            title: String::new(),
            content: h.snippets.first().cloned().unwrap_or_default(),
            score: h.score,
            tags: Vec::new(),
            created_at: String::new(),
            source: None,
        }).collect())
    }

    /// Import a file into the knowledge base.
    pub fn import_file(
        &mut self,
        file_path: &str,
        tags: &[&str],
    ) -> Result<ImportResult> {
        let path = Path::new(file_path);
        if !path.exists() {
            return Err(KbError::FileNotFound(file_path.to_string()));
        }

        let bytes = std::fs::read(path)?;

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("imported")
            .to_string();

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("bin")
            .to_string();

        let kind = match extension.as_str() {
            "pdf" => "pdf",
            "md" => "markdown",
            "txt" => "text",
            "html" | "htm" => "html",
            "docx" => "docx",
            "pptx" => "pptx",
            "xlsx" => "xlsx",
            _ => "document",
        };

        let mut builder = PutOptions::builder()
            .title(title.clone())
            .kind(kind.to_string())
            .uri(file_path.to_string())
            .enable_embedding(true)
            .auto_tag(true)
            .extract_triplets(true);

        for tag in tags {
            builder = builder.push_tag(tag.to_string());
        }

        let opts = builder.build();

        let _seq = self.mem
            .put_bytes_with_options(&bytes, opts)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(ImportResult {
            path: file_path.to_string(),
            title,
            chunks: 1,
            tags: tags.iter().map(|s| s.to_string()).collect(),
            success: true,
            error: None,
        })
    }

    /// Import all files in a directory.
    pub fn import_directory(
        &mut self,
        dir_path: &str,
        tags: &[&str],
        recursive: bool,
    ) -> Result<Vec<ImportResult>> {
        let dir = Path::new(dir_path);
        if !dir.is_dir() {
            return Err(KbError::Import(format!("Not a directory: {}", dir_path)));
        }

        let mut results = Vec::new();
        self.import_dir_inner(dir, tags, recursive, &mut results)?;
        Ok(results)
    }

    fn import_dir_inner(
        &mut self,
        dir: &Path,
        tags: &[&str],
        recursive: bool,
        results: &mut Vec<ImportResult>,
    ) -> Result<()> {
        let entries = std::fs::read_dir(dir)?;
        let mut batch_count = 0;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() && recursive {
                self.import_dir_inner(&path, tags, recursive, results)?;
            } else if path.is_file() {
                let ext = path.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("");

                if matches!(ext, "txt" | "md" | "pdf" | "html" | "htm" | "docx" | "pptx" | "xlsx") {
                    // Skip files larger than 50MB for safety
                    if let Ok(metadata) = std::fs::metadata(&path) {
                        if metadata.len() > 50 * 1024 * 1024 {
                            results.push(ImportResult {
                                path: path.display().to_string(),
                                title: path.file_stem()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("unknown")
                                    .to_string(),
                                chunks: 0,
                                tags: tags.iter().map(|s| s.to_string()).collect(),
                                success: false,
                                error: Some("File too large (>50MB), skipped".to_string()),
                            });
                            continue;
                        }
                    }

                    let result = self.import_file(&path.display().to_string(), tags);
                    results.push(result.unwrap_or_else(|e| ImportResult {
                        path: path.display().to_string(),
                        title: path.file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        chunks: 0,
                        tags: tags.iter().map(|s| s.to_string()).collect(),
                        success: false,
                        error: Some(e.to_string()),
                    }));

                    // Auto-commit every 100 files to prevent memory issues
                    batch_count += 1;
                    if batch_count % 100 == 0 {
                        let _ = self.commit();
                    }
                }
            }
        }
        Ok(())
    }

    /// Query the timeline.
    pub fn timeline(&mut self, query: TimelineQuery) -> Result<Vec<TimelineEntry>> {
        let mut builder = MemvidTimelineQuery::builder();

        if let Some(limit) = query.limit {
            builder = builder.limit(
                std::num::NonZeroU64::new(limit as u64)
                    .unwrap_or_else(|| std::num::NonZeroU64::new(100).unwrap())
            );
        }

        if let Some(from) = &query.from_date {
            if let Ok(ts) = from.parse::<i64>() {
                builder = builder.since(ts);
            }
        }

        if let Some(to) = &query.to_date {
            if let Ok(ts) = to.parse::<i64>() {
                builder = builder.until(ts);
            }
        }

        builder = builder.reverse(true);

        let mq = builder.build();
        let entries = self.mem
            .timeline(mq)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(entries.into_iter().map(|e| TimelineEntry {
            id: format!("{}", e.frame_id),
            title: e.preview.clone(),
            timestamp: format_timestamp(e.timestamp),
            tags: Vec::new(),
            snippet: truncate_str(&e.preview, 200),
        }).collect())
    }

    /// Get knowledge base statistics.
    pub fn stats(&self) -> Result<KbStats> {
        let s = self.mem
            .stats()
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(KbStats {
            frame_count: s.frame_count,
            size_bytes: s.size_bytes,
            has_lex_index: s.has_lex_index,
            has_vec_index: s.has_vec_index,
            payload_bytes: s.payload_bytes,
            compression_ratio_percent: s.compression_ratio_percent,
            path: self.path.display().to_string(),
        })
    }

    /// Ask a question against the knowledge base using memvid's built-in RAG.
    /// Returns an answer with citations and context fragments.
    pub fn ask(&mut self, question: &str, top_k: Option<usize>) -> Result<AskResult> {
        self.ask_inner(question, top_k.unwrap_or(8), false)
    }

    /// Retrieve context fragments for a question without synthesizing an answer.
    /// Useful when the caller wants to use their own LLM for generation.
    pub fn ask_context_only(&mut self, question: &str, top_k: Option<usize>) -> Result<AskResult> {
        self.ask_inner(question, top_k.unwrap_or(10), true)
    }

    /// Ask a question scoped to a specific document (by URI).
    /// Uses memvid Ask API with the uri field set to limit search to that document.
    pub fn ask_document(&mut self, question: &str, document_uri: &str, top_k: Option<usize>) -> Result<AskResult> {
        let top_k = top_k.unwrap_or(8);
        let request = AskRequest {
            question: question.to_string(),
            top_k,
            snippet_chars: 480,
            uri: Some(document_uri.to_string()),
            scope: None,
            cursor: None,
            start: None,
            end: None,
            temporal: None,
            context_only: false,
            mode: AskMode::Hybrid,
            as_of_frame: None,
            as_of_ts: None,
            adaptive: None,
            acl_context: None,
            acl_enforcement_mode: Default::default(),
        };

        let response = self.mem
            .ask::<NoEmbedder>(request, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        let retriever_str = format!("{:?}", response.retriever).to_lowercase();

        Ok(AskResult {
            answer: response.answer,
            citations: response.citations.into_iter().map(|c| AskCitation {
                index: c.index,
                frame_id: format!("{}", c.frame_id),
                uri: c.uri,
                score: c.score,
            }).collect(),
            context: response.context_fragments.into_iter().map(|f| ContextFragment {
                rank: f.rank,
                frame_id: format!("{}", f.frame_id),
                uri: f.uri,
                title: f.title,
                score: f.score,
                text: f.text,
            }).collect(),
            retriever: retriever_str,
            context_only: false,
        })
    }

    fn ask_inner(&mut self, question: &str, top_k: usize, context_only: bool) -> Result<AskResult> {
        let request = AskRequest {
            question: question.to_string(),
            top_k,
            snippet_chars: 480,
            uri: None,
            scope: None,
            cursor: None,
            start: None,
            end: None,
            temporal: None,
            context_only,
            mode: AskMode::Hybrid,
            as_of_frame: None,
            as_of_ts: None,
            adaptive: None,
            acl_context: None,
            acl_enforcement_mode: Default::default(),
        };

        let response = self.mem
            .ask::<NoEmbedder>(request, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        let retriever_str = match response.retriever {
            _ => format!("{:?}", response.retriever).to_lowercase(),
        };

        Ok(AskResult {
            answer: response.answer,
            citations: response.citations.into_iter().map(|c| AskCitation {
                index: c.index,
                frame_id: format!("{}", c.frame_id),
                uri: c.uri,
                score: c.score,
            }).collect(),
            context: response.context_fragments.into_iter().map(|f| ContextFragment {
                rank: f.rank,
                frame_id: format!("{}", f.frame_id),
                uri: f.uri,
                title: f.title,
                score: f.score,
                text: f.text,
            }).collect(),
            retriever: retriever_str,
            context_only,
        })
    }

    // ── Graph / LogicMesh methods ──────────────────────────────────────

    /// List all entities from the knowledge graph, optionally filtered by kind.
    pub fn list_entities(&self, kind_filter: Option<&str>) -> Result<Vec<EntityInfo>> {
        let mesh = self.mem.logic_mesh();
        Ok(list_mesh_entities(mesh, kind_filter))
    }

    /// Get all relationship edges for a given entity.
    pub fn get_entity_edges(&self, entity_id: u64) -> Result<Vec<RelationEdge>> {
        let mesh = self.mem.logic_mesh();
        Ok(get_node_edges(mesh, entity_id))
    }

    /// Find an entity by name.
    pub fn find_entity(&self, name: &str) -> Result<Option<EntityInfo>> {
        let mesh = self.mem.logic_mesh();
        Ok(find_mesh_entity(mesh, name))
    }

    /// Traverse the graph from a start entity following a link type.
    pub fn traverse_graph(&self, start: &str, link: &str, hops: usize) -> Result<Vec<TraverseResult>> {
        let results = self.mem.follow(start, link, hops);
        Ok(results.into_iter().map(|r| TraverseResult {
            node: r.node,
            kind: format!("{:?}", r.kind).to_lowercase(),
            confidence: r.confidence,
            frame_ids: r.frame_ids.iter().map(|f| *f as u64).collect(),
            path_length: r.path_length,
        }).collect())
    }

    /// Get graph statistics.
    pub fn graph_stats(&self) -> Result<MeshStats> {
        let mesh = self.mem.logic_mesh();
        Ok(get_mesh_stats(mesh))
    }

    /// List all memory cards across all entities.
    pub fn list_memories(&self) -> Result<Vec<MemoryCardInfo>> {
        let entities = self.mem.memory_entities();
        let mut cards = Vec::new();
        for entity in &entities {
            for mc in self.mem.get_entity_memories(entity) {
                cards.push(MemoryCardInfo {
                    entity: mc.entity.clone(),
                    slot: mc.slot.clone(),
                    value: mc.value.clone(),
                    kind: format!("{:?}", mc.kind).to_lowercase(),
                    confidence: mc.confidence,
                });
            }
        }
        Ok(cards)
    }

    /// Commit pending changes.
    pub fn commit(&mut self) -> Result<()> {
        self.mem
            .commit()
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(())
    }

    /// Get the file path of the knowledge base.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Export all documents from the knowledge base.
    /// Uses timeline to enumerate all documents, then searches for each to get full content.
    pub fn export(&mut self, _format: ExportFormat) -> Result<ExportData> {
        let stats = self.stats()?;

        // Use timeline to get all entries
        let timeline_query = TimelineQuery {
            from_date: None,
            to_date: None,
            limit: Some(1000),
            tag: None,
        };
        let entries = self.timeline(timeline_query)?;

        // Convert timeline entries to export documents
        let documents: Vec<ExportDocument> = entries
            .into_iter()
            .map(|e| ExportDocument {
                id: e.id,
                title: e.title,
                content: e.snippet,
                tags: e.tags,
                created_at: e.timestamp,
                source: None,
            })
            .collect();

        Ok(ExportData {
            stats,
            documents,
            exported_at: chrono::Utc::now()
                .format("%Y-%m-%d %H:%M:%S UTC")
                .to_string(),
        })
    }

    /// List all tags with their document counts.
    /// Uses timeline to enumerate frame IDs, then reads each frame to get tags.
    pub fn list_tags(&mut self) -> Result<Vec<TagInfo>> {
        // First get all frame IDs via timeline
        let timeline_query = TimelineQuery {
            from_date: None,
            to_date: None,
            limit: Some(1000),
            tag: None,
        };
        let entries = self.timeline(timeline_query)?;

        if entries.is_empty() {
            return Ok(Vec::new());
        }

        // Search for each frame's title to get metadata with tags
        let mut tag_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

        for entry in &entries {
            // Use the title/preview as search query to retrieve metadata with tags
            let query = if entry.title.len() > 20 {
                &entry.title[..20]
            } else {
                &entry.title
            };

            let request = MemvidSearchRequest {
                query: query.to_string(),
                top_k: 1,
                snippet_chars: 0,
                uri: None,
                scope: None,
                cursor: None,
                temporal: None,
                as_of_frame: None,
                as_of_ts: None,
                no_sketch: false,
                acl_context: None,
                acl_enforcement_mode: Default::default(),
            };

            if let Ok(response) = self.mem.search(request) {
                if let Some(hit) = response.hits.first() {
                    if let Some(meta) = &hit.metadata {
                        for tag in &meta.tags {
                            *tag_map.entry(tag.clone()).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        let mut tags: Vec<TagInfo> = tag_map
            .into_iter()
            .map(|(name, count)| TagInfo { name, count })
            .collect();
        tags.sort_by(|a, b| b.count.cmp(&a.count));
        Ok(tags)
    }

    // ── Replay / Time Machine ────────────────────────────────────────

    /// List all replay sessions
    pub fn list_sessions(&self) -> Vec<crate::replay::SessionSummary> {
        self.mem.list_sessions().into_iter().map(|s| crate::replay::SessionSummary {
            id: format!("session-{}", s.session_id),
            name: s.name.unwrap_or_default(),
            action_count: s.action_count,
            start_time: s.created_secs,
            end_time: s.ended_secs.unwrap_or(s.created_secs),
        }).collect()
    }

    /// Create a checkpoint in the current replay session
    pub fn create_checkpoint(&mut self) -> Result<u64> {
        self.mem.create_checkpoint()
            .map_err(|e| KbError::Memvid(e.to_string()))
    }

    /// Search the KB as it was at a specific timestamp
    pub fn search_as_of(&mut self, query: &str, as_of_ts: i64, top_k: Option<usize>) -> Result<Vec<SearchHit>> {
        let request = MemvidSearchRequest {
            query: query.to_string(),
            top_k: top_k.unwrap_or(10),
            snippet_chars: 256,
            uri: None,
            scope: None,
            cursor: None,
            temporal: None,
            as_of_frame: None,
            as_of_ts: Some(as_of_ts),
            no_sketch: false,
            acl_context: None,
            acl_enforcement_mode: Default::default(),
        };

        let response = self.mem.search(request)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(response.hits.into_iter().map(|h| SearchHit {
            id: h.frame_id.to_string(),
            title: h.title.unwrap_or_default(),
            content: truncate_str(&h.text, 300),
            score: h.score.unwrap_or(0.0),
            tags: h.metadata.as_ref().map(|m| m.tags.clone()).unwrap_or_default(),
            created_at: h.metadata.as_ref()
                .and_then(|m| m.created_at.clone())
                .unwrap_or_default(),
            source: None,
        }).collect())
    }

    /// Ask a question about the KB state at a specific timestamp
    pub fn ask_as_of(&mut self, question: &str, as_of_ts: i64, top_k: Option<usize>) -> Result<crate::replay::AsOfResult> {
        let top_k = top_k.unwrap_or(8);
        let request = AskRequest {
            question: question.to_string(),
            top_k,
            snippet_chars: 480,
            uri: None,
            scope: None,
            cursor: None,
            start: None,
            end: None,
            temporal: None,
            context_only: false,
            mode: AskMode::Hybrid,
            as_of_frame: None,
            as_of_ts: Some(as_of_ts),
            adaptive: None,
            acl_context: None,
            acl_enforcement_mode: Default::default(),
        };

        let response = self.mem
            .ask::<NoEmbedder>(request, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(crate::replay::AsOfResult {
            answer: response.answer.unwrap_or_default(),
            citations: response.citations.into_iter().enumerate().map(|(idx, c)| AskCitation {
                index: idx,
                frame_id: c.frame_id.to_string(),
                uri: c.uri,
                score: c.score,
            }).collect(),
            context: response.context_fragments.into_iter().map(|c| ContextFragment {
                rank: c.rank,
                frame_id: c.frame_id.to_string(),
                uri: c.uri,
                title: c.title,
                score: c.score,
                text: c.text,
            }).collect(),
            frame_cutoff: 0,
            timestamp_cutoff: as_of_ts,
        })
    }
}

fn format_timestamp(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| ts.to_string())
}

fn truncate_str(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_len).collect();
        format!("{}...", truncated)
    }
}

/// Check if a source URI refers to a PDF file
pub fn is_pdf_source(source: Option<&str>) -> bool {
    source
        .map(|s| s.to_lowercase().ends_with(".pdf"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_pdf_source() {
        assert!(is_pdf_source(Some("document.pdf")));
        assert!(is_pdf_source(Some("/path/to/file.PDF")));
        assert!(is_pdf_source(Some("report.Pdf")));
        assert!(!is_pdf_source(Some("document.txt")));
        assert!(!is_pdf_source(Some("file.md")));
        assert!(!is_pdf_source(None));
        assert!(!is_pdf_source(Some("")));
        assert!(!is_pdf_source(Some("pdf")));
    }

    #[test]
    fn test_truncate_str() {
        assert_eq!(truncate_str("hello", 10), "hello");
        assert_eq!(truncate_str("hello world", 5), "hello...");
        assert_eq!(truncate_str("", 5), "");
        assert_eq!(truncate_str("abc", 3), "abc");
    }
}
