use tauri::command;
use std::fs;
use std::path::Path;
use glob::Pattern;
use trash;

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

fn is_excluded(name: &str, patterns: &[Pattern]) -> bool {
    patterns.iter().any(|p| p.matches(name))
}

#[command]
pub fn get_directory_contents(
    path: String,
    workspace_root: String,
    show_hidden_files: bool,
    exclude_patterns: Vec<String>,
) -> Result<Vec<FileEntry>, String> {
    let req_path = Path::new(&path);
    let root_path = Path::new(&workspace_root);

    let canonical_path = req_path.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Path is outside workspace".to_string());
    }

    let compiled: Vec<Pattern> = exclude_patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    let read_dir = fs::read_dir(&canonical_path).map_err(|e| e.to_string())?;

    let mut entries: Vec<FileEntry> = read_dir
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            if !show_hidden_files && name_str.starts_with('.') {
                return false;
            }
            !is_excluded(&name_str, &compiled)
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path().to_string_lossy().to_string();
            let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            FileEntry { name, path, is_dir }
        })
        .collect();

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[command]
pub fn create_file(path: String, workspace_root: String) -> Result<(), String> {
    let full_path = Path::new(&path);
    let root_path = Path::new(&workspace_root);

    let parent = full_path
        .parent()
        .ok_or_else(|| "Invalid path: no parent directory".to_string())?;

    let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_parent.starts_with(&canonical_root) {
        return Err("Path is outside workspace".to_string());
    }

    let file_name = full_path
        .file_name()
        .ok_or_else(|| "Invalid path: no file name".to_string())?;

    let final_path = canonical_parent.join(file_name);

    if final_path.exists() {
        return Err(format!("File already exists: {}", final_path.display()));
    }

    fs::write(&final_path, "").map_err(|e| e.to_string())
}

#[command]
pub fn create_directory(path: String, workspace_root: String) -> Result<(), String> {
    let full_path = Path::new(&path);
    let root_path = Path::new(&workspace_root);

    let parent = full_path
        .parent()
        .ok_or_else(|| "Invalid path: no parent directory".to_string())?;

    let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_parent.starts_with(&canonical_root) {
        return Err("Path is outside workspace".to_string());
    }

    let dir_name = full_path
        .file_name()
        .ok_or_else(|| "Invalid path: no directory name".to_string())?;

    let final_path = canonical_parent.join(dir_name);

    if final_path.exists() {
        return Err(format!("Directory already exists: {}", final_path.display()));
    }

    fs::create_dir_all(&final_path).map_err(|e| e.to_string())
}

#[command]
pub fn delete_path(path: String, workspace_root: String) -> Result<(), String> {
    let full_path = Path::new(&path);
    let root_path = Path::new(&workspace_root);

    let canonical_path = full_path.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Path is outside workspace".to_string());
    }

    if canonical_path.is_dir() {
        fs::remove_dir_all(&canonical_path).map_err(|e| e.to_string())
    } else {
        trash::delete(&canonical_path).map_err(|e| e.to_string())
    }
}

