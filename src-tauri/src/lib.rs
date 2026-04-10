mod pty;
mod fs;
mod browser;
mod quick_actions;
mod scan_engine;

use pty::PtyManager;
use quick_actions::ProcessManager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "settings",
            sql: include_str!("../migrations/002_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "quick_actions",
            sql: include_str!("../migrations/003_quick_actions.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:workspace.db", migrations)
                .build(),
        )
        .manage(PtyManager::new())
        .manage(ProcessManager::new())
        .invoke_handler(tauri::generate_handler![
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_get_scrollback,
            pty::pty_fg_process,
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
            quick_actions::qa_execute,
            quick_actions::qa_kill,
            scan_engine::scan_workspace_actions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
