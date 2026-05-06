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
use crate::classify::classify_document;
use crate::entity::{
    EntityInfo, MemoryCardInfo, MeshStats, RelationEdge, TraverseResult,
    list_mesh_entities, get_node_edges, find_mesh_entity, mesh_stats as get_mesh_stats,
};
use crate::error::{KbError, Result};
use crate::export::{ExportData, ExportDocument, ExportFormat};
use crate::folder::{
    extract_tag_value, has_tag, FolderInfo, FOLDER_CREATED_PREFIX, FOLDER_DELETED_TAG,
    FOLDER_ID_PREFIX, FOLDER_META_TAG, FOLDER_NAME_PREFIX, FOLDER_PARENT_PREFIX, FOLDER_PATH_PREFIX,
};
use crate::import::ImportResult;
use crate::note::{NotePath, NoteRecord, NOTE_ID_PREFIX, NOTE_META_TAG, NOTE_PATH_PREFIX};
use crate::parsers::{self, DocumentFormat};
use crate::replay::{CompareHit, CompareResult};
use crate::search::{SearchHit, SearchMode};
use crate::tag::TagInfo;
use crate::timeline::{TimelineEntry, TimelineQuery};
use std::collections::HashMap;

/// Result of a tag operation (rename/merge/delete).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagOperationResult {
    pub updated: usize,
    pub tag: String,
    pub related_tag: Option<String>,
}

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

// ---------------------------------------------------------------------------
// KB Registry — persistent metadata index
// ---------------------------------------------------------------------------

const KB_REGISTRY_TAG: &str = "__kb_registry__";
const KB_REGISTRY_VERSION: u32 = 1;

/// Persistent metadata index stored as a special frame inside the MV2 file.
/// Avoids O(N) full-frame scans on every `open()`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KbRegistry {
    pub version: u32,
    /// path → (note_id, meta_frame_id, content_frame_id, updated_at)
    pub note_index: HashMap<String, NoteIndexEntry>,
    /// folder_id → entry
    pub folder_index: HashMap<String, FolderIndexEntry>,
    /// tag_name → count
    pub tag_index: HashMap<String, usize>,
    pub created_at: i64,
    pub last_modified: i64,
    /// The frame ID of the registry frame itself (None = not yet persisted).
    pub registry_frame_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteIndexEntry {
    pub note_id: String,
    pub meta_frame_id: u64,
    pub content_frame_id: Option<u64>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderIndexEntry {
    pub folder_id: String,
    pub frame_id: u64,
    pub name: String,
    pub parent_id: Option<String>,
    pub path: String,
    pub doc_count: usize,
    pub created_at: i64,
}

impl Default for KbRegistry {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            version: KB_REGISTRY_VERSION,
            note_index: HashMap::new(),
            folder_index: HashMap::new(),
            tag_index: HashMap::new(),
            created_at: now,
            last_modified: now,
            registry_frame_id: None,
        }
    }
}

// ---------------------------------------------------------------------------
// KnowledgeBase
// ---------------------------------------------------------------------------

/// Core knowledge base handle wrapping memvid-core.
pub struct KnowledgeBase {
    mem: Memvid,
    path: PathBuf,
    note_path_registry: std::collections::HashMap<String, String>,
    registry: Option<KbRegistry>,
}

impl KnowledgeBase {
    /// Create a new knowledge base at the given path.
    pub fn create(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        let mem = Memvid::create(&path)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(Self { mem, path, note_path_registry: std::collections::HashMap::new(), registry: None })
    }

    /// Open an existing knowledge base.
    pub fn open(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        if !path.exists() {
            return Err(KbError::FileNotFound(path.display().to_string()));
        }
        let mem = Memvid::open(&path)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        let mut kb = Self { mem, path, note_path_registry: std::collections::HashMap::new(), registry: None };
        let _ = kb.load_or_build_registry();
        Ok(kb)
    }

