use tauri::command;
use std::fs;

#[command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
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
