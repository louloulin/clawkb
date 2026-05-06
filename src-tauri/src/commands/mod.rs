use std::sync::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

use clawkb_core::kb::{KbStats, FolderIndexEntry, NoteIndexEntry};
use clawkb_core::search::{SearchHit, SearchMode};
use clawkb_core::tag::TagInfo;
use clawkb_core::timeline::{TimelineEntry, TimelineQuery};
use clawkb_core::import::ImportResult;
use clawkb_core::export::{ExportFormat, export_to_string};
use clawkb_core::web::FetchUrlResult;
use clawkb_core::ask::AskResult;
use clawkb_core::entity::{EntityInfo, RelationEdge, TraverseResult, MeshStats, MemoryCardInfo};
use clawkb_core::KnowledgeBase;
use clawkb_core::ai_config::{AiProvider, EmbeddingConfig, LlmConfig, set_embedding_config, set_llm_config};
use clawkb_core::sync::{VaultSummary, webdav::{WebdavConfig, WebdavServerInfo, RemoteFile, SyncStatus,
    SyncManifest, FileSyncMeta,
    test_connection as wb_test, list_remote as wb_list, incremental_sync as wb_incremental_sync}};

pub struct AppState {
    /// Currently active/default knowledge base
    kb: Option<KnowledgeBase>,
    /// Additional open knowledge bases (path -> KnowledgeBase)
    extra_kbs: HashMap<String, KnowledgeBase>,
    /// Paths of open KBs (for bookkeeping)
    open_kb_paths: Vec<String>,
    pub webdav_config: Option<WebdavConfig>,
    pub webdav_kb_path: Option<String>,
    pub webdav_sync_status: Option<SyncStatus>,
    pub webdav_manifest: Option<SyncManifest>,
}

fn user_facing_command_error(raw: String) -> String {
    let normalized = raw.trim();

    if normalized.contains("Knowledge base not open") {
        return "Open or create a local knowledge base before running this action.".to_string();
    }

    if normalized.contains("File not found") || normalized.contains("No such file") {
        return "The selected file or knowledge base could not be found on disk.".to_string();
    }

    if normalized.contains("Parent folder not found") || normalized.contains("Folder not found") {
        return "The selected folder could not be found. Refresh the workspace and try again.".to_string();
    }

    if normalized.contains("Invalid export format") {
        return "Choose md, html, or json when exporting the knowledge base.".to_string();
    }

    raw
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            kb: None,
            extra_kbs: HashMap::new(),
            open_kb_paths: Vec::new(),
            webdav_config: None,
            webdav_kb_path: None,
            webdav_sync_status: None,
            webdav_manifest: None,
        }
    }
}

#[tauri::command]
pub fn create_kb(path: String, state: State<'_, Mutex<AppState>>) -> Result<KbStats, String> {
    let kb = KnowledgeBase::create(&path).map_err(|e| user_facing_command_error(e.to_string()))?;
    let stats = kb.stats().map_err(|e| user_facing_command_error(e.to_string()))?;
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    app_state.kb = Some(kb);
    Ok(stats)
}

#[tauri::command]
pub fn open_kb(path: String, state: State<'_, Mutex<AppState>>) -> Result<KbStats, String> {
    let kb = KnowledgeBase::open(&path).map_err(|e| user_facing_command_error(e.to_string()))?;
    let stats = kb.stats().map_err(|e| user_facing_command_error(e.to_string()))?;
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    app_state.kb = Some(kb);
    Ok(stats)
}

#[tauri::command]
pub fn close_kb(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.kb = None;
    Ok(())
}

