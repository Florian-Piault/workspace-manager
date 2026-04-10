use std::fs;
use std::path::Path;

#[derive(serde::Serialize, Clone)]
pub struct DetectedAction {
    pub id: String,
    pub source: String,
    pub label: String,
    pub command: String,
    pub icon: String,
}

/// Detect the package manager by checking lock files.
fn detect_package_manager(workspace: &Path) -> &'static str {
    if workspace.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if workspace.join("bun.lockb").exists() {
        "bun"
    } else {
        "npm"
    }
}

/// Parse package.json scripts.
fn scan_package_json(workspace: &Path) -> Vec<DetectedAction> {
    let path = workspace.join("package.json");
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    let scripts = match json.get("scripts").and_then(|s| s.as_object()) {
        Some(s) => s,
        None => return vec![],
    };

    let pm = detect_package_manager(workspace);

    scripts
        .keys()
        .filter(|key| !key.starts_with("pre") && !key.starts_with("post"))
        .map(|key| {
            let command = format!("{pm} run {key}");
            DetectedAction {
                id: format!("package.json:{key}"),
                source: "package.json".into(),
                label: key.clone(),
                command,
                icon: pm.into(),
            }
        })
        .collect()
}

/// Parse Makefile targets.
/// Matches lines like `target-name:` but not `VAR := value` or `VAR: = value`.
fn scan_makefile(workspace: &Path) -> Vec<DetectedAction> {
    let path = workspace.join("Makefile");
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    fn is_target_char(c: char) -> bool {
        c.is_ascii_alphanumeric() || c == '_' || c == '-'
    }

    content
        .lines()
        .filter_map(|line| {
            // Line must start with a valid target character (no leading whitespace)
            if line.is_empty() || !is_target_char(line.chars().next()?) {
                return None;
            }
            let colon_pos = line.find(':')?;
            let name = &line[..colon_pos];
            // All chars before colon must be valid target chars
            if !name.chars().all(is_target_char) || name.is_empty() {
                return None;
            }
            // After colon, must not start with `=` (that would be `:=` assignment)
            let after = line[colon_pos + 1..].trim_start();
            if after.starts_with('=') {
                return None;
            }
            let label = name.to_string();
            Some(DetectedAction {
                id: format!("Makefile:{label}"),
                source: "Makefile".into(),
                command: format!("make {label}"),
                label,
                icon: "make".into(),
            })
        })
        .collect()
}

/// Parse docker-compose.yml services (simple line-by-line parser).
fn scan_docker_compose(workspace: &Path) -> Vec<DetectedAction> {
    // Try both common filenames
    let path = if workspace.join("docker-compose.yml").exists() {
        workspace.join("docker-compose.yml")
    } else if workspace.join("docker-compose.yaml").exists() {
        workspace.join("docker-compose.yaml")
    } else if workspace.join("compose.yml").exists() {
        workspace.join("compose.yml")
    } else if workspace.join("compose.yaml").exists() {
        workspace.join("compose.yaml")
    } else {
        return vec![];
    };

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let source = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut results = vec![];
    let mut in_services = false;
    let mut services_indent: Option<usize> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Detect top-level `services:` key
        if trimmed == "services:" {
            in_services = true;
            services_indent = None;
            continue;
        }

        if in_services {
            let indent = line.len() - line.trim_start().len();

            // First indented line under services: sets the service indent level
            if services_indent.is_none() && indent > 0 {
                services_indent = Some(indent);
            }

            if let Some(svc_indent) = services_indent {
                // If we hit a line with no indent, we left the services block
                if indent == 0 {
                    in_services = false;
                    continue;
                }

                // Service-level entry: exact indent match and ends with ':'
                if indent == svc_indent {
                    if let Some(label) = trimmed.strip_suffix(':') {
                        let label = label.trim().to_string();
                        results.push(DetectedAction {
                            id: format!("{source}:{label}"),
                            source: source.clone(),
                            command: format!("docker-compose up {label}"),
                            label,
                            icon: "docker".into(),
                        });
                    }
                }
            }
        }
    }

    results
}

/// Parse Cargo.toml for [[bin]] targets and [alias] entries (simple line-by-line).
fn scan_cargo_toml(workspace: &Path) -> Vec<DetectedAction> {
    let path = workspace.join("Cargo.toml");
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut results = vec![];

    #[derive(PartialEq)]
    enum Section {
        None,
        Bin,
        Alias,
    }

    let mut current_section = Section::None;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "[[bin]]" {
            current_section = Section::Bin;
            continue;
        }
        if trimmed == "[alias]" {
            current_section = Section::Alias;
            continue;
        }
        // Any other section header resets
        if trimmed.starts_with('[') {
            current_section = Section::None;
            continue;
        }

        match current_section {
            Section::Bin => {
                // Look for name = "something"
                if let Some(rest) = trimmed.strip_prefix("name") {
                    let rest = rest.trim_start();
                    if let Some(rest) = rest.strip_prefix('=') {
                        let name = rest.trim().trim_matches('"').trim_matches('\'');
                        if !name.is_empty() {
                            results.push(DetectedAction {
                                id: format!("Cargo.toml:bin:{name}"),
                                source: "Cargo.toml".into(),
                                label: name.to_string(),
                                command: format!("cargo run --bin {name}"),
                                icon: "cargo".into(),
                            });
                        }
                    }
                }
            }
            Section::Alias => {
                // Look for alias_name = "..."
                if let Some(eq_pos) = trimmed.find('=') {
                    let key = trimmed[..eq_pos].trim();
                    if !key.is_empty() && !key.starts_with('#') {
                        results.push(DetectedAction {
                            id: format!("Cargo.toml:alias:{key}"),
                            source: "Cargo.toml".into(),
                            label: key.to_string(),
                            command: format!("cargo {key}"),
                            icon: "cargo".into(),
                        });
                    }
                }
            }
            Section::None => {}
        }
    }

    results
}

/// Scan scripts/ directory for .sh, .py, .js files.
fn scan_scripts_dir(workspace: &Path) -> Vec<DetectedAction> {
    let scripts_dir = workspace.join("scripts");
    let entries = match fs::read_dir(&scripts_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut results = vec![];
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if !["sh", "py", "js"].contains(&ext.as_str()) {
            continue;
        }
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        results.push(DetectedAction {
            id: format!("scripts:{filename}"),
            source: "scripts".into(),
            label: filename.clone(),
            command: format!("./scripts/{filename}"),
            icon: "shell".into(),
        });
    }

    results.sort_by(|a, b| a.label.cmp(&b.label));
    results
}

#[tauri::command]
pub fn scan_workspace_actions(workspace_path: String) -> Result<Vec<DetectedAction>, String> {
    let workspace = Path::new(&workspace_path);
    if !workspace.is_dir() {
        return Err(format!(
            "Le chemin '{}' n'est pas un dossier valide.",
            workspace_path
        ));
    }

    let mut actions = vec![];
    actions.extend(scan_package_json(workspace));
    actions.extend(scan_makefile(workspace));
    actions.extend(scan_docker_compose(workspace));
    actions.extend(scan_cargo_toml(workspace));
    actions.extend(scan_scripts_dir(workspace));

    Ok(actions)
}
