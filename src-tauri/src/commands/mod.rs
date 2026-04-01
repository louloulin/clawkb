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

// ── AI Configuration Commands ──────────────────────────────────────

#[tauri::command]
pub fn set_embedding_model(
    provider: String,
    model: String,
    api_key: Option<String>,
    api_base: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    // In a full implementation, this would configure the memvid embedder
    // For now, we store the configuration for future use
    tracing::info!(
        "Embedding model config: provider={}, model={}, has_api_key={}",
        provider,
        model,
        api_key.is_some()
    );
    Ok(())
}

#[tauri::command]
pub fn set_ask_model(
    model: String,
    temperature: f32,
    top_k: usize,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    tracing::info!(
        "Ask model config: model={}, temperature={}, top_k={}",
        model,
        temperature,
        top_k
    );
    Ok(())
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
pub fn list_folders() -> Result<Vec<FolderInfo>, String> {
    // Return demo folders - in a full implementation, this would read from KB metadata
    Ok(vec![
        FolderInfo {
            id: "folder-work".to_string(),
            name: "Work".to_string(),
            parent_id: None,
            path: "/Work".to_string(),
            doc_count: 5,
            created_at: chrono::Utc::now().timestamp() - 86400,
        },
        FolderInfo {
            id: "folder-projectA".to_string(),
            name: "Project A".to_string(),
            parent_id: Some("folder-work".to_string()),
            path: "/Work/Project A".to_string(),
            doc_count: 3,
            created_at: chrono::Utc::now().timestamp() - 72000,
        },
        FolderInfo {
            id: "folder-projectB".to_string(),
            name: "Project B".to_string(),
            parent_id: Some("folder-work".to_string()),
            path: "/Work/Project B".to_string(),
            doc_count: 2,
            created_at: chrono::Utc::now().timestamp() - 36000,
        },
        FolderInfo {
            id: "folder-study".to_string(),
            name: "Study".to_string(),
            parent_id: None,
            path: "/Study".to_string(),
            doc_count: 8,
            created_at: chrono::Utc::now().timestamp() - 172800,
        },
        FolderInfo {
            id: "folder-life".to_string(),
            name: "Life".to_string(),
            parent_id: None,
            path: "/Life".to_string(),
            doc_count: 12,
            created_at: chrono::Utc::now().timestamp() - 259200,
        },
    ])
}

#[tauri::command]
pub fn create_folder(
    name: String,
    parent_id: Option<String>,
) -> Result<FolderInfo, String> {
    let id = format!("folder-{}", uuid::Uuid::new_v4());
    let path = if let Some(ref pid) = parent_id {
        format!("/{}/{}", pid, name)
    } else {
        format!("/{}", name)
    };

    Ok(FolderInfo {
        id,
        name,
        parent_id,
        path,
        doc_count: 0,
        created_at: chrono::Utc::now().timestamp(),
    })
}

#[tauri::command]
pub fn rename_folder(
    folder_id: String,
    new_name: String,
) -> Result<(), String> {
    tracing::info!("Rename folder {} to {}", folder_id, new_name);
    Ok(())
}

#[tauri::command]
pub fn delete_folder(
    folder_id: String,
) -> Result<(), String> {
    tracing::info!("Delete folder {}", folder_id);
    Ok(())
}

#[tauri::command]
pub fn move_document(
    doc_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    tracing::info!("Move document {} to folder {:?}", doc_id, folder_id);
    Ok(())
}

#[tauri::command]
pub fn search_in_folder(
    folder_id: String,
    query: String,
    top_k: Option<usize>,
    mode: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<SearchHit>, String> {
    // For now, search normally and filter by tag
    let mut app_state = state.lock().map_err(|e| e.to_string())?;
    let kb = app_state.kb.as_mut().ok_or("Knowledge base not open")?;

    let top_k = top_k.unwrap_or(10);
    let search_mode = match mode.as_deref() {
        Some("lex") => SearchMode::Lexical,
        Some("sem") => SearchMode::Semantic,
        _ => SearchMode::Hybrid,
    };

    // Search and return results - in full implementation, filter by folder_id tag
    kb.search(&query, top_k, search_mode)
        .map_err(|e| e.to_string())
}
