use std::sync::Mutex;
use tauri::State;

use clawkb_core::kb::KbStats;
use clawkb_core::search::{SearchHit, SearchMode};
use clawkb_core::tag::TagInfo;
use clawkb_core::timeline::{TimelineEntry, TimelineQuery};
use clawkb_core::import::ImportResult;
use clawkb_core::export::{ExportFormat, export_to_string};
use clawkb_core::web::FetchUrlResult;
use clawkb_core::ask::AskResult;
use clawkb_core::entity::{EntityInfo, RelationEdge, TraverseResult, MeshStats, MemoryCardInfo};
use clawkb_core::KnowledgeBase;

pub struct AppState {
    kb: Option<KnowledgeBase>,
}

impl Default for AppState {
    fn default() -> Self {
        Self { kb: None }
    }
}

#[tauri::command]
pub fn create_kb(path: String, state: State<'_, Mutex<AppState>>) -> Result<KbStats, String> {
    let kb = KnowledgeBase::create(&path).map_err(|e| e.to_string())?;
    let stats = kb.stats().map_err(|e| e.to_string())?;
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.kb = Some(kb);
    Ok(stats)
}

#[tauri::command]
pub fn open_kb(path: String, state: State<'_, Mutex<AppState>>) -> Result<KbStats, String> {
    let kb = KnowledgeBase::open(&path).map_err(|e| e.to_string())?;
    let stats = kb.stats().map_err(|e| e.to_string())?;
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
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
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let top_k = top_k.unwrap_or(5);
    let search_mode = match mode.as_deref() {
        Some("lex") => SearchMode::Lexical,
        Some("sem") => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    };

    kb.search(&query, top_k, search_mode).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_note(
    title: String,
    content: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.add_note(&title, &content, &tags_ref).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_file(
    path: String,
    tags: Vec<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<ImportResult, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.import_file(&path, &tags_ref).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_directory(
    dir_path: String,
    tags: Vec<String>,
    recursive: Option<bool>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ImportResult>, String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let tags_ref: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();
    kb.import_directory(&dir_path, &tags_ref, recursive.unwrap_or(false))
        .map_err(|e| e.to_string())
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
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_ref().ok_or("Knowledge base not open")?;
    kb.stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn commit_kb(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;
    kb.commit().map_err(|e| e.to_string())
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