    /// Open in read-only mode.
    pub fn open_read_only(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        if !path.exists() {
            return Err(KbError::FileNotFound(path.display().to_string()));
        }
        let mem = Memvid::open_read_only(&path)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        let mut kb = Self { mem, path, note_path_registry: std::collections::HashMap::new(), registry: None };
        let _ = kb.load_or_build_registry();
        Ok(kb)
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

    /// Create a structured note record and persist a metadata frame for note-domain APIs.
    pub fn create_note_record(&mut self, mut note: NoteRecord) -> Result<NoteRecord> {
        let path = note.path.as_str().to_string();
        if self.note_path_registry.contains_key(&path)
            || self.find_note_meta_by_path(&path)?.is_some()
            || self.search_in_note_meta_payload(&path)?.is_some() {
            return Err(KbError::Conflict(format!("note path already exists: {path}")));
        }

        let tags: Vec<String> = note.frontmatter.tags.clone();
        let tag_refs: Vec<&str> = tags.iter().map(String::as_str).collect();
        let content_frame_id_str = self.add_note(&note.title, &note.content, &tag_refs)?;
        let content_frame_id: u64 = content_frame_id_str.parse().unwrap_or(0);
        let now = format_timestamp(chrono::Utc::now().timestamp());
        let note_id = format!("note:{}", uuid::Uuid::new_v4());

        note.id = note_id.clone();
        note.created_at = now.clone();
        note.updated_at = now;

        let meta_payload = serde_json::to_string(&note)?;
        let note_id_tag = format!("{NOTE_ID_PREFIX}{note_id}");
        let note_path_tag = format!("{NOTE_PATH_PREFIX}{path}");
        let meta_tags = vec![NOTE_META_TAG, note_id_tag.as_str(), note_path_tag.as_str(), "note-meta"];
        let meta_frame_id_str = self.add_note(&note.title, &meta_payload, &meta_tags)?;
        let meta_frame_id: u64 = meta_frame_id_str.parse().unwrap_or(0);

        // keep source pointer to the content frame for later migrations
        note.source = Some(content_frame_id_str.clone());
        self.sync_registry_note(&path, &note_id, meta_frame_id, Some(content_frame_id));
        Ok(note)
    }

    /// Get a structured note record by stable note id.
    pub fn get_note_record(&mut self, id: &str) -> Result<NoteRecord> {
        let (_, frame) = self.find_note_meta_by_id(id)?
            .ok_or_else(|| KbError::Config(format!("note not found: {id}")))?;
        self.note_record_from_meta_frame(frame)
    }

    /// Rename a note record without changing its stable id.
    pub fn rename_note_record(&mut self, id: &str, new_title: &str, new_path: NotePath) -> Result<NoteRecord> {
        if let Some((other_id, _)) = self.find_note_meta_by_path(new_path.as_str())? {
            if other_id != id {
                return Err(KbError::Conflict(format!("note path already exists: {}", new_path.as_str())));
            }
        }

        let existing_registry_path = self.note_path_registry.iter()
            .find_map(|(path, note_id)| if note_id == id { Some(path.clone()) } else { None });
        let (meta_frame_id, frame) = self.find_note_meta_by_id(id)?
            .ok_or_else(|| KbError::Config(format!("note not found: {id}")))?;
        let mut note = self.note_record_from_meta_frame(frame)?;
        note.title = new_title.to_string();
        note.path = new_path;
        note.updated_at = format_timestamp(chrono::Utc::now().timestamp());

        let payload = serde_json::to_vec(&note)?;
        let opts = PutOptions {
            title: Some(note.title.clone()),
            tags: vec![NOTE_META_TAG.to_string(), format!("{NOTE_ID_PREFIX}{}", note.id), format!("{NOTE_PATH_PREFIX}{}", note.path.as_str()), "note-meta".to_string()],
            ..Default::default()
        };
        self.mem.update_frame(meta_frame_id, Some(payload), opts, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        if let Some(old_path) = existing_registry_path {
            self.note_path_registry.remove(&old_path);
            self.sync_registry_remove_note(&old_path);
        }
        self.sync_registry_note(note.path.as_str(), &note.id, meta_frame_id, None);

        Ok(note)
    }

    /// List all note records, optionally filtered by tag.
    pub fn list_note_records(&mut self, tag_filter: Option<&str>, limit: usize) -> Result<Vec<NoteRecord>> {
        let frame_ids = self.collect_all_frame_ids()?;
        let mut notes = Vec::new();
        for frame_id in frame_ids.into_iter().rev() {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };
            if !frame.tags.contains(&NOTE_META_TAG.to_string()) {
                continue;
            }
            if let Some(filter) = tag_filter {
                if !frame.tags.iter().any(|t| t == filter) {
                    continue;
                }
            }
            match self.note_record_from_meta_frame(frame) {
                Ok(note) => {
                    notes.push(note);
                    if notes.len() >= limit {
                        break;
                    }
                }
                Err(_) => continue,
            }
        }
        Ok(notes)
    }

    /// Delete a note record by its stable note id.
    pub fn delete_note_record(&mut self, id: &str) -> Result<()> {
        let (meta_frame_id, _frame) = self.find_note_meta_by_id(id)?
            .ok_or_else(|| KbError::Config(format!("note not found: {id}")))?;

        // Find and delete the content frame too.
        let all_ids = self.collect_all_frame_ids()?;
        for fid in all_ids {
            let frame = match self.mem.frame_by_id(fid) {
                Ok(f) => f,
                Err(_) => continue,
            };
            if frame.tags.contains(&format!("{NOTE_ID_PREFIX}{id}")) && !frame.tags.contains(&NOTE_META_TAG.to_string()) {
                let _ = self.mem.delete_frame(fid);
            }
        }

        let _ = self.mem.delete_frame(meta_frame_id);

        if let Some(path) = self.note_path_registry.iter()
            .find_map(|(p, nid)| if nid == id { Some(p.clone()) } else { None })
        {
            self.note_path_registry.remove(&path);
            self.sync_registry_remove_note(&path);
        }

        Ok(())
    }

    /// Update the content and tags of an existing note record.
    pub fn update_note_record(
        &mut self,
        id: &str,
        title: Option<&str>,
        content: Option<&str>,
        tags: Option<Vec<&str>>,
    ) -> Result<NoteRecord> {
        let (meta_frame_id, frame) = self.find_note_meta_by_id(id)?
            .ok_or_else(|| KbError::Config(format!("note not found: {id}")))?;
        let mut note = self.note_record_from_meta_frame(frame)?;

        if let Some(t) = title {
            note.title = t.to_string();
        }
        if let Some(c) = content {
            note.content = c.to_string();
        }
        if let Some(t) = tags {
            note.frontmatter.tags = t.into_iter().map(|s| s.to_string()).collect();
        }
        note.updated_at = format_timestamp(chrono::Utc::now().timestamp());

        let payload = serde_json::to_vec(&note)?;
        let mut note_tags = vec![
            NOTE_META_TAG.to_string(),
            format!("{NOTE_ID_PREFIX}{}", note.id),
            format!("{NOTE_PATH_PREFIX}{}", note.path.as_str()),
            "note-meta".to_string(),
        ];
        note_tags.extend(note.frontmatter.tags.clone());
        let opts = PutOptions {
            title: Some(note.title.clone()),
            tags: note_tags,
            ..Default::default()
        };
        self.mem.update_frame(meta_frame_id, Some(payload), opts, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(note)
    }

    /// Resolve a note link by title or partial title.
    /// Returns notes matching the query, useful for [[wiki-link]] autocomplete.
    pub fn resolve_note_link(&mut self, query: &str, limit: usize) -> Result<Vec<SearchHit>> {
        let all_notes = self.list_note_records(None, 200)?;
        let query_lower = query.to_lowercase();
        let matches: Vec<SearchHit> = all_notes
            .into_iter()
            .filter(|note| {
                note.title.to_lowercase().contains(&query_lower)
                    || note.frontmatter.aliases.iter().any(|a| a.to_lowercase().contains(&query_lower))
                    || note.path.as_str().to_lowercase().contains(&query_lower)
            })
            .take(limit)
            .map(|note| SearchHit {
                id: note.id.clone(),
                title: note.title.clone(),
                content: note.content.chars().take(200).collect(),
                score: 1.0,
                tags: note.frontmatter.tags.clone(),
                created_at: note.created_at.clone(),
                source: note.source.clone(),
            })
            .collect();
        Ok(matches)
    }

    /// Backlink entry: note that references the target note.
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct BacklinkEntry {
        pub note_id: String,
        pub note_title: String,
        pub context_snippet: String,
    }

    /// List all notes that reference the given note by its ID.
    /// Scans content for [[title]] patterns and tag references.
    pub fn list_backlinks(&mut self, note_id: &str) -> Result<Vec<BacklinkEntry>> {
        let target = self.get_note_record(note_id)?;
        let target_title = &target.title;
        let target_title_lower = target_title.to_lowercase();

        let all_notes = self.list_note_records(None, 500)?;
        let mut backlinks = Vec::new();

        for note in all_notes {
            if note.id == note_id {
                continue;
            }

            // Check [[title]] pattern in content
            let wiki_patterns = [
                format!("[[{}]]", target_title),
                format!("[[{target_title_lower}]]"),
            ];
            let has_wiki_ref = wiki_patterns.iter().any(|p| note.content.contains(p));

            // Also check if content mentions the title (broader match)
            let has_title_ref = note.content.to_lowercase().contains(&target_title_lower);

            if has_wiki_ref || has_title_ref {
                let snippet = extract_snippet_around(&note.content, target_title, 80);
                backlinks.push(BacklinkEntry {
                    note_id: note.id,
                    note_title: note.title,
                    context_snippet: snippet,
                });
            }
        }

        Ok(backlinks)
    }

    /// Extract [[wiki-link]] targets from note content.
    /// Returns unique link titles found in the content.
    pub fn extract_outlinks(content: &str) -> Vec<String> {
        let mut links = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let bytes = content.as_bytes();
        let mut i = 0;
        while i + 1 < bytes.len() {
            if bytes[i] == b'[' && bytes[i + 1] == b'[' {
                let start = i + 2;
                let mut end = start;
                while end < bytes.len() && (bytes[end] != b']' || end + 1 >= bytes.len() || bytes[end + 1] != b']') {
                    end += 1;
                }
                if end > start && end + 1 < bytes.len() {
                    let title = &content[start..end];
                    if !title.is_empty() && !seen.contains(title) {
                        seen.insert(title.to_string());
                        links.push(title.to_string());
                    }
                }
                i = end + 2;
            } else {
                i += 1;
            }
        }
        links
    }

    /// Extract document outline (headings) from note content.
    /// Matches # ## ### etc. at line start.
    pub fn extract_outline(content: &str) -> Vec<crate::note::OutlineNode> {
        use crate::note::OutlineNode;
        let mut nodes = Vec::new();
        for (line_num, line) in content.lines().enumerate() {
            let trimmed = line.trim_start();
            if trimmed.starts_with('#') {
                let mut level: u8 = 0;
                let mut pos = 0;
                for ch in trimmed.chars() {
                    if ch == '#' { level += 1; pos += 1; }
                    else { break; }
                }
                if level > 0 && level <= 6 {
                    let text = trimmed[pos..].trim().to_string();
                    if !text.is_empty() {
                        // Estimate byte position of this line in the content.
                        let position: usize = content.lines()
                            .take(line_num)
                            .map(|l| l.len() + 1)
                            .sum();
                        nodes.push(OutlineNode { level, text, position });
                    }
                }
            }
        }
        nodes
    }

    /// Sync outlinks and backlinks for a note after its content changes.
    /// Reads the content, extracts [[links]], resolves to note IDs, and
    /// updates the note's meta frame + updates backlinks in linked notes.
    pub fn sync_note_links(&mut self, note_id: &str) -> Result<()> {
        let (meta_frame_id, frame) = self.find_note_meta_by_id(note_id)?
            .ok_or_else(|| KbError::Config(format!("note not found: {note_id}")))?;
        let mut note = self.note_record_from_meta_frame(frame)?;

        let linked_titles = Self::extract_outlinks(&note.content);
        let mut new_outlinks: Vec<String> = Vec::new();

        // Resolve each [[title]] to a note_id.
        for title in linked_titles {
            // Try exact title match.
            let resolved = self.resolve_note_link(&title, 1)?;
            if let Some(hit) = resolved.first() {
                new_outlinks.push(hit.id.clone());
            }
        }

        // Get old outlinks to compute diff.
        let old_outlinks: std::collections::HashSet<String> =
            note.outlinks.iter().cloned().collect();

        let new_outlinks_set: std::collections::HashSet<String> =
            new_outlinks.iter().cloned().collect();

        // Remove backlinks from notes that are no longer linked.
        for old_target_id in &note.outlinks {
            if !new_outlinks_set.contains(old_target_id) {
                if let Ok(Some((old_meta_frame_id, old_frame))) = self.find_note_meta_by_id(old_target_id) {
                    let mut old_note = self.note_record_from_meta_frame(old_frame)?;
                    old_note.backlinks.retain(|id| id != note_id);
                    let meta_payload = serde_json::to_vec(&old_note)?;
                    let opts = PutOptions {
                        title: Some(old_note.title.clone()),
                        tags: vec![NOTE_META_TAG.to_string(),
                            format!("{NOTE_ID_PREFIX}{}", old_note.id),
                            format!("{NOTE_PATH_PREFIX}{}", old_note.path.as_str()),
                            "note-meta".to_string()],
                        ..Default::default()
                    };
                    self.mem.update_frame(old_meta_frame_id, Some(meta_payload), opts, None)
                        .map_err(|e| KbError::Memvid(e.to_string()))?;
                }
            }
        }

        // Add backlinks to newly linked notes.
        for new_target_id in &new_outlinks {
            if !old_outlinks.contains(new_target_id) {
                if let Ok(Some((target_meta_frame_id, target_frame))) =
                    self.find_note_meta_by_id(new_target_id)
                {
                    let mut target_note = self.note_record_from_meta_frame(target_frame)?;
                    if !target_note.backlinks.contains(&note_id.to_string()) {
                        target_note.backlinks.push(note_id.to_string());
                        let meta_payload = serde_json::to_vec(&target_note)?;
                        let opts = PutOptions {
                            title: Some(target_note.title.clone()),
                            tags: vec![NOTE_META_TAG.to_string(),
                                format!("{NOTE_ID_PREFIX}{}", target_note.id),
                                format!("{NOTE_PATH_PREFIX}{}", target_note.path.as_str()),
                                "note-meta".to_string()],
                            ..Default::default()
                        };
                        self.mem.update_frame(target_meta_frame_id, Some(meta_payload), opts, None)
                            .map_err(|e| KbError::Memvid(e.to_string()))?;
                    }
                }
            }
        }

        // Update the note's outlinks and outline fields.
        note.outlinks = new_outlinks;
        note.outline = Self::extract_outline(&note.content);
        let meta_payload = serde_json::to_vec(&note)?;
        let opts = PutOptions {
            title: Some(note.title.clone()),
            tags: vec![NOTE_META_TAG.to_string(),
                format!("{NOTE_ID_PREFIX}{}", note.id),
                format!("{NOTE_PATH_PREFIX}{}", note.path.as_str()),
                "note-meta".to_string()],
            ..Default::default()
        };
        self.mem.update_frame(meta_frame_id, Some(meta_payload), opts, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(())
    }

    fn find_note_meta_by_path(&mut self, path: &str) -> Result<Option<(String, u64)>> {
        // Fast path: use registry index.
        if let Some(entry) = self.get_note_by_path(path) {
            return Ok(Some((entry.note_id.clone(), entry.meta_frame_id)));
        }
        // Fallback: scan all frames.
        let frame_ids = self.collect_all_frame_ids()?;
        for frame_id in frame_ids.into_iter().rev() {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };
            if !frame.tags.iter().any(|tag| tag == NOTE_META_TAG) {
                continue;
            }
            let matches_path = frame.tags.iter().any(|tag| tag == &format!("{NOTE_PATH_PREFIX}{path}"));
            if !matches_path {
                continue;
            }
            let note_id = frame.tags.iter().find_map(|tag| tag.strip_prefix(NOTE_ID_PREFIX).map(|s| s.to_string()))
                .ok_or_else(|| KbError::Config("note meta frame missing note id tag".to_string()))?;
            return Ok(Some((note_id, frame_id)));
        }
        Ok(None)
    }

    fn search_in_note_meta_payload(&mut self, path: &str) -> Result<Option<(u64, memvid_core::Frame)>> {
        let frame_ids = self.collect_all_frame_ids()?;
        for frame_id in frame_ids.into_iter().rev() {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };
            if !frame.tags.iter().any(|tag| tag == NOTE_META_TAG) {
                continue;
            }
            let mut reader = match self.mem.blob_reader(frame.id) {
                Ok(reader) => reader,
                Err(_) => continue,
            };
            let mut bytes = Vec::new();
            use std::io::Read;
            if reader.read_to_end(&mut bytes).is_err() {
                continue;
            }
            let note = match serde_json::from_slice::<NoteRecord>(&bytes) {
                Ok(note) => note,
                Err(_) => continue,
            };
            if note.path.as_str() == path {
                return Ok(Some((frame_id, frame)));
            }
        }
        Ok(None)
    }

    fn find_note_meta_by_id(&mut self, id: &str) -> Result<Option<(u64, memvid_core::Frame)>> {
        // Fast path: use registry index to find meta_frame_id.
        if let Some(reg) = &self.registry {
            for entry in reg.note_index.values() {
                if entry.note_id == id {
                    let frame_id = entry.meta_frame_id;
                    let frame = match self.mem.frame_by_id(frame_id) {
                        Ok(f) => f,
                        Err(_) => break,
                    };
                    return Ok(Some((frame_id, frame)));
                }
            }
        }
        // Fallback: scan all frames.
        let frame_ids = self.collect_all_frame_ids()?;
        for frame_id in frame_ids.into_iter().rev() {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };
            if !frame.tags.iter().any(|tag| tag == NOTE_META_TAG) {
                continue;
            }
            let matches_id = frame.tags.iter().any(|tag| tag == &format!("{NOTE_ID_PREFIX}{id}"));
            if matches_id {
                return Ok(Some((frame_id, frame)));
            }
        }
        Ok(None)
    }

