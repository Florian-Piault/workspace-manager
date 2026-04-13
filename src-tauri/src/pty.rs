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
    shell_pid: Option<u32>,
}

pub struct PtyManager(pub Mutex<HashMap<String, PtyHandle>>);

impl PtyManager {
    pub fn new() -> Self {
        PtyManager(Mutex::new(HashMap::new()))
    }
}

#[tauri::command]
pub fn pty_get_scrollback(id: String, manager: State<PtyManager>) -> Result<String, String> {
    let map = manager.0.lock().unwrap();
    if let Some(handle) = map.get(&id) {
        let sb = handle.scrollback.lock().unwrap();
        Ok(STANDARD.encode(&*sb))
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
pub fn pty_create(
    id: String,
    cwd: String,
    shell: Option<String>,
    shell_args: Option<String>,
    app: AppHandle,
    manager: State<PtyManager>,
) -> Result<String, String> {
    // PTY déjà existant — remount suite à un split, ne pas recréer
    if manager.0.lock().unwrap().contains_key(&id) {
        return Ok(id);
    }

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let resolved_shell = shell.filter(|s| !s.is_empty()).unwrap_or_else(|| {
        #[cfg(target_os = "windows")]
        { std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()) }
        #[cfg(not(target_os = "windows"))]
        { std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string()) }
    });

    let mut cmd = CommandBuilder::new(&resolved_shell);
    if let Some(args_str) = shell_args.filter(|s| !s.is_empty()) {
        for arg in args_str.split_whitespace() {
            cmd.arg(arg);
        }
    }
    cmd.cwd(cwd.trim_matches('\0'));

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let shell_pid = child.process_id();
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
            shell_pid,
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

#[tauri::command]
pub fn pty_fg_process(id: String, manager: State<PtyManager>) -> Result<String, String> {
    let map = manager.0.lock().unwrap();
    let shell_pid = map
        .get(&id)
        .and_then(|h| h.shell_pid)
        .ok_or_else(|| "PTY not found or no PID".to_string())?;

    #[cfg(unix)]
    {
        fn clean_name(raw: &str) -> String {
            let base = std::path::Path::new(raw.trim())
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| raw.trim().to_string());
            // Les login-shells ont un `-` devant (ex: -zsh → zsh)
            base.trim_start_matches('-').to_string()
        }

        // Cherche le processus de premier plan : dernier enfant direct du shell
        let children = std::process::Command::new("pgrep")
            .args(["-P", &shell_pid.to_string()])
            .output();

        if let Ok(out) = children {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(child_pid) = stdout.lines().last().map(|l| l.trim()) {
                if !child_pid.is_empty() {
                    let name_out = std::process::Command::new("ps")
                        .args(["-p", child_pid, "-o", "comm="])
                        .output();
                    if let Ok(o) = name_out {
                        let name = clean_name(&String::from_utf8_lossy(&o.stdout));
                        if !name.is_empty() {
                            return Ok(name);
                        }
                    }
                }
            }
        }

        // Fallback : nom du shell lui-même
        let out = std::process::Command::new("ps")
            .args(["-p", &shell_pid.to_string(), "-o", "comm="])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(clean_name(&String::from_utf8_lossy(&out.stdout)))
    }

    #[cfg(windows)]
    {
        Ok(String::new())
    }
}

#[derive(serde::Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn list_shells() -> Vec<ShellInfo> {
    #[cfg(unix)]
    {
        use std::path::Path;

        let mut shells: Vec<ShellInfo> = Vec::new();
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

        // Lecture de /etc/shells
        if let Ok(content) = std::fs::read_to_string("/etc/shells") {
            for line in content.lines() {
                let path = line.trim();
                if path.starts_with('/') && Path::new(path).exists() && seen.insert(path.to_string()) {
                    let name = Path::new(path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| path.to_string());
                    shells.push(ShellInfo { name, path: path.to_string() });
                }
            }
        }

        // Chemins supplémentaires (homebrew, nix, etc.) pour fish, nu, nushell
        let extra_paths = [
            "/opt/homebrew/bin/fish",
            "/usr/local/bin/fish",
            "/opt/homebrew/bin/nu",
            "/usr/local/bin/nu",
            "/usr/bin/fish",
            "/usr/bin/nu",
        ];
        for path in extra_paths {
            if Path::new(path).exists() && seen.insert(path.to_string()) {
                let name = Path::new(path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| path.to_string());
                shells.push(ShellInfo { name, path: path.to_string() });
            }
        }

        shells
    }

    #[cfg(windows)]
    {
        use std::path::Path;

        let candidates = [
            ("cmd", r"C:\Windows\System32\cmd.exe"),
            ("PowerShell", r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"),
            ("PowerShell Core (pwsh)", r"C:\Program Files\PowerShell\7\pwsh.exe"),
            ("WSL", r"C:\Windows\System32\wsl.exe"),
            ("Git Bash", r"C:\Program Files\Git\bin\bash.exe"),
        ];

        candidates
            .iter()
            .filter(|(_, path)| Path::new(path).exists())
            .map(|(name, path)| ShellInfo {
                name: name.to_string(),
                path: path.to_string(),
            })
            .collect()
    }
}