#[command]
pub fn rename_path(path: String, new_name: String, workspace_root: String) -> Result<String, String> {
    let full_path = Path::new(&path);
    let root_path = Path::new(&workspace_root);

    let parent = full_path
        .parent()
        .ok_or_else(|| "Invalid path: no parent directory".to_string())?;

    let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_parent.starts_with(&canonical_root) {
        return Err("Path is outside workspace".to_string());
    }

    let canonical_source = full_path.canonicalize().map_err(|e| e.to_string())?;
    let new_path = canonical_parent.join(&new_name);

    if new_path.exists() {
        return Err(format!("Name already exists: {}", new_name));
    }

    fs::rename(&canonical_source, &new_path).map_err(|e| e.to_string())?;

    Ok(new_path.to_string_lossy().to_string())
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

    #[test]
    fn test_is_excluded_glob() {
        let patterns: Vec<Pattern> = vec![
            Pattern::new("node_modules").unwrap(),
            Pattern::new("*.lock").unwrap(),
        ];
        assert!(is_excluded("node_modules", &patterns));
        assert!(is_excluded("pnpm.lock", &patterns));
        assert!(!is_excluded("src", &patterns));
    }

    #[test]
    fn test_create_file_and_cleanup() {
        let dir = std::env::temp_dir();
        let file_path = dir.join("ws_create_file_test.txt");
        // Ensure clean state
        let _ = fs::remove_file(&file_path);

        create_file(
            file_path.to_str().unwrap().to_string(),
            dir.to_str().unwrap().to_string(),
        )
        .unwrap();

        assert!(file_path.exists());
        fs::remove_file(&file_path).unwrap();
    }

    #[test]
    fn test_create_file_conflict() {
        let dir = std::env::temp_dir();
        let file_path = dir.join("ws_create_file_conflict.txt");
        fs::write(&file_path, "existing").unwrap();

        let result = create_file(
            file_path.to_str().unwrap().to_string(),
            dir.to_str().unwrap().to_string(),
        );

        assert!(result.is_err());
        fs::remove_file(&file_path).unwrap();
    }

    #[test]
    fn test_create_directory_and_cleanup() {
        let dir = std::env::temp_dir();
        let new_dir = dir.join("ws_create_dir_test");
        let _ = fs::remove_dir_all(&new_dir);

        create_directory(
            new_dir.to_str().unwrap().to_string(),
            dir.to_str().unwrap().to_string(),
        )
        .unwrap();

        assert!(new_dir.is_dir());
        fs::remove_dir_all(&new_dir).unwrap();
    }

    #[test]
    fn test_create_directory_conflict() {
        let dir = std::env::temp_dir();
        let new_dir = dir.join("ws_create_dir_conflict");
        fs::create_dir_all(&new_dir).unwrap();

        let result = create_directory(
            new_dir.to_str().unwrap().to_string(),
            dir.to_str().unwrap().to_string(),
        );

        assert!(result.is_err());
        fs::remove_dir_all(&new_dir).unwrap();
    }

    #[test]
    fn test_delete_path_directory() {
        let dir = std::env::temp_dir();
        let target = dir.join("ws_delete_dir_test");
        fs::create_dir_all(&target).unwrap();

        delete_path(
            target.to_str().unwrap().to_string(),
            dir.to_str().unwrap().to_string(),
        )
        .unwrap();

        assert!(!target.exists());
    }

    #[test]
    fn test_rename_path() {
        let dir = std::env::temp_dir();
        let src = dir.join("ws_rename_src.txt");
        let dst = dir.join("ws_rename_dst.txt");
        let _ = fs::remove_file(&dst);
        fs::write(&src, "rename me").unwrap();

        let new_path = rename_path(
            src.to_str().unwrap().to_string(),
            "ws_rename_dst.txt".to_string(),
            dir.to_str().unwrap().to_string(),
        )
        .unwrap();

        assert!(!src.exists());
        assert!(dst.exists());
        assert_eq!(new_path, dst.canonicalize().unwrap().to_string_lossy());
        fs::remove_file(&dst).unwrap();
    }

    #[test]
    fn test_rename_path_conflict() {
        let dir = std::env::temp_dir();
        let src = dir.join("ws_rename_conflict_src.txt");
        let dst = dir.join("ws_rename_conflict_dst.txt");
        fs::write(&src, "src").unwrap();
        fs::write(&dst, "dst").unwrap();

        let result = rename_path(
            src.to_str().unwrap().to_string(),
            "ws_rename_conflict_dst.txt".to_string(),
            dir.to_str().unwrap().to_string(),
        );

        assert!(result.is_err());
        fs::remove_file(&src).unwrap();
        fs::remove_file(&dst).unwrap();
    }

    #[test]
    fn test_delete_path_file_to_trash() {
        let dir = std::env::temp_dir();
        let target = dir.join("ws_delete_file_trash_test.txt");
        fs::write(&target, "to be trashed").unwrap();

        delete_path(
            target.to_str().unwrap().to_string(),
            dir.to_str().unwrap().to_string(),
        )
        .unwrap();

        assert!(!target.exists());
    }

    #[test]
    fn test_delete_path_outside_workspace_rejected() {
        let workspace = std::env::temp_dir().join("ws_delete_sandbox");
        fs::create_dir_all(&workspace).unwrap();
        let outside = std::env::temp_dir().join("ws_delete_outside.txt");
        fs::write(&outside, "outside").unwrap();

        let result = delete_path(
            outside.to_str().unwrap().to_string(),
            workspace.to_str().unwrap().to_string(),
        );

        assert!(result.is_err());
        fs::remove_file(&outside).unwrap();
        fs::remove_dir_all(&workspace).unwrap();
    }

    #[test]
    fn test_create_file_outside_workspace_rejected() {
        let workspace = std::env::temp_dir().join("ws_sandbox");
        fs::create_dir_all(&workspace).unwrap();
        // Path outside the workspace
        let outside = std::env::temp_dir().join("ws_outside_file.txt");

        let result = create_file(
            outside.to_str().unwrap().to_string(),
            workspace.to_str().unwrap().to_string(),
        );

        assert!(result.is_err());
        fs::remove_dir_all(&workspace).unwrap();
    }
}