    fn note_record_from_meta_frame(&mut self, frame: memvid_core::Frame) -> Result<NoteRecord> {
        let mut reader = self.mem.blob_reader(frame.id)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        let mut bytes = Vec::new();
        use std::io::Read;
        reader.read_to_end(&mut bytes)?;
        let note = serde_json::from_slice::<NoteRecord>(&bytes)?;
        Ok(note)
    }

    /// Update the tags of an existing frame.
    pub fn update_frame_tags(&mut self, frame_id: u64, new_tags: Vec<String>) -> Result<()> {
        let opts = PutOptions {
            tags: new_tags,
            ..Default::default()
        };
        self.mem.update_frame(frame_id, None, opts, None)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(())
    }

    /// Get the tags of a frame by its ID.
    pub fn get_frame_tags(&self, frame_id: u64) -> Result<Vec<String>> {
        let frame = self.mem.frame_by_id(frame_id)
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(frame.tags)
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
    /// Supports multiple document formats: PDF, Markdown, Text, HTML,
    /// DOCX, PPTX, XLSX, EPUB, RTF, CSV, JSON, and more.
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

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        let format = DocumentFormat::from_extension(&extension);
        let title: String;
        let kind: String;
        let content_for_indexing: Option<String>;

        // Use specialized parsers for structured documents
        if format != DocumentFormat::Unknown {
            match parsers::parse_document(path, &extension) {
                Ok(parsed) => {
                    title = parsed.title
                        .unwrap_or_else(|| {
                            path.file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("imported")
                                .to_string()
                        });

                    kind = match format {
                        DocumentFormat::Docx => "docx",
                        DocumentFormat::Pptx => "pptx",
                        DocumentFormat::Xlsx => "xlsx",
                        DocumentFormat::Epub => "epub",
                        DocumentFormat::Rtf => "rtf",
                        DocumentFormat::Csv => "csv",
                        DocumentFormat::Json => "json",
                        DocumentFormat::Unknown => "document",
                    }.to_string();

                    // Store the parsed content for better indexing
                    // If content is substantial, use it; otherwise use raw bytes
                    content_for_indexing = if parsed.content.len() > 100 {
                        Some(parsed.content)
                    } else {
                        None
                    };
                }
                Err(e) => {
                    tracing::warn!("Failed to parse {} as {}, falling back to raw: {}", extension, format, e);
                    title = path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("imported")
                        .to_string();
                    kind = "document".to_string();
                    content_for_indexing = None;
                }
            }
        } else {
            // Unknown format - use raw bytes
            title = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("imported")
                .to_string();
            kind = "document".to_string();
            content_for_indexing = None;
        }

        let payload = match &content_for_indexing {
            Some(text) => text.as_bytes().to_vec(),
            None => bytes,
        };

        // Auto-classification: detect type tags from content + path tags from file path
        let classification_text = content_for_indexing.as_deref().unwrap_or("");
        let (auto_tags, _classification_summary) = classify_document(
            classification_text,
            file_path,
            &[],
        );

        let mut builder = PutOptions::builder()
            .title(title.clone())
            .kind(kind)
            .uri(file_path.to_string())
            .enable_embedding(true)
            .auto_tag(true)
            .extract_triplets(true);

        // Add user-provided tags
        for tag in tags {
            builder = builder.push_tag(tag.to_string());
        }

        // Add auto-classification tags
        for tag in &auto_tags {
            builder = builder.push_tag(tag.clone());
        }

        let opts = builder.build();

        let _seq = self.mem
            .put_bytes_with_options(&payload, opts)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        // Build combined tag list
        let mut all_tags: Vec<String> = tags.iter().map(|s| s.to_string()).collect();
        all_tags.extend(auto_tags.clone());

        Ok(ImportResult {
            path: file_path.to_string(),
            title,
            chunks: 1,
            tags: all_tags,
            auto_tags,
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

                if matches!(ext, "txt" | "md" | "pdf" | "html" | "htm" | "docx" | "pptx" | "xlsx" | "xlsm" | "epub" | "rtf" | "csv" | "json") {
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
                                auto_tags: vec![],
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
                        auto_tags: vec![],
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

    /// Import an audio file and transcribe it using Whisper.
    /// Requires the "whisper" feature to be enabled in memvid-core.
    pub fn import_audio(&mut self, file_path: &str, tags: &[&str]) -> Result<ImportResult> {
        let path = Path::new(file_path);
        if !path.exists() {
            return Err(KbError::FileNotFound(file_path.to_string()));
        }

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("audio")
            .to_string();

        // For now, we read the audio file as bytes and store it
        // In a full implementation with whisper feature, this would:
        // 1. Load the Whisper model
        // 2. Transcribe the audio to text
        // 3. Store the transcript as a document
        let bytes = std::fs::read(path)?;
        let _content_length = bytes.len();

        let mut builder = PutOptions::builder()
            .title(title.clone())
            .kind("audio".to_string())
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
            auto_tags: vec![],
            success: true,
            error: None,
        })
    }

    /// Import an image file and generate CLIP embeddings for visual search.
    /// Requires the "clip" feature to be enabled in memvid-core.
    pub fn import_image(&mut self, file_path: &str, tags: &[&str]) -> Result<ImportResult> {
        let path = Path::new(file_path);
        if !path.exists() {
            return Err(KbError::FileNotFound(file_path.to_string()));
        }

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("image")
            .to_string();

        // Read the image file
        let bytes = std::fs::read(path)?;

        let mut builder = PutOptions::builder()
            .title(title.clone())
            .kind("image".to_string())
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
            auto_tags: vec![],
            success: true,
            error: None,
        })
    }

