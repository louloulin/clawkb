mod commands;

use commands::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            commands::create_kb,
            commands::open_kb,
            commands::close_kb,
            commands::search_kb,
            commands::add_note,
            commands::import_file,
            commands::import_directory,
            commands::timeline_kb,
            commands::get_stats,
            commands::commit_kb,
            commands::list_tags,
            commands::export_kb,
            commands::fetch_url,
            commands::ai_ask,
            commands::ai_ask_context,
            commands::ask_document,
            commands::list_entities,
            commands::get_entity,
            commands::traverse_graph,
            commands::get_mesh_stats,
            commands::list_memories,
            commands::set_embedding_model,
            commands::set_ask_model,
            commands::import_audio,
            commands::import_image,
            commands::search_with_graph,
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
            commands::move_document,
            commands::search_in_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClawKB");
}