#[tauri::command]
pub fn search_kb(
    query: String,
    top_k: Option<usize>,
    mode: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SearchHit>, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let top_k = top_k.unwrap_or(5);
    let search_mode = match mode.as_deref() {
        Some("lex") => SearchMode::Lexical,
        Some("sem") => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    };

    kb.search(&query, top_k, search_mode).map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn add_note(
    title: String,
    content: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.add_note(&title, &content, &tags_ref).map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn import_file(
    path: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ImportResult, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.import_file(&path, &tags_ref).map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn import_directory(
    dir_path: String,
    tags: Vec<String>,
    recursive: Option<bool>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ImportResult>, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.import_directory(&dir_path, &tags_ref, recursive.unwrap_or(false))
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn timeline_kb(
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<TimelineEntry>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let query = TimelineQuery {
        from_date,
        to_date,
        limit,
        tag: None,
    };
    kb.timeline(query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(state: State<'_, Mutex<AppState>>) -> Result<KbStats, String> {
    let app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;
    kb.stats().map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn commit_kb(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.commit().map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn list_tags(state: State<'_, Mutex<AppState>>) -> Result<Vec<TagInfo>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.list_tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_kb(
    format: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let export_format = match format.as_str() {
        "md" | "markdown" => ExportFormat::Markdown,
        "html" => ExportFormat::Html,
        "json" => ExportFormat::Json,
        _ => return Err(format!("Invalid export format: {}. Use md, html, or json.", format)),
    };

    let data = kb.export(export_format).map_err(|e| e.to_string())?;
    export_to_string(&data, export_format).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fetch_url(
    url: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<FetchUrlResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.fetch_url(&url, &tags_ref).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ai_ask(
    question: String,
    top_k: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<AskResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    kb.ask(&question, top_k).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ai_ask_context(
    question: String,
    top_k: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<AskResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    kb.ask_context_only(&question, top_k).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ask_document(
    question: String,
    document_uri: String,
    top_k: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<AskResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    kb.ask_document(&question, &document_uri, top_k).map_err(|e| e.to_string())
}

// ── Multi-KB commands ────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
pub struct MultiKbAskResult {
    pub kb_name: String,
    pub kb_path: String,
    pub result: AskResult,
}

/// Open an additional knowledge base (non-default, for multi-KB queries).
#[tauri::command]
pub fn open_extra_kb(path: String, state: State<'_, Mutex<AppState>>) -> Result<KbStats, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;

    // Skip if already open
    if app_state.extra_kbs.contains_key(&path) {
        if let Some(kb) = app_state.extra_kbs.get(&path) {
            return kb.stats().map_err(|e| e.to_string());
        }
        return Err("Cannot get stats".to_string());
    }

    let kb = KnowledgeBase::open(&path).map_err(|e| e.to_string())?;
    let stats = kb.stats().map_err(|e| e.to_string())?;

    app_state.extra_kbs.insert(path.clone(), kb);
    tracing::info!("Opened extra KB: {}", path);
    app_state.open_kb_paths.push(path);
    Ok(stats)
}

/// Close an additional knowledge base.
#[tauri::command]
pub fn close_extra_kb(path: String, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.extra_kbs.remove(&path);
    app_state.open_kb_paths.retain(|p| p != &path);
    tracing::info!("Closed extra KB: {}", path);
    Ok(())
}

/// Get list of all open KB paths.
#[tauri::command]
pub fn list_open_kbs(state: State<'_, Mutex<AppState>>) -> Result<Vec<String>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let mut paths = Vec::new();
    if app_state.kb.is_some() {
        paths.push(String::new());
    }
    paths.extend(app_state.open_kb_paths.clone());
    Ok(paths)
}

/// Search across multiple KBs simultaneously and merge results.
#[tauri::command]
pub fn search_multi_kb(
    query: String,
    kb_paths: Vec<String>,
    top_k: Option<usize>,
    mode: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SearchHit>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let top_k = top_k.unwrap_or(10);
    let search_mode = match mode.as_deref() {
        Some("lex") => SearchMode::Lexical,
        Some("sem") => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    };

    let mut all_hits: Vec<SearchHit> = Vec::new();

    // Search default KB if empty path or included
    if kb_paths.is_empty() || kb_paths.contains(&String::new()) {
        if let Some(ref mut kb) = app_state.kb {
            if let Ok(hits) = kb.search(&query, top_k, search_mode) {
                for mut hit in hits {
                    hit.source = Some("[Default]".to_string());
                    all_hits.push(hit);
                }
            }
        }
    }

    // Search extra KBs
    for path in &kb_paths {
        if path.is_empty() {
            continue;
        }
        if let Some(ref mut kb) = app_state.extra_kbs.get_mut(path) {
            if let Ok(mut hits) = kb.search(&query, top_k, search_mode) {
                let kb_name = PathBuf::from(path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("KB")
                    .to_string();
                for hit in hits.iter_mut() {
                    hit.source = Some(format!("[{}]", kb_name));
                }
                all_hits.extend(hits);
            }
        }
    }

    // Sort by score descending and limit
    all_hits.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    all_hits.truncate(top_k * kb_paths.len().max(1));
    Ok(all_hits)
}

/// Query multiple KBs and return combined answer using LLM synthesis.
#[tauri::command]
pub fn ai_ask_multi(
    question: String,
    kb_paths: Vec<String>,
    top_k: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<MultiKbAskResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let top_k = top_k.unwrap_or(5);

    let mut results: Vec<(String, AskResult)> = Vec::new();

    let webdav_kb_path = app_state.webdav_kb_path.clone();

    // Ask default KB
    if kb_paths.is_empty() || kb_paths.contains(&String::new()) {
        if let Some(ref mut kb) = app_state.kb {
            let kb_name = PathBuf::from(webdav_kb_path.as_deref().unwrap_or(""))
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Default")
                .to_string();
            if let Ok(result) = kb.ask(&question, Some(top_k)) {
                results.push((kb_name, result));
            }
        }
    }

    // Ask extra KBs
    for path in &kb_paths {
        if path.is_empty() {
            continue;
        }
        if let Some(ref mut kb) = app_state.extra_kbs.get_mut(path) {
            let kb_name = PathBuf::from(path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("KB")
                .to_string();
            if let Ok(result) = kb.ask(&question, Some(top_k)) {
                results.push((kb_name, result));
            }
        }
    }

    if results.is_empty() {
        return Err("No knowledge bases available".to_string());
    }

    // Return the first KB's result (multi-KB synthesis could be added later)
    let (kb_name, result) = results.remove(0);
    Ok(MultiKbAskResult {
        kb_name,
        kb_path: String::new(),
        result,
    })
}

// ── Graph / LogicMesh commands ──────────────────────────────────────

#[tauri::command]
pub fn list_entities(
    kind: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<EntityInfo>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;

    kb.list_entities(kind.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_entity(
    entity_id: u64,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<RelationEdge>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;

    kb.get_entity_edges(entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn traverse_graph(
    start: String,
    link: String,
    hops: usize,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<TraverseResult>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;

    kb.traverse_graph(&start, &link, hops).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_mesh_stats(state: State<'_, Mutex<AppState>>) -> Result<MeshStats, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;

    kb.graph_stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_memories(state: State<'_, Mutex<AppState>>) -> Result<Vec<MemoryCardInfo>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;

    kb.list_memories().map_err(|e| e.to_string())
}

// ── AI Configuration Commands ──────────────────────────────────────

#[tauri::command]
pub fn set_embedding_model(
    provider: String,
    model: String,
    api_key: Option<String>,
    api_base: Option<String>,
) -> Result<(), String> {
    let prov = match provider.as_str() {
        "local" => AiProvider::Local,
        "openai" => AiProvider::OpenAI,
        "custom" => AiProvider::Custom,
        _ => return Err(format!("Unknown embedding provider: {}", provider)),
    };
    let config = EmbeddingConfig {
        provider: prov,
        model,
        api_key,
        api_base,
    };
    set_embedding_config(config);
    tracing::info!("Embedding model configured: provider={}", provider);
    Ok(())
}

#[tauri::command]
pub fn set_ask_model(
    provider: String,
    model: String,
    api_key: Option<String>,
    api_base: Option<String>,
    temperature: f32,
) -> Result<(), String> {
    let prov = match provider.as_str() {
        "local" | "ollama" => AiProvider::Local,
        "openai" | "gpt" => AiProvider::OpenAI,
        "anthropic" | "claude" => AiProvider::Anthropic,
        "deepseek" => AiProvider::DeepSeek,
        _ => AiProvider::Custom,
    };
    let config = LlmConfig {
        provider: prov,
        model: model.clone(),
        api_key,
        api_base,
        temperature,
    };
    tracing::info!("LLM model configured: provider={}, model={}", provider, config.model);
    set_llm_config(config);
    Ok(())
}

#[tauri::command]
pub fn test_llm() -> Result<String, String> {
    clawkb_core::llm::test_llm_connection().map_err(|e| e.to_string())?;
    Ok("ok".to_string())
}

// ── Multimedia Import Commands ────────────────────────────────────

#[tauri::command]
pub fn import_audio(
    path: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ImportResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.import_audio(&path, &tags_ref).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_image(
    path: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ImportResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.import_image(&path, &tags_ref).map_err(|e| e.to_string())
}

// ── Graph Pattern Search ────────────────────────────────────────────

#[tauri::command]
pub fn search_with_graph(
    query: String,
    graph_pattern: String,
    top_k: Option<usize>,
    mode: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SearchHit>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let top_k = top_k.unwrap_or(10);
    let search_mode = match mode.as_deref() {
        Some("lex") => SearchMode::Lexical,
        Some("sem") => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    };

    kb.search_with_graph(&query, &graph_pattern, top_k, search_mode)
        .map_err(|e| e.to_string())
}

// ── Folder Management ───────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FolderInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "parent_id")]
    pub parent_id: Option<String>,
    pub path: String,
    #[serde(rename = "doc_count")]
    pub doc_count: usize,
    #[serde(rename = "created_at")]
    pub created_at: i64,
}

#[tauri::command]
pub fn list_folders(state: State<'_, Mutex<AppState>>) -> Result<Vec<FolderInfo>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.list_folders()
        .map(|folders| folders.into_iter().map(|folder| FolderInfo {
            id: folder.id,
            name: folder.name,
            parent_id: folder.parent_id,
            path: folder.path,
            doc_count: folder.doc_count,
            created_at: folder.created_at,
        }).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(
    name: String,
    parent_id: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<FolderInfo, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.create_folder(&name, parent_id.as_deref())
        .map(|folder| FolderInfo {
            id: folder.id,
            name: folder.name,
            parent_id: folder.parent_id,
            path: folder.path,
            doc_count: folder.doc_count,
            created_at: folder.created_at,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_folder(
    folder_id: String,
    new_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.rename_folder(&folder_id, &new_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_folder(
    folder_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.delete_folder(&folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_document(
    doc_id: String,
    folder_id: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    let frame_id = doc_id.parse::<u64>().map_err(|e: std::num::ParseIntError| e.to_string())?;
    kb.move_document_to_folder(frame_id, folder_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_in_folder(
    folder_id: String,
    query: String,
    top_k: Option<usize>,
    mode: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SearchHit>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let top_k = top_k.unwrap_or(10);
    let search_mode = match mode.as_deref() {
        Some("lex") => SearchMode::Lexical,
        Some("sem") => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    };

    kb.search_in_folder(&folder_id, &query, top_k, search_mode)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_document_tags(
    doc_id: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    let frame_id = doc_id.parse::<u64>().map_err(|e: std::num::ParseIntError| e.to_string())?;
    kb.update_frame_tags(frame_id, tags).map_err(|e| e.to_string())?;
    kb.commit().map_err(|e| e.to_string())
}

// ── Screenshot OCR Commands ────────────────────────────────────────────

#[tauri::command]
pub fn ocr_image(image_data: String, language: Option<String>) -> clawkb_core::ocr::OcrResult {
    clawkb_core::ocr::ocr_image(&image_data, language.as_deref())
}

#[tauri::command]
pub fn test_ocr() -> Result<String, String> {
    clawkb_core::ocr::test_ocr().map_err(|e| e.to_string())?;
    Ok("ok".to_string())
}

#[tauri::command]
pub fn import_screenshot(
    image_data: String,
    title: String,
    tags: Vec<String>,
    language: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ImportResult, String> {
    let ocr_result = clawkb_core::ocr::ocr_image(&image_data, language.as_deref());

    if !ocr_result.success {
        return Err(ocr_result.error.unwrap_or_else(|| "OCR failed".to_string()));
    }

    if ocr_result.text.trim().is_empty() {
        return Err("No text found in image".to_string());
    }

    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let mut all_tags: Vec<&str> = vec!["screenshot", "ocr"];
    all_tags.extend(tags.iter().map(|s| s.as_str()));

    let doc_title = if title.is_empty() {
        format!("Screenshot {}", chrono::Local::now().format("%Y-%m-%d %H:%M"))
    } else {
        title
    };

    let doc_id = kb.add_note(&doc_title, &ocr_result.text, &all_tags)
        .map_err(|e| e.to_string())?;

    tracing::info!(
        "Screenshot imported: {} ({} chars extracted)",
        doc_id,
        ocr_result.text.len()
    );

    Ok(ImportResult {
        path: format!("screenshot:{}", doc_id),
        title: doc_title,
        chunks: 1,
        tags: all_tags.into_iter().map(String::from).collect(),
        auto_tags: vec![],
        success: true,
        error: None,
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ObsidianImportStats {
    #[serde(rename = "imported")]
    pub imported: usize,
    #[serde(rename = "skipped")]
    pub skipped: usize,
    #[serde(rename = "errors")]
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn scan_obsidian_vault(vault_path: String) -> Result<VaultSummary, String> {
    let path = std::path::Path::new(&vault_path);
    if !path.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }
    if !path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", vault_path));
    }
    clawkb_core::sync::scan_vault(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_obsidian_vault(
    vault_path: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ObsidianImportStats, String> {
    let path = std::path::Path::new(&vault_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Invalid vault path: {}", vault_path));
    }

    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let notes = clawkb_core::sync::parse_vault(path);
    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();

    for note in notes {
        let mut all_tags: Vec<&str> = note.tags.iter().map(|s| s.as_str()).collect();
        all_tags.extend(tags_ref.iter().copied());

        match kb.add_note(&note.title, &note.content, &all_tags) {
            Ok(_) => imported += 1,
            Err(e) => {
                errors.push(format!("{}: {}", note.path, e));
                skipped += 1;
            }
        }
    }

    tracing::info!(
        "Obsidian vault import complete: {} imported, {} skipped, {} errors",
        imported,
        skipped,
        errors.len()
    );

    Ok(ObsidianImportStats {
        imported,
        skipped,
        errors,
    })
}

// ── Selection AI Commands ──────────────────────────────────────────────

#[tauri::command]
pub fn selection_ai(action: String, text: String) -> clawkb_core::selection::SelectionResult {
    clawkb_core::selection::selection_ai(&action, &text)
}

// ── WebDAV Sync Commands ─────────────────────────────────────────────────

#[tauri::command]
pub fn webdav_test_connection(config: WebdavConfig) -> Result<WebdavServerInfo, String> {
    wb_test(&config)
}

#[tauri::command]
pub fn webdav_list_remote(config: WebdavConfig, remote_dir: Option<String>) -> Result<Vec<RemoteFile>, String> {
    wb_list(&config, remote_dir.as_deref())
}

#[tauri::command]
pub fn webdav_save_config(
    config: WebdavConfig,
    kb_path: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.webdav_config = Some(config);
    app_state.webdav_kb_path = kb_path;
    app_state.webdav_sync_status = Some(SyncStatus {
        last_sync: None,
        remote_count: 0,
        local_count: 0,
        pending_uploads: 0,
        pending_downloads: 0,
        last_error: None,
        uploads: vec![],
        downloads: vec![],
        skipped: vec![],
    });
    tracing::info!("WebDAV config saved");
    Ok(())
}

#[tauri::command]
pub fn webdav_get_config(state: State<'_, Mutex<AppState>>) -> Result<Option<WebdavConfig>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    Ok(app_state.webdav_config.clone())
}

#[tauri::command]
pub fn webdav_sync_kb(
    state: State<'_, Mutex<AppState>>,
) -> Result<SyncStatus, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let config = app_state.webdav_config.as_ref()
        .ok_or("WebDAV not configured — please save config first")?;
    let kb_path = app_state.webdav_kb_path.as_ref()
        .ok_or("No knowledge base path set for WebDAV sync")?;

    let kb_dir = PathBuf::from(kb_path);
    if !kb_dir.exists() {
        return Err(format!("KB directory not found: {}", kb_path));
    }

    // Use incremental sync
    let manifest = app_state.webdav_manifest.clone().unwrap_or_default();
    let result = wb_incremental_sync(config, &kb_dir, &manifest)?;

    // Update manifest with sync results
    let now = chrono::Utc::now().timestamp();
    let mut updated_manifest = manifest;
    for filename in &result.uploads {
        if let Ok(meta) = std::fs::metadata(kb_dir.join(filename)) {
            let mtime = meta.modified()
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64)
                .unwrap_or(now);
            updated_manifest.files.insert(filename.clone(), FileSyncMeta {
                local_mtime: mtime,
                local_size: meta.len(),
                remote_mtime: Some(now),
                remote_size: Some(meta.len()),
                last_action: Some("upload".to_string()),
                last_sync_ts: Some(now),
            });
        }
    }
    for filename in &result.downloads {
        updated_manifest.files.insert(filename.clone(), FileSyncMeta {
            local_mtime: now,
            local_size: 0,
            remote_mtime: Some(now),
            remote_size: Some(0),
            last_action: Some("download".to_string()),
            last_sync_ts: Some(now),
        });
    }
    updated_manifest.last_full_sync = Some(now);

    let status = SyncStatus {
        last_sync: Some(now),
        remote_count: result.total_files.saturating_sub(result.uploads.len()),
        local_count: result.total_files.saturating_sub(result.downloads.len()),
        pending_uploads: result.uploads.len(),
        pending_downloads: result.downloads.len(),
        last_error: if result.errors.is_empty() { None } else { Some(result.errors.join("; ")) },
        uploads: result.uploads,
        downloads: result.downloads,
        skipped: result.skipped,
    };

    app_state.webdav_manifest = Some(updated_manifest);
    app_state.webdav_sync_status = Some(status.clone());
    Ok(status)
}

#[tauri::command]
pub fn webdav_get_sync_status(state: State<'_, Mutex<AppState>>) -> Result<Option<SyncStatus>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    Ok(app_state.webdav_sync_status.clone())
}

#[tauri::command]
pub fn webdav_clear_config(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.webdav_config = None;
    app_state.webdav_kb_path = None;
    app_state.webdav_sync_status = None;
    tracing::info!("WebDAV config cleared");
    Ok(())
}

// ── Tag Management Commands ──────────────────────────────────────────────

#[tauri::command]
pub fn rename_tag(
    old_tag: String,
    new_tag: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::kb::TagOperationResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.rename_tag(&old_tag, &new_tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn merge_tag(
    source_tag: String,
    dest_tag: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::kb::TagOperationResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.merge_tag(&source_tag, &dest_tag).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_tag(
    tag: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::kb::TagOperationResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.delete_tag(&tag).map_err(|e| e.to_string())
}

// ── Time Machine Comparison Commands ──────────────────────────────────────

#[tauri::command]
pub fn compare_timeline(
    query: String,
    earlier_ts: i64,
    later_ts: i64,
    top_k: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::replay::CompareResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.compare_as_of(&query, earlier_ts, later_ts, top_k.unwrap_or(20))
        .map_err(|e| e.to_string())
}

// ── Note Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_note(
    note_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::note::NoteRecord, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.get_note_record(&note_id)
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn list_notes(
    tag: Option<String>,
    limit: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<clawkb_core::note::NoteRecord>, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.list_note_records(tag.as_deref(), limit.unwrap_or(100))
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn rename_note(
    note_id: String,
    new_title: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::note::NoteRecord, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    let note_path = kb.get_note_record(&note_id)
        .map_err(|e| user_facing_command_error(e.to_string()))?
        .path;
    kb.rename_note_record(&note_id, &new_title, note_path)
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn delete_note(
    note_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.delete_note_record(&note_id)
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn update_note(
    note_id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    state: State<'_, Mutex<AppState>>,
) -> Result<clawkb_core::note::NoteRecord, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    let title_ref = title.as_deref();
    let content_ref = content.as_deref();
    let tags_ref = tags.map(|v| v.into_iter().map(|s| s.leak()).collect());
    kb.update_note_record(note_id.as_str(), title_ref, content_ref, tags_ref)
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn resolve_note_link(
    query: String,
    limit: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<clawkb_core::search::SearchHit>, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.resolve_note_link(&query, limit.unwrap_or(10))
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn list_backlinks(
    note_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<clawkb_core::kb::BacklinkEntry>, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.list_backlinks(&note_id)
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn backfill_registry(
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.backfill_registry()
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn list_folders_fast(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<FolderIndexEntry>, String> {
    let app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;
    Ok(kb.list_folders_fast())
}

#[tauri::command]
pub fn get_note_by_path(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<NoteIndexEntry>, String> {
    let app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;
    Ok(kb.get_note_by_path(&path).cloned())
}

#[tauri::command]
pub fn tag_counts(
    state: State<'_, Mutex<AppState>>,
) -> Result<std::collections::HashMap<String, usize>, String> {
    let app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;
    Ok(kb.tag_counts())
}

#[tauri::command]
pub fn sync_note_links(
    note_id: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.sync_note_links(&note_id)
        .map_err(|e| user_facing_command_error(e.to_string()))
}

#[tauri::command]
pub fn backfill_all_links(
    state: State<'_, Mutex<AppState>>,
) -> Result<usize, String> {
    let mut app_state = state.lock().map_err(|e| user_facing_command_error(e.to_string()))?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    let notes = kb.list_note_records(None, 10000)
        .map_err(|e| user_facing_command_error(e.to_string()))?;
    let mut count = 0;
    for note in notes {
        if kb.sync_note_links(&note.id).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}