    /// Search with knowledge graph pattern filter.
    /// Filters search results to include only documents that mention
    /// entities matching the specified graph pattern.
    /// Pattern format: "Kind:name" (e.g., "Person:Alice", "Project:memvid")
    pub fn search_with_graph(
        &mut self,
        query: &str,
        graph_pattern: &str,
        top_k: usize,
        mode: SearchMode,
    ) -> Result<Vec<SearchHit>> {
        // First, get entities matching the pattern
        let entities = self.find_entities_by_pattern(graph_pattern)?;

        // If no entities match, return empty results
        if entities.is_empty() {
            return Ok(Vec::new());
        }

        // Get frame IDs from matching entities
        let relevant_frame_ids: std::collections::HashSet<u64> = entities
            .iter()
            .flat_map(|e| e.frame_ids.clone())
            .collect();

        // Search and filter results
        let all_results = self.search(query, top_k * 2, mode)?;

        // Filter to only include results from relevant frames
        let filtered: Vec<SearchHit> = all_results
            .into_iter()
            .filter(|hit| {
                hit.id.parse::<u64>()
                    .map(|id| relevant_frame_ids.contains(&id))
                    .unwrap_or(false)
            })
            .take(top_k)
            .collect();

        Ok(filtered)
    }

    /// Find entities matching a pattern like "Kind:name" or just "name"
    fn find_entities_by_pattern(&self, pattern: &str) -> Result<Vec<EntityInfo>> {
        let mesh = self.mem.logic_mesh();

        // Parse pattern: "Kind:name" or just "name"
        let (kind_filter, name_filter) = if let Some((kind, name)) = pattern.split_once(':') {
            (Some(kind), name)
        } else {
            (None, pattern)
        };

        let all_entities = list_mesh_entities(mesh, kind_filter);

        // Filter by name if specified
        let matching: Vec<EntityInfo> = all_entities
            .into_iter()
            .filter(|e| {
                e.display_name.to_lowercase().contains(&name_filter.to_lowercase())
                    || e.canonical_name.to_lowercase().contains(&name_filter.to_lowercase())
            })
            .collect();

        Ok(matching)
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

        let retriever_str = format!("{:?}", response.retriever).to_lowercase();

        let context: Vec<ContextFragment> = response.context_fragments.into_iter().map(|f| ContextFragment {
            rank: f.rank,
            frame_id: format!("{}", f.frame_id),
            uri: f.uri,
            title: f.title,
            score: f.score,
            text: f.text,
        }).collect();

        // When not in context-only mode, try LLM synthesis if configured.
        let answer = if context_only {
            None
        } else {
            match crate::llm::synthesize_with_config(question, &context, None)? {
                Some(text) => Some(text),
                None => response.answer, // Fall back to memvid's built-in concatenation
            }
        };

        Ok(AskResult {
            answer,
            citations: response.citations.into_iter().map(|c| AskCitation {
                index: c.index,
                frame_id: format!("{}", c.frame_id),
                uri: c.uri,
                score: c.score,
            }).collect(),
            context,
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

    fn folder_meta_frames(&mut self) -> Result<Vec<(u64, FolderInfo)>> {
        let frame_ids = self.collect_all_frame_ids()?;
        let mut folders = Vec::new();

        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };

            if !has_tag(&frame.tags, FOLDER_META_TAG) || has_tag(&frame.tags, FOLDER_DELETED_TAG) {
                continue;
            }

            let id = match extract_tag_value(&frame.tags, FOLDER_ID_PREFIX) {
                Some(id) => id,
                None => continue,
            };

            let name = extract_tag_value(&frame.tags, FOLDER_NAME_PREFIX).unwrap_or_else(|| id.clone());
            let parent_id = extract_tag_value(&frame.tags, FOLDER_PARENT_PREFIX)
                .filter(|value| !value.is_empty());
            let path = extract_tag_value(&frame.tags, FOLDER_PATH_PREFIX)
                .unwrap_or_else(|| format!("/{}", name));
            let created_at = extract_tag_value(&frame.tags, FOLDER_CREATED_PREFIX)
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or_default();

            folders.push((
                frame_id,
                FolderInfo {
                    id,
                    name,
                    parent_id,
                    path,
                    doc_count: 0,
                    created_at,
                },
            ));
        }

        Ok(folders)
    }

    fn folder_doc_counts(&mut self) -> Result<HashMap<String, usize>> {
        let frame_ids = self.collect_all_frame_ids()?;
        let mut counts = HashMap::new();

        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };

            if has_tag(&frame.tags, FOLDER_META_TAG) {
                continue;
            }

            for tag in &frame.tags {
                if let Some(folder_id) = tag.strip_prefix("folder:") {
                    *counts.entry(folder_id.to_string()).or_insert(0) += 1;
                }
            }
        }

