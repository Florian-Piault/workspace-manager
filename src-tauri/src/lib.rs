mod pty;
mod fs;
mod browser;

use pty::PtyManager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:workspace.db", migrations)
                .build(),
        )
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_get_scrollback,
            fs::read_file,
            fs::write_file,
            browser::browser_open,
            browser::browser_navigate,
            browser::browser_resize,
            browser::browser_close,
            browser::browser_back,
            browser::browser_forward,
            browser::browser_refresh,
            browser::browser_report_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
