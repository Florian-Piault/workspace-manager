use base64::{engine::general_purpose::STANDARD, Engine};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct PtyHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    scrollback: Arc<Mutex<Vec<u8>>>,
}

pub struct PtyManager(pub Mutex<HashMap<String, PtyHandle>>);

impl PtyManager {
    pub fn new() -> Self {
        PtyManager(Mutex::new(HashMap::new()))
    }
}

#[tauri::command]
pub fn pty_create(
    id: String,
    cwd: String,
    app: AppHandle,
    manager: State<PtyManager>,
) -> Result<String, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let scrollback: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
    let scrollback_clone = Arc::clone(&scrollback);
    let event_id = id.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    let _ = app_clone.emit(&format!("pty_exit:{}", event_id), ());
                    break;
                }
                Ok(n) => {
                    let chunk = &buf[..n];
                    {
                        let mut sb = match scrollback_clone.lock() {
                            Ok(guard) => guard,
                            Err(e) => e.into_inner(),
                        };
                        sb.extend_from_slice(chunk);
                        if sb.len() > 51_200 {
                            let excess = sb.len() - 51_200;
                            // Trouver la frontière UTF-8 valide la plus proche après `excess`
                            let mut drain_to = excess;
                            while drain_to < sb.len() && (sb[drain_to] & 0xC0) == 0x80 {
                                drain_to += 1;
                            }
                            sb.drain(..drain_to);
                        }
                    }
                    let data = String::from_utf8_lossy(chunk).to_string();
                    let _ = app_clone.emit(&format!("pty_data:{}", event_id), data);
                }
            }
        }
    });

    manager.0.lock().unwrap().insert(
        id.clone(),
        PtyHandle {
            writer,
            master: pair.master,
            _child: child,
            scrollback,
        },
    );

    Ok(id)
}

#[tauri::command]
pub fn pty_write(id: String, data: String, manager: State<PtyManager>) -> Result<(), String> {
    let mut map = manager.0.lock().unwrap();
    if let Some(handle) = map.get_mut(&id) {
        handle
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    manager: State<PtyManager>,
) -> Result<(), String> {
    let map = manager.0.lock().unwrap();
    if let Some(handle) = map.get(&id) {
        handle
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_kill(id: String, manager: State<PtyManager>) -> Result<String, String> {
    let handle = manager.0.lock().unwrap().remove(&id);
    if let Some(handle) = handle {
        let sb = handle.scrollback.lock().unwrap();
        Ok(STANDARD.encode(&*sb))
    } else {
        Ok(String::new())
    }
}