        Ok(counts)
    }

    fn replace_or_insert_tag(tags: &mut Vec<String>, prefix: &str, value: Option<String>) {
        tags.retain(|tag| !tag.starts_with(prefix));
        if let Some(value) = value {
            tags.push(format!("{prefix}{value}"));
        }
    }

    pub fn list_folders(&mut self) -> Result<Vec<FolderInfo>> {
        let folder_frames = self.folder_meta_frames()?;
        let counts = self.folder_doc_counts()?;

        Ok(folder_frames
            .into_iter()
            .map(|(_, mut folder)| {
                folder.doc_count = counts.get(&folder.id).copied().unwrap_or(0);
                folder
            })
            .collect())
    }

    pub fn create_folder(&mut self, name: &str, parent_id: Option<&str>) -> Result<FolderInfo> {
        let existing = self.list_folders()?;
        let parent = match parent_id {
            Some(id) => Some(
                existing
                    .iter()
                    .find(|folder| folder.id == id)
                    .cloned()
                    .ok_or_else(|| KbError::Config(format!("Parent folder not found: {id}")))?,
            ),
            None => None,
        };

        let id = format!("folder-{}", uuid::Uuid::new_v4());
        let path = match parent {
            Some(ref parent_folder) => format!("{}/{}", parent_folder.path.trim_end_matches('/'), name),
            None => format!("/{}", name),
        };
        let created_at = chrono::Utc::now().timestamp();
        let payload = format!("folder:{name}\npath:{path}");

        let mut builder = PutOptions::builder()
            .title(format!("Folder {}", name))
            .kind("folder_meta".to_string())
            .push_tag(FOLDER_META_TAG.to_string())
            .push_tag(format!("{FOLDER_ID_PREFIX}{id}"))
            .push_tag(format!("{FOLDER_NAME_PREFIX}{name}"))
            .push_tag(format!("{FOLDER_PATH_PREFIX}{path}"))
            .push_tag(format!("{FOLDER_CREATED_PREFIX}{created_at}"));

        if let Some(parent_folder) = parent {
            builder = builder.push_tag(format!("{FOLDER_PARENT_PREFIX}{}", parent_folder.id));
        }

        let frame_id = self.mem
            .put_bytes_with_options(payload.as_bytes(), builder.build())
            .map_err(|e| KbError::Memvid(e.to_string()))?;
        self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;

        let folder = FolderInfo {
            id: id.clone(),
            name: name.to_string(),
            parent_id: parent_id.map(ToString::to_string),
            path: path.clone(),
            doc_count: 0,
            created_at,
        };
        self.sync_registry_add_folder(&folder, frame_id);

        Ok(folder)
    }

    pub fn rename_folder(&mut self, folder_id: &str, new_name: &str) -> Result<()> {
        let folder_frames = self.folder_meta_frames()?;
        let target = folder_frames
            .iter()
            .find(|(_, folder)| folder.id == folder_id)
            .cloned()
            .ok_or_else(|| KbError::Config(format!("Folder not found: {folder_id}")))?;

        let old_path = target.1.path.clone();
        let parent_path = target
            .1
            .parent_id
            .as_ref()
            .and_then(|parent_id| folder_frames.iter().find(|(_, folder)| &folder.id == parent_id))
            .map(|(_, folder)| folder.path.clone());
        let new_path = parent_path
            .map(|path: String| format!("{}/{}", path.trim_end_matches('/'), new_name))
            .unwrap_or_else(|| format!("/{}", new_name));

        for (frame_id, folder) in &folder_frames {
            let current_path = folder.path.clone();
            if current_path == old_path || current_path.starts_with(&(old_path.clone() + "/")) {
                let mut tags = self.get_frame_tags(*frame_id)?;
                let updated_path = current_path.replacen(&old_path, &new_path, 1);
                let updated_name = if folder.id == folder_id {
                    new_name.to_string()
                } else {
                    folder.name.clone()
                };
                Self::replace_or_insert_tag(&mut tags, FOLDER_NAME_PREFIX, Some(updated_name));
                Self::replace_or_insert_tag(&mut tags, FOLDER_PATH_PREFIX, Some(updated_path));
                self.update_frame_tags(*frame_id, tags)?;
            }
        }

        let frame_ids = self.collect_all_frame_ids()?;
        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };

            if has_tag(&frame.tags, FOLDER_META_TAG) {
                continue;
            }

            let mut tags = frame.tags.clone();
            let mut changed = false;
            for tag in &frame.tags {
                if let Some(existing_path) = tag.strip_prefix(FOLDER_PATH_PREFIX) {
                    if existing_path == old_path || existing_path.starts_with(&(old_path.clone() + "/")) {
                        let updated_path = existing_path.replacen(&old_path, &new_path, 1);
                        Self::replace_or_insert_tag(&mut tags, FOLDER_PATH_PREFIX, Some(updated_path));
                        changed = true;
                    }
                }
            }

            if changed {
                self.update_frame_tags(frame_id, tags)?;
            }
        }

        self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;

        // Re-read folder frames after commit to get updated paths, then sync registry.
        let updated_folders = self.folder_meta_frames()?;
        let affected: Vec<(String, String, String)> = updated_folders
            .iter()
            .filter(|(_, folder)| {
                folder.path == new_path || folder.path.starts_with(&(new_path.clone() + "/"))
            })
            .map(|(_, folder)| (folder.id.clone(), folder.name.clone(), folder.path.clone()))
            .collect();
        if !affected.is_empty() {
            self.sync_registry_update_all_folders(&affected);
        }

        Ok(())
    }

    pub fn delete_folder(&mut self, folder_id: &str) -> Result<()> {
        let folder_frames = self.folder_meta_frames()?;
        let target = folder_frames
            .iter()
            .find(|(_, folder)| folder.id == folder_id)
            .cloned()
            .ok_or_else(|| KbError::Config(format!("Folder not found: {folder_id}")))?;
        let root_path = target.1.path.clone();
        let affected_ids: Vec<String> = folder_frames
            .iter()
            .filter(|(_, folder)| folder.path == root_path || folder.path.starts_with(&(root_path.clone() + "/")))
            .map(|(_, folder)| folder.id.clone())
            .collect();

        for (frame_id, folder) in &folder_frames {
            if affected_ids.contains(&folder.id) {
                let mut tags = self.get_frame_tags(*frame_id)?;
                if !has_tag(&tags, FOLDER_DELETED_TAG) {
                    tags.push(FOLDER_DELETED_TAG.to_string());
                    self.update_frame_tags(*frame_id, tags)?;
                }
            }
        }

        let frame_ids = self.collect_all_frame_ids()?;
        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };

            if has_tag(&frame.tags, FOLDER_META_TAG) {
                continue;
            }

            let mut tags = frame.tags.clone();
            let original_len = tags.len();
            tags.retain(|tag| {
                if let Some(id) = tag.strip_prefix("folder:") {
                    return !affected_ids.iter().any(|candidate| candidate == id);
                }
                if let Some(path) = tag.strip_prefix(FOLDER_PATH_PREFIX) {
                    return !(path == root_path || path.starts_with(&(root_path.clone() + "/")));
                }
                true
            });

            if tags.len() != original_len {
                self.update_frame_tags(frame_id, tags)?;
            }
        }

        self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;

        // Sync registry: remove target folder and all subfolders.
        for id in &affected_ids {
            self.sync_registry_remove_folder(id);
        }

        Ok(())
    }

    pub fn move_document_to_folder(&mut self, frame_id: u64, folder_id: Option<&str>) -> Result<()> {
        let mut tags = self.get_frame_tags(frame_id)?;
        tags.retain(|tag| !tag.starts_with("folder:") && !tag.starts_with(FOLDER_PATH_PREFIX));

        if let Some(folder_id) = folder_id {
            let folders = self.list_folders()?;
            let folder = folders
                .into_iter()
                .find(|folder| folder.id == folder_id)
                .ok_or_else(|| KbError::Config(format!("Folder not found: {folder_id}")))?;
            tags.push(format!("folder:{}", folder.id));
            tags.push(format!("{FOLDER_PATH_PREFIX}{}", folder.path));
        }

        self.update_frame_tags(frame_id, tags)?;
        self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(())
    }

    pub fn search_in_folder(&mut self, folder_id: &str, query: &str, top_k: usize, mode: SearchMode) -> Result<Vec<SearchHit>> {
        let folder = self
            .list_folders()?
            .into_iter()
            .find(|folder| folder.id == folder_id)
            .ok_or_else(|| KbError::Config(format!("Folder not found: {folder_id}")))?;
        let all_results = self.search(query, top_k * 4, mode)?;

        let mut filtered = Vec::new();
        for hit in all_results {
            let frame_id = match hit.id.parse::<u64>() {
                Ok(id) => id,
                Err(_) => continue,
            };
            let tags = self.get_frame_tags(frame_id)?;
            let in_folder = tags.iter().any(|tag| {
                tag.strip_prefix(FOLDER_PATH_PREFIX)
                    .map(|path| path == folder.path || path.starts_with(&(folder.path.clone() + "/")))
                    .unwrap_or(false)
            });
            if in_folder {
                filtered.push(hit);
            }
            if filtered.len() >= top_k {
                break;
            }
        }

        Ok(filtered)
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
        // Fast path: read from registry tag_index.
        if let Some(reg) = &self.registry {
            let mut tags: Vec<TagInfo> = reg.tag_index
                .iter()
                .filter(|(name, _)| {
                    !name.starts_with("note_id:") && !name.starts_with("note_path:")
                        && !name.starts_with(FOLDER_ID_PREFIX) && !name.starts_with(FOLDER_NAME_PREFIX)
                        && !name.starts_with(FOLDER_PARENT_PREFIX) && !name.starts_with(FOLDER_PATH_PREFIX)
                        && !name.starts_with(FOLDER_CREATED_PREFIX)
                        && !name.starts_with("__") && *name != "note-meta" && *name != "note"
                })
                .map(|(name, count)| TagInfo { name: name.clone(), count: *count })
                .collect();
            tags.sort_by(|a, b| b.count.cmp(&a.count));
            return Ok(tags);
        }
        // Fallback: scan all frames.
        let mut tag_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let frame_ids = self.collect_all_frame_ids()?;

        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(frame) => frame,
                Err(_) => continue,
            };

            if has_tag(&frame.tags, FOLDER_META_TAG) || has_tag(&frame.tags, FOLDER_DELETED_TAG) {
                continue;
            }

            for tag in &frame.tags {
                if tag.starts_with(FOLDER_ID_PREFIX)
                    || tag.starts_with(FOLDER_NAME_PREFIX)
                    || tag.starts_with(FOLDER_PARENT_PREFIX)
                    || tag.starts_with(FOLDER_PATH_PREFIX)
                    || tag.starts_with(FOLDER_CREATED_PREFIX)
                {
                    continue;
                }
                *tag_map.entry(tag.clone()).or_insert(0) += 1;
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

    /// Compare search results at two different points in time.
    /// Shows what was added, removed, or changed between the two timestamps.
    pub fn compare_as_of(&mut self, query: &str, earlier_ts: i64, later_ts: i64, top_k: usize) -> Result<CompareResult> {
        // Search at both timestamps
        let earlier_hits = self.search_as_of_impl(query, earlier_ts, top_k)?;
        let later_hits = self.search_as_of_impl(query, later_ts, top_k)?;

        let earlier_map: std::collections::HashMap<String, _> = earlier_hits.iter()
            .map(|h| (h.id.clone(), h.clone())).collect();
        let later_map: std::collections::HashMap<String, _> = later_hits.iter()
            .map(|h| (h.id.clone(), h.clone())).collect();

        let all_ids: std::collections::HashSet<String> = earlier_map.keys()
            .chain(later_map.keys())
            .cloned()
            .collect();

        let mut compare_hits_earlier = Vec::new();
        let mut compare_hits_later = Vec::new();

        for id in all_ids {
            let earlier = earlier_map.get(&id);
            let later = later_map.get(&id);

            match (earlier, later) {
                (Some(e), Some(l)) => {
                    // Document exists in both — check for score changes
                    let score_change = Some(l.score - e.score);
                    let status = if (l.score - e.score).abs() > 0.01 { "changed" } else { "unchanged" };
                    compare_hits_earlier.push(CompareHit {
                        id: e.id.clone(),
                        title: e.title.clone(),
                        snippet: e.content.clone(),
                        score: e.score,
                        status: status.to_string(),
                        score_change,
                    });
                    compare_hits_later.push(CompareHit {
                        id: l.id.clone(),
                        title: l.title.clone(),
                        snippet: l.content.clone(),
                        score: l.score,
                        status: status.to_string(),
                        score_change,
                    });
                }
                (Some(e), None) => {
                    // Removed between earlier and later
                    compare_hits_earlier.push(CompareHit {
                        id: e.id.clone(),
                        title: e.title.clone(),
                        snippet: e.content.clone(),
                        score: e.score,
                        status: "removed".to_string(),
                        score_change: None,
                    });
                }
                (None, Some(l)) => {
                    // Added between earlier and later
                    compare_hits_later.push(CompareHit {
                        id: l.id.clone(),
                        title: l.title.clone(),
                        snippet: l.content.clone(),
                        score: l.score,
                        status: "added".to_string(),
                        score_change: None,
                    });
                }
                _ => {}
            }
        }

        // Sort by status (removed first, then added, then changed, then unchanged)
        let sort_order = |h: &CompareHit| -> i32 {
            match h.status.as_str() {
                "removed" => 0,
                "added" => 1,
                "changed" => 2,
                _ => 3,
            }
        };
        compare_hits_earlier.sort_by_key(sort_order);
        compare_hits_later.sort_by_key(sort_order);

        Ok(CompareResult {
            earlier_timestamp: earlier_ts,
            later_timestamp: later_ts,
            earlier_hits: compare_hits_earlier,
            later_hits: compare_hits_later,
            query: query.to_string(),
        })
    }

    /// Internal search-as-of implementation (returns raw hits for comparison).
    fn search_as_of_impl(&mut self, query: &str, as_of_ts: i64, top_k: usize) -> Result<Vec<SearchHit>> {
        let request = MemvidSearchRequest {
            query: query.to_string(),
            top_k,
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

    /// Rename a tag across all documents.
    /// All occurrences of `old_tag` will be replaced with `new_tag`.
    pub fn rename_tag(&mut self, old_tag: &str, new_tag: &str) -> Result<TagOperationResult> {
        if old_tag == new_tag {
            return Ok(TagOperationResult { updated: 0, tag: old_tag.to_string(), related_tag: Some(new_tag.to_string()) });
        }

        let mut updated = 0;
        let frame_ids = self.collect_all_frame_ids()?;

        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(f) => f,
                Err(_) => continue,
            };

            if frame.tags.contains(&old_tag.to_string()) {
                let mut new_tags = frame.tags.clone();
                // Replace all occurrences of old_tag with new_tag
                for tag in new_tags.iter_mut() {
                    if tag == old_tag {
                        *tag = new_tag.to_string();
                    }
                }

                let opts = PutOptions { tags: new_tags.clone(), ..Default::default() };

                let _ = self.mem.update_frame(frame_id, None, opts, None);
                updated += 1;
            }
        }

        if updated > 0 {
            self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;
            self.sync_tag_index_rename(old_tag, new_tag, updated);
        }

        Ok(TagOperationResult {
            updated,
            tag: old_tag.to_string(),
            related_tag: Some(new_tag.to_string()),
        })
    }

    /// Merge a source tag into a destination tag.
    /// The source tag will be added to documents that don't already have it,
    /// then removed from all documents (deduplication).
    pub fn merge_tag(&mut self, source_tag: &str, dest_tag: &str) -> Result<TagOperationResult> {
        if source_tag == dest_tag {
            return Ok(TagOperationResult { updated: 0, tag: source_tag.to_string(), related_tag: Some(dest_tag.to_string()) });
        }

        let mut updated = 0;
        let frame_ids = self.collect_all_frame_ids()?;

        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(f) => f,
                Err(_) => continue,
            };

            // Check if this frame has the source tag but not the dest tag
            let has_source = frame.tags.contains(&source_tag.to_string());
            let has_dest = frame.tags.contains(&dest_tag.to_string());

            if has_source && !has_dest {
                let mut new_tags = frame.tags.clone();
                new_tags.push(dest_tag.to_string());
                // Remove the source tag (now merged into dest)
                new_tags.retain(|t| t != source_tag);

                let opts = PutOptions { tags: new_tags, ..Default::default() };

                let _ = self.mem.update_frame(frame_id, None, opts, None);
                updated += 1;
            } else if has_source && has_dest {
                // Has both - just remove the source tag (deduplication)
                let mut new_tags = frame.tags.clone();
                new_tags.retain(|t| t != source_tag);

                let opts = PutOptions { tags: new_tags, ..Default::default() };

                let _ = self.mem.update_frame(frame_id, None, opts, None);
                updated += 1;
            }
        }

        if updated > 0 {
            self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;
            self.sync_tag_index_merge(source_tag, dest_tag, updated);
        }

        Ok(TagOperationResult {
            updated,
            tag: source_tag.to_string(),
            related_tag: Some(dest_tag.to_string()),
        })
    }

    /// Delete a tag from all documents.
    pub fn delete_tag(&mut self, tag: &str) -> Result<TagOperationResult> {
        let mut updated = 0;
        let frame_ids = self.collect_all_frame_ids()?;

        for frame_id in frame_ids {
            let frame = match self.mem.frame_by_id(frame_id) {
                Ok(f) => f,
                Err(_) => continue,
            };

            if frame.tags.contains(&tag.to_string()) {
                let mut new_tags = frame.tags.clone();
                new_tags.retain(|t| t != tag);

                let opts = PutOptions { tags: new_tags, ..Default::default() };

                let _ = self.mem.update_frame(frame_id, None, opts, None);
                updated += 1;
            }
        }

        if updated > 0 {
            self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;
            self.sync_tag_index_delete(tag, updated);
        }

        Ok(TagOperationResult {
            updated,
            tag: tag.to_string(),
            related_tag: None,
        })
    }

    // -----------------------------------------------------------------------
    // Tag index sync helpers
    // -----------------------------------------------------------------------

    /// Update registry tag_index after a rename operation.
    fn sync_tag_index_rename(&mut self, old_tag: &str, new_tag: &str, frames_updated: usize) {
        if let Some(reg) = self.registry.as_mut() {
            let old_count = reg.tag_index.get(old_tag).copied().unwrap_or(0);
            let new_count = reg.tag_index.get(new_tag).copied().unwrap_or(0);
            // old_tag count splits between old and new across frames_updated frames.
            let remaining = old_count.saturating_sub(frames_updated);
            let additional = old_count.saturating_sub(frames_updated);
            if remaining > 0 {
                reg.tag_index.insert(old_tag.to_string(), remaining);
            } else {
                reg.tag_index.remove(old_tag);
            }
            reg.tag_index.insert(new_tag.to_string(), new_count.saturating_add(additional));
            reg.last_modified = chrono::Utc::now().timestamp();
            drop(self.persist_registry());
        }
    }

    /// Update registry tag_index after a merge operation (source → dest).
    fn sync_tag_index_merge(&mut self, source_tag: &str, dest_tag: &str, frames_updated: usize) {
        if let Some(reg) = self.registry.as_mut() {
            let source_count = reg.tag_index.get(source_tag).copied().unwrap_or(0);
            let dest_count = reg.tag_index.get(dest_tag).copied().unwrap_or(0);
            // source tag is removed from frames_updated frames; dest tag gets those counts.
            reg.tag_index.remove(source_tag);
            if frames_updated > 0 {
                let merged = dest_count.saturating_add(frames_updated);
                reg.tag_index.insert(dest_tag.to_string(), merged);
            }
            reg.last_modified = chrono::Utc::now().timestamp();
            drop(self.persist_registry());
        }
    }

    /// Update registry tag_index after a delete operation.
    fn sync_tag_index_delete(&mut self, tag: &str, frames_updated: usize) {
        if let Some(reg) = self.registry.as_mut() {
            let current = reg.tag_index.get(tag).copied().unwrap_or(0);
            let remaining = current.saturating_sub(frames_updated);
            if remaining > 0 {
                reg.tag_index.insert(tag.to_string(), remaining);
            } else {
                reg.tag_index.remove(tag);
            }
            reg.last_modified = chrono::Utc::now().timestamp();
            drop(self.persist_registry());
        }
    }

    /// Add a folder to the registry after create_folder.
    fn sync_registry_add_folder(&mut self, folder: &FolderInfo, frame_id: u64) {
        if let Some(reg) = self.registry.as_mut() {
            reg.folder_index.insert(folder.id.clone(), FolderIndexEntry {
                folder_id: folder.id.clone(),
                frame_id,
                name: folder.name.clone(),
                parent_id: folder.parent_id.clone(),
                path: folder.path.clone(),
                doc_count: 0,
                created_at: folder.created_at,
            });
            reg.last_modified = chrono::Utc::now().timestamp();
            drop(self.persist_registry());
        }
    }

    /// Update a folder in the registry after rename_folder.
    fn sync_registry_update_folder(&mut self, folder_id: &str, name: &str, path: &str) {
        if let Some(reg) = self.registry.as_mut() {
            if let Some(entry) = reg.folder_index.get_mut(folder_id) {
                entry.name = name.to_string();
                entry.path = path.to_string();
                reg.last_modified = chrono::Utc::now().timestamp();
                drop(self.persist_registry());
            }
        }
    }

    /// Batch-update all folder entries in the registry (used after rename to update
    /// the target folder and all its subfolders at once).
    fn sync_registry_update_all_folders(&mut self, folders: &[(String, String, String)]) {
        // folders: [(folder_id, name, path)]
        if self.registry.is_none() { return; }
        let reg = self.registry.as_mut().unwrap();
        for (folder_id, name, path) in folders {
            if let Some(entry) = reg.folder_index.get_mut(folder_id) {
                entry.name = name.clone();
                entry.path = path.clone();
            }
        }
        reg.last_modified = chrono::Utc::now().timestamp();
        drop(self.persist_registry());
    }

    /// Remove a folder from the registry after delete_folder.
    fn sync_registry_remove_folder(&mut self, folder_id: &str) {
        if let Some(reg) = self.registry.as_mut() {
            reg.folder_index.remove(folder_id);
            reg.last_modified = chrono::Utc::now().timestamp();
            drop(self.persist_registry());
        }
    }

    // -----------------------------------------------------------------------
    // Registry — persistent metadata index
    // -----------------------------------------------------------------------

    /// Load existing registry from a `__kb_registry__` frame, or build one
    /// from scratch by scanning all frames.
    fn load_or_build_registry(&mut self) -> Result<()> {
        let frame_ids = self.collect_all_frame_ids()?;

        // Try to find an existing registry frame.
        for frame_id in &frame_ids {
            let frame = match self.mem.frame_by_id(*frame_id) {
                Ok(f) => f,
                Err(_) => continue,
            };
            if frame.tags.iter().any(|t| t == KB_REGISTRY_TAG) {
                let mut reader = self.mem.blob_reader(frame.id)
                    .map_err(|e| KbError::Memvid(e.to_string()))?;
                let mut bytes = Vec::new();
                use std::io::Read;
                if reader.read_to_end(&mut bytes).is_ok() {
                    if let Ok(mut reg) = serde_json::from_slice::<KbRegistry>(&bytes) {
                        reg.registry_frame_id = Some(*frame_id);
                        // Backfill the legacy in-memory note_path_registry.
                        self.note_path_registry = reg.note_index.iter()
                            .map(|(path, entry)| (path.clone(), entry.note_id.clone()))
                            .collect();
                        self.registry = Some(reg);
                        return Ok(());
                    }
                }
            }
        }

        // No registry frame found — build from scratch.
        self.build_registry_from_frames(frame_ids)
    }

    /// Scan all frames and build a fresh registry.
    fn build_registry_from_frames(&mut self, frame_ids: Vec<u64>) -> Result<()> {
        let mut reg = KbRegistry::default();
        let mut folder_doc_counts: HashMap<String, usize> = HashMap::new();

        for frame_id in &frame_ids {
            let frame = match self.mem.frame_by_id(*frame_id) {
                Ok(f) => f,
                Err(_) => continue,
            };

            // Note meta frames
            if frame.tags.iter().any(|t| t == NOTE_META_TAG) {
                let note_id = match frame.tags.iter().find_map(|t| t.strip_prefix(NOTE_ID_PREFIX).map(|s| s.to_string())) {
                    Some(id) => id,
                    None => continue,
                };
                let note_path = frame.tags.iter()
                    .find_map(|t| t.strip_prefix(NOTE_PATH_PREFIX).map(|s| s.to_string()));

                if let Some(path) = note_path {
                    let mut content_frame_id: Option<u64> = None;
                    // Find content frame with same note_id tag but not the meta tag.
                    for fid in &frame_ids {
                        if fid == frame_id { continue; }
                        if let Ok(f2) = self.mem.frame_by_id(*fid) {
                            if f2.tags.iter().any(|t| t == &format!("{NOTE_ID_PREFIX}{note_id}"))
                                && !f2.tags.iter().any(|t| t == NOTE_META_TAG)
                            {
                                content_frame_id = Some(*fid);
                                break;
                            }
                        }
                    }

                    let updated_at = frame.title.as_deref().unwrap_or("").to_string();
                    reg.note_index.insert(path.clone(), NoteIndexEntry {
                        note_id: note_id.clone(),
                        meta_frame_id: *frame_id,
                        content_frame_id,
                        updated_at,
                    });
                    self.note_path_registry.insert(path, note_id);
                }
                continue;
            }

            // Folder meta frames
            if frame.tags.iter().any(|t| t == FOLDER_META_TAG)
                && !frame.tags.iter().any(|t| t == FOLDER_DELETED_TAG)
            {
                let folder_id = match extract_tag_value(&frame.tags, FOLDER_ID_PREFIX) {
                    Some(id) => id,
                    None => continue,
                };
                let name = extract_tag_value(&frame.tags, FOLDER_NAME_PREFIX).unwrap_or_else(|| folder_id.clone());
                let parent_id = extract_tag_value(&frame.tags, FOLDER_PARENT_PREFIX).filter(|v| !v.is_empty());
                let path = extract_tag_value(&frame.tags, FOLDER_PATH_PREFIX).unwrap_or_else(|| format!("/{}", name));
                let created_at = extract_tag_value(&frame.tags, FOLDER_CREATED_PREFIX)
                    .and_then(|v| v.parse::<i64>().ok()).unwrap_or_default();

                reg.folder_index.insert(folder_id.clone(), FolderIndexEntry {
                    folder_id: folder_id.clone(),
                    frame_id: *frame_id,
                    name,
                    parent_id,
                    path,
                    doc_count: 0,
                    created_at,
                });
                continue;
            }

            // Document frames — count folder membership.
            for tag in &frame.tags {
                if let Some(folder_id) = tag.strip_prefix("folder:") {
                    *folder_doc_counts.entry(folder_id.to_string()).or_insert(0) += 1;
                }
            }

            // Tags
            for tag in &frame.tags {
                if !tag.starts_with("note_id:") && !tag.starts_with("note_path:")
                    && !tag.starts_with(FOLDER_ID_PREFIX) && !tag.starts_with(FOLDER_NAME_PREFIX)
                    && !tag.starts_with(FOLDER_PARENT_PREFIX) && !tag.starts_with(FOLDER_PATH_PREFIX)
                    && !tag.starts_with(FOLDER_CREATED_PREFIX) && !tag.starts_with("__")
                    && *tag != "note-meta" && *tag != "note"
                {
                    *reg.tag_index.entry(tag.clone()).or_insert(0) += 1;
                }
            }
        }

        // Apply folder doc counts.
        for (folder_id, count) in folder_doc_counts {
            if let Some(entry) = reg.folder_index.get_mut(&folder_id) {
                entry.doc_count = count;
            }
        }

        reg.last_modified = chrono::Utc::now().timestamp();
        self.registry = Some(reg);
        Ok(())
    }

    /// Write the current registry to a persistent frame.
    fn persist_registry(&mut self) -> Result<()> {
        let reg = self.registry.as_mut().ok_or_else(|| KbError::Config("registry not initialized".to_string()))?;
        reg.last_modified = chrono::Utc::now().timestamp();
        let payload = serde_json::to_vec(&*reg)
            .map_err(|e| KbError::Config(format!("serialize registry: {e}")))?;

        if let Some(existing_frame_id) = reg.registry_frame_id {
            let opts = PutOptions {
                tags: vec![KB_REGISTRY_TAG.to_string()],
                ..Default::default()
            };
            self.mem.update_frame(existing_frame_id, Some(payload), opts, None)
                .map_err(|e| KbError::Memvid(e.to_string()))?;
        } else {
            let opts = PutOptions::builder()
                .kind("__kb_registry__".to_string())
                .push_tag(KB_REGISTRY_TAG.to_string())
                .enable_embedding(false)
                .build();
            let seq = self.mem.put_bytes_with_options(&payload, opts)
                .map_err(|e| KbError::Memvid(e.to_string()))?;
            reg.registry_frame_id = Some(seq);
        }
        Ok(())
    }

    /// Sync the registry after a note change.
    fn sync_registry_note(&mut self, path: &str, note_id: &str, meta_frame_id: u64, content_frame_id: Option<u64>) {
        if let Some(reg) = self.registry.as_mut() {
            reg.note_index.insert(path.to_string(), NoteIndexEntry {
                note_id: note_id.to_string(),
                meta_frame_id,
                content_frame_id,
                updated_at: format_timestamp(chrono::Utc::now().timestamp()),
            });
            self.note_path_registry.insert(path.to_string(), note_id.to_string());
        }
    }

    /// Remove a note from the registry.
    fn sync_registry_remove_note(&mut self, path: &str) {
        if let Some(reg) = self.registry.as_mut() {
            reg.note_index.remove(path);
            self.note_path_registry.remove(path);
        }
    }

    /// O(1) lookup: find note_id by path using the registry.
    pub fn get_note_by_path(&self, path: &str) -> Option<&NoteIndexEntry> {
        self.registry.as_ref()?.note_index.get(path)
    }

    /// Fast folder listing using the registry index.
    pub fn list_folders_fast(&self) -> Vec<FolderIndexEntry> {
        match &self.registry {
            Some(reg) => reg.folder_index.values().cloned().collect(),
            None => Vec::new(),
        }
    }

    /// Get tag counts from the registry.
    pub fn tag_counts(&self) -> HashMap<String, usize> {
        match &self.registry {
            Some(reg) => reg.tag_index.clone(),
            None => HashMap::new(),
        }
    }

    /// Force-rebuild the registry from all frames and persist it.
    pub fn backfill_registry(&mut self) -> Result<()> {
        let frame_ids = self.collect_all_frame_ids()?;
        // Delete old registry frame if it exists.
        if let Some(reg) = &self.registry {
            if let Some(fid) = reg.registry_frame_id {
                let _ = self.mem.delete_frame(fid);
            }
        }
        self.registry = None;
        self.build_registry_from_frames(frame_ids)?;
        self.persist_registry()?;
        self.mem.commit().map_err(|e| KbError::Memvid(e.to_string()))?;
        Ok(())
    }

    /// Collect all frame IDs from the knowledge base using timeline enumeration.
    fn collect_all_frame_ids(&mut self) -> Result<Vec<u64>> {
        let mq = MemvidTimelineQuery::builder()
            .limit(std::num::NonZeroU64::new(10000).unwrap())
            .build();

        let entries = self.mem
            .timeline(mq)
            .map_err(|e| KbError::Memvid(e.to_string()))?;

        Ok(entries.into_iter().map(|e| e.frame_id).collect())
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

/// Extract a text snippet around the first occurrence of `needle` in `haystack`.
fn extract_snippet_around(haystack: &str, needle: &str, context_chars: usize) -> String {
    let haystack_lower = haystack.to_lowercase();
    let needle_lower = needle.to_lowercase();
    let start = match haystack_lower.find(&needle_lower) {
        Some(pos) => pos,
        None => return truncate_str(haystack, context_chars * 2),
    };

    let chars: Vec<char> = haystack.chars().collect();
    let byte_offset = start;
    let char_offset = haystack[..byte_offset].chars().count();
    let needle_chars = needle.chars().count();

    let from = char_offset.saturating_sub(context_chars);
    let to = (char_offset + needle_chars + context_chars).min(chars.len());

    let mut snippet = String::new();
    if from > 0 {
        snippet.push_str("…");
    }
    for ch in &chars[from..to] {
        snippet.push(*ch);
    }
    if to < chars.len() {
        snippet.push_str("…");
    }
    snippet
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
