use tauri::command;
use std::fs;
use std::path::Path;

#[command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[command]
pub fn get_directory_contents(path: String, workspace_root: String) -> Result<Vec<FileEntry>, String> {
    let req_path = Path::new(&path);
    let root_path = Path::new(&workspace_root);

    // Sécurité : s'assurer que le chemin demandé est dans le workspace
    let canonical_path = req_path.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Path is outside workspace".to_string());
    }

    let ignored = ["node_modules", ".git", "target", ".trellis"];

    let read_dir = fs::read_dir(&canonical_path).map_err(|e| e.to_string())?;

    let mut entries: Vec<FileEntry> = read_dir
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            !ignored.contains(&name_str.as_ref())
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            FileEntry { name, path, is_dir }
        })
        .collect();

    // Tri : dossiers en premier, puis fichiers, ordre alphabétique
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_read_write_roundtrip() {
        let path = std::env::temp_dir().join("ws_code_widget_test.txt");
        let content = "hello workspace\nline 2";
        write_file(path.to_str().unwrap().to_string(), content.to_string()).unwrap();
        let read = read_file(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(read, content);
        fs::remove_file(&path).unwrap();
    }

    #[test]
    fn test_read_missing_file_returns_err() {
        let result = read_file("/tmp/ws_nonexistent_xyz_123.txt".to_string());
        assert!(result.is_err());
    }
}
