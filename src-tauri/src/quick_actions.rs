use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct ProcessManager(pub Arc<Mutex<HashMap<String, u32>>>);

impl ProcessManager {
    pub fn new() -> Self {
        ProcessManager(Arc::new(Mutex::new(HashMap::new())))
    }
}

fn validate_command(command: &str) -> Result<(), String> {
    if command.is_empty() {
        return Err("La commande ne peut pas être vide.".into());
    }
    if command.contains('\0') {
        return Err("Commande invalide : caractère nul interdit.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn qa_execute(
    id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    app: AppHandle,
    manager: State<ProcessManager>,
) -> Result<(), String> {
    validate_command(&command)?;

    for arg in &args {
        if arg.contains('\0') {
            return Err("Argument invalide : caractère nul interdit.".into());
        }
    }

    // Refus de relancer un processus déjà actif
    if manager.0.lock().unwrap().contains_key(&id) {
        return Err("Un processus est déjà actif pour cette action.".into());
    }

    let mut child = std::process::Command::new(&command)
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Impossible de lancer '{}' : {}", command, e))?;

    let pid = child.id();
    let pids = manager.0.clone();
    pids.lock().unwrap().insert(id.clone(), pid);

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Thread stdout
    {
        let app = app.clone();
        let id = id.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().flatten() {
                let _ = app.emit(&format!("qa_log:{id}"), &line);
            }
        });
    }

    // Thread stderr
    {
        let app = app.clone();
        let id = id.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().flatten() {
                let _ = app.emit(&format!("qa_log:{id}"), &line);
            }
        });
    }

    // Thread wait → émet qa_exit avec le code de retour
    {
        let pids = manager.0.clone();
        let app = app.clone();
        let id = id.clone();
        std::thread::spawn(move || {
            let exit_code = child
                .wait()
                .map(|s| s.code().unwrap_or(-1))
                .unwrap_or(-1);
            pids.lock().unwrap().remove(&id);
            let _ = app.emit(&format!("qa_exit:{id}"), exit_code);
        });
    }

    Ok(())
}

#[tauri::command]
pub fn qa_kill(id: String, manager: State<ProcessManager>) -> Result<(), String> {
    let pid = manager.0.lock().unwrap().remove(&id);
    if let Some(pid) = pid {
        #[cfg(unix)]
        unsafe {
            libc::kill(pid as libc::pid_t, libc::SIGTERM);
        }
        #[cfg(windows)]
        {
            std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .status()
                .ok();
        }
    }
    Ok(())
}
