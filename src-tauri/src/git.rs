use git2::{BranchType, DiffFormat, DiffOptions, Repository, Status, StatusOptions};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Serialize)]
pub struct GitStatus {
    pub staged: Vec<FileStatus>,
    pub unstaged: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Serialize)]
pub struct AheadBehind {
    pub ahead: usize,
    pub behind: usize,
}

fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| e.message().to_string())
}

fn git_err(e: git2::Error) -> String {
    e.message().to_string()
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    let repo = open_repo(&path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(git_err)?;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for entry in statuses.iter() {
        let s = entry.status();
        let p = entry.path().unwrap_or("").to_string();

        if s.contains(Status::INDEX_NEW) {
            staged.push(FileStatus { path: p.clone(), status: "A".into() });
        } else if s.contains(Status::INDEX_MODIFIED) {
            staged.push(FileStatus { path: p.clone(), status: "M".into() });
        } else if s.contains(Status::INDEX_DELETED) {
            staged.push(FileStatus { path: p.clone(), status: "D".into() });
        } else if s.contains(Status::INDEX_RENAMED) {
            staged.push(FileStatus { path: p.clone(), status: "R".into() });
        }

        if s.contains(Status::WT_MODIFIED) {
            unstaged.push(FileStatus { path: p.clone(), status: "M".into() });
        } else if s.contains(Status::WT_DELETED) {
            unstaged.push(FileStatus { path: p.clone(), status: "D".into() });
        } else if s.contains(Status::WT_NEW) {
            untracked.push(FileStatus { path: p.clone(), status: "?".into() });
        }
    }

    Ok(GitStatus { staged, unstaged, untracked })
}

#[tauri::command]
pub fn git_diff_file(path: String, file: String, staged: bool) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let mut opts = DiffOptions::new();
    opts.pathspec(&file);

    let diff = if staged {
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))
    }
    .map_err(git_err)?;

    let mut patch = String::new();
    diff.print(DiffFormat::Patch, |_, _, line| {
        match line.origin() {
            '+' | '-' | ' ' | '\\' => patch.push(line.origin()),
            _ => {}
        }
        if let Ok(s) = std::str::from_utf8(line.content()) {
            patch.push_str(s);
        }
        true
    })
    .map_err(git_err)?;

    Ok(patch)
}

#[tauri::command]
pub fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut index = repo.index().map_err(git_err)?;

    for file in &files {
        index
            .add_all([file.as_str()], git2::IndexAddOption::DEFAULT, None)
            .map_err(git_err)?;
    }
    index.write().map_err(git_err)?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = open_repo(&path)?;

    match repo.head() {
        Ok(head) => {
            let obj = head.peel(git2::ObjectType::Commit).map_err(git_err)?;
            repo.reset_default(Some(&obj), files.iter().map(|s| s.as_str()))
                .map_err(git_err)?;
        }
        Err(_) => {
            let mut index = repo.index().map_err(git_err)?;
            for file in &files {
                let _ = index.remove_path(Path::new(file));
            }
            index.write().map_err(git_err)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let sig = repo.signature().map_err(git_err)?;
    let mut index = repo.index().map_err(git_err)?;
    let tree_id = index.write_tree().map_err(git_err)?;
    let tree = repo.find_tree(tree_id).map_err(git_err)?;

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();

    repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(git_err)?;
    Ok(())
}

#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = open_repo(&path)?;
    let mut result = Vec::new();

    for branch in repo.branches(None).map_err(git_err)? {
        let (branch, branch_type) = branch.map_err(git_err)?;
        let name = branch
            .name()
            .map_err(git_err)?
            .unwrap_or("unknown")
            .to_string();
        result.push(BranchInfo {
            is_current: branch.is_head(),
            is_remote: branch_type == BranchType::Remote,
            name,
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn git_checkout(path: String, branch: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let (obj, reference) = repo.revparse_ext(&branch).map_err(git_err)?;
    repo.checkout_tree(&obj, None).map_err(git_err)?;

    match reference {
        Some(gref) => repo
            .set_head(gref.name().unwrap_or(""))
            .map_err(git_err)?,
        None => repo.set_head_detached(obj.id()).map_err(git_err)?,
    }
    Ok(())
}

#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let commit = repo
        .head()
        .map_err(git_err)?
        .peel_to_commit()
        .map_err(git_err)?;
    repo.branch(&name, &commit, false).map_err(git_err)?;
    Ok(())
}

#[tauri::command]
pub fn git_delete_branch(path: String, name: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    repo.find_branch(&name, BranchType::Local)
        .map_err(git_err)?
        .delete()
        .map_err(git_err)?;
    Ok(())
}

fn run_git(path: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[derive(Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author_name: String,
    pub timestamp: i64,
    pub refs: Vec<String>,
    pub parent_count: usize,
}

#[tauri::command]
pub fn git_log(path: String, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = open_repo(&path)?;

    // Build OID → ref names map in one pass
    let mut ref_map: HashMap<git2::Oid, Vec<String>> = HashMap::new();
    for r in repo.references().map_err(git_err)? {
        let r = r.map_err(git_err)?;
        if let (Some(oid), Some(name)) = (r.target(), r.shorthand()) {
            ref_map.entry(oid).or_default().push(name.to_string());
        }
    }

    let mut revwalk = repo.revwalk().map_err(git_err)?;
    revwalk.push_head().map_err(git_err)?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(git_err)?;

    let mut commits = Vec::new();
    for oid in revwalk.take(limit) {
        let oid = oid.map_err(git_err)?;
        let commit = repo.find_commit(oid).map_err(git_err)?;
        let hash = oid.to_string();
        commits.push(CommitInfo {
            short_hash: hash[..7].to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author_name: commit.author().name().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            refs: ref_map.remove(&oid).unwrap_or_default(),
            parent_count: commit.parent_count(),
            hash,
        });
    }
    Ok(commits)
}

#[tauri::command]
pub fn git_delete_remote_branch(path: String, remote: String, branch: String) -> Result<String, String> {
    run_git(&path, &["push", &remote, "--delete", &branch])
}

#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    run_git(&path, &["push"])
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    run_git(&path, &["pull"])
}

#[tauri::command]
pub fn git_fetch(path: String) -> Result<String, String> {
    run_git(&path, &["fetch"])
}

#[tauri::command]
pub fn git_ahead_behind(path: String) -> Result<AheadBehind, String> {
    let repo = open_repo(&path)?;

    let local_id = repo
        .head()
        .map_err(git_err)?
        .peel_to_commit()
        .map_err(git_err)?
        .id();

    let branch_name = repo
        .head()
        .ok()
        .and_then(|r| r.shorthand().map(|s| s.to_string()))
        .ok_or_else(|| "no HEAD".to_string())?;

    let upstream = format!("origin/{}", branch_name);
    let result = match repo.find_branch(&upstream, BranchType::Remote) {
        Ok(rb) => {
            let remote_id = rb
                .get()
                .peel_to_commit()
                .map_err(git_err)?
                .id();
            let (ahead, behind) = repo.graph_ahead_behind(local_id, remote_id).map_err(git_err)?;
            Ok(AheadBehind { ahead, behind })
        }
        Err(_) => Ok(AheadBehind { ahead: 0, behind: 0 }),
    };
    result
}
