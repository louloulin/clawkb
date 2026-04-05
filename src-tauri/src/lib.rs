mod commands;

use commands::AppState;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Mutex::new(AppState::default()))
        .setup(|app| {
            // Set up system tray
            let show_item = MenuItem::with_id(app, "show", "Open ClawKB", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ClawKB — Local-first AI Knowledge Base")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Register global shortcut Cmd+Shift+K (macOS) / Ctrl+Shift+K (Windows/Linux)
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState, ShortcutEvent};

                let shortcut_str = if cfg!(target_os = "macos") {
                    "CmdOrCtrl+Shift+K"
                } else {
                    "Ctrl+Shift+K"
                };

                if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                    let handle = app.handle().clone();
                    app.handle().plugin(
                        tauri_plugin_global_shortcut::Builder::new()
                            .with_handler(move |_app, _shortcut, event: ShortcutEvent| {
                                if event.state() == ShortcutState::Pressed {
                                    // Emit event to frontend to show floating window
                                    if let Some(window) = handle.get_webview_window("main") {
                                        let _ = window.emit("global-shortcut", ());
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            })
                            .build(),
                    ).ok();

                    app.global_shortcut().register(shortcut).ok();
                }
            }

            Ok(())
        })
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
            commands::test_llm,
            commands::import_audio,
            commands::import_image,
            commands::search_with_graph,
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
            commands::move_document,
            commands::search_in_folder,
            commands::scan_obsidian_vault,
            commands::import_obsidian_vault,
            commands::ocr_image,
            commands::test_ocr,
            commands::import_screenshot,
            commands::selection_ai,
            commands::rename_tag,
            commands::merge_tag,
            commands::delete_tag,
            commands::compare_timeline,
            commands::webdav_test_connection,
            commands::webdav_list_remote,
            commands::webdav_save_config,
            commands::webdav_get_config,
            commands::webdav_sync_kb,
            commands::webdav_get_sync_status,
            commands::webdav_clear_config,
            commands::open_extra_kb,
            commands::close_extra_kb,
            commands::list_open_kbs,
            commands::search_multi_kb,
            commands::ai_ask_multi,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClawKB");
}
