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
pub fn git_create_branch_from_commit(path: String, name: String, commit: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let oid = git2::Oid::from_str(&commit).map_err(git_err)?;
    let commit = repo.find_commit(oid).map_err(git_err)?;
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

#[derive(Serialize, Clone)]
pub struct GraphRefInfo {
    pub name: String,
    pub kind: String,
    pub checkout_target: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct GraphLine {
    pub from_lane: usize,
    pub to_lane: usize,
    pub kind: String,
}

#[derive(Serialize, Clone)]
pub struct GraphParentLink {
    pub parent_hash: String,
    pub to_lane: usize,
    pub kind: String,
    pub direct: bool,
}

#[derive(Serialize, Clone)]
pub struct GraphCommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author_name: String,
    pub timestamp: i64,
    pub refs: Vec<GraphRefInfo>,
    pub parent_count: usize,
    pub parent_hashes: Vec<String>,
    pub parent_links: Vec<GraphParentLink>,
    pub lane: usize,
    pub node_kind: String,
    pub lines: Vec<GraphLine>,
}

fn graph_ref_info(reference: &git2::Reference<'_>) -> Option<(git2::Oid, GraphRefInfo)> {
    let resolved = reference.resolve().ok();
    let target = reference.target().or_else(|| resolved.as_ref().and_then(|r| r.target()))?;
    let full_name = reference.name().or_else(|| resolved.as_ref().and_then(|r| r.name())).unwrap_or("");
    let raw_name = reference.shorthand().or_else(|| resolved.as_ref().and_then(|r| r.shorthand()))?;

    let (name, kind, checkout_target) = if full_name == "HEAD" {
        ("HEAD".to_string(), "head".to_string(), None)
    } else if full_name.starts_with("refs/heads/") {
        (raw_name.to_string(), "local".to_string(), Some(raw_name.to_string()))
    } else if full_name.starts_with("refs/remotes/") {
        (raw_name.to_string(), "remote".to_string(), Some(raw_name.to_string()))
    } else if full_name.starts_with("refs/tags/") {
        (raw_name.to_string(), "tag".to_string(), None)
    } else {
        (raw_name.to_string(), "other".to_string(), None)
    };

    Some((
        target,
        GraphRefInfo {
            name,
            kind,
            checkout_target,
        },
    ))
}

fn first_free_lane(active_lanes: &mut Vec<Option<git2::Oid>>) -> usize {
    if let Some(index) = active_lanes.iter().position(|lane| lane.is_none()) {
        index
    } else {
        active_lanes.push(None);
        active_lanes.len() - 1
    }
}

fn find_lane_with_oid(active_lanes: &[Option<git2::Oid>], oid: git2::Oid, exclude_lane: Option<usize>) -> Option<usize> {
    active_lanes
        .iter()
        .enumerate()
        .find(|(index, candidate)| Some(*index) != exclude_lane && **candidate == Some(oid))
        .map(|(index, _)| index)
}

fn push_graph_line(lines: &mut Vec<GraphLine>, from_lane: usize, to_lane: usize, kind: &str) {
    if lines.iter().any(|line| line.from_lane == from_lane && line.to_lane == to_lane && line.kind == kind) {
        return;
    }

    lines.push(GraphLine {
        from_lane,
        to_lane,
        kind: kind.to_string(),
    });
}

pub(crate) fn build_graph_rows(repo: &Repository, limit: usize) -> Result<Vec<GraphCommitInfo>, String> {
    let mut ref_map: HashMap<git2::Oid, Vec<GraphRefInfo>> = HashMap::new();
    for reference in repo.references().map_err(git_err)? {
        let reference = reference.map_err(git_err)?;
        if let Some((oid, info)) = graph_ref_info(&reference) {
            ref_map.entry(oid).or_default().push(info);
        }
    }

    if let Ok(head) = repo.head() {
        if let Some(oid) = head.target().or_else(|| head.resolve().ok().and_then(|resolved| resolved.target())) {
            ref_map.entry(oid).or_default().push(GraphRefInfo {
                name: "HEAD".to_string(),
                kind: "head".to_string(),
                checkout_target: None,
            });
        }
    }

    let head_oid = repo
        .head()
        .ok()
        .and_then(|head| head.resolve().ok())
        .and_then(|head| head.target());

    let mut revwalk = repo.revwalk().map_err(git_err)?;
    let mut pushed_any = false;
    for pattern in ["refs/heads/*", "refs/remotes/*", "refs/tags/*"] {
        if revwalk.push_glob(pattern).is_ok() {
            pushed_any = true;
        }
    }
    if !pushed_any {
        revwalk.push_head().map_err(git_err)?;
    }
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(git_err)?;

    let mut rows = Vec::new();
    let mut active_lanes: Vec<Option<git2::Oid>> = Vec::new();

    for oid in revwalk.take(limit) {
        let oid = oid.map_err(git_err)?;
        let commit = repo.find_commit(oid).map_err(git_err)?;
        let hash = oid.to_string();
        let parent_oids = commit.parents().map(|parent| parent.id()).collect::<Vec<_>>();
        let parent_hashes = parent_oids.iter().map(|parent| parent.to_string()).collect::<Vec<_>>();

        let lane = if let Some(index) = find_lane_with_oid(&active_lanes, oid, None) {
            index
        } else {
            let index = first_free_lane(&mut active_lanes);
            active_lanes[index] = Some(oid);
            index
        };

        let mut next_lanes = active_lanes.clone();
        let mut lines = Vec::new();
        let mut parent_links = Vec::new();

        if let Some(first_parent) = parent_oids.first().copied() {
            if let Some(target_lane) = find_lane_with_oid(&next_lanes, first_parent, Some(lane)) {
                next_lanes[lane] = None;
                push_graph_line(&mut lines, lane, target_lane, "horizontal");
                parent_links.push(GraphParentLink {
                    parent_hash: first_parent.to_string(),
                    to_lane: target_lane,
                    kind: "first_parent".to_string(),
                    direct: false,
                });
            } else {
                next_lanes[lane] = Some(first_parent);
                push_graph_line(&mut lines, lane, lane, "vertical");
                parent_links.push(GraphParentLink {
                    parent_hash: first_parent.to_string(),
                    to_lane: lane,
                    kind: "first_parent".to_string(),
                    direct: true,
                });
            }
        } else {
            next_lanes[lane] = None;
        }

        for parent_oid in parent_oids.iter().skip(1).copied() {
            let target_lane = if let Some(index) = find_lane_with_oid(&next_lanes, parent_oid, None) {
                index
            } else {
                let index = first_free_lane(&mut next_lanes);
                next_lanes[index] = Some(parent_oid);
                index
            };

            push_graph_line(&mut lines, lane, target_lane, "merge");
            parent_links.push(GraphParentLink {
                parent_hash: parent_oid.to_string(),
                to_lane: target_lane,
                kind: "merge_parent".to_string(),
                direct: target_lane == lane,
            });
        }

        for (index, lane_oid) in next_lanes.iter().enumerate() {
            if *lane_oid == Some(oid) || lane_oid.is_none() {
                continue;
            }

            push_graph_line(&mut lines, index, index, "vertical");
        }

        while next_lanes.last().is_some_and(|lane| lane.is_none()) {
            next_lanes.pop();
        }
        active_lanes = next_lanes;

        rows.push(GraphCommitInfo {
            short_hash: hash[..7].to_string(),
            message: commit.summary().unwrap_or("").to_string(),
            author_name: commit.author().name().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            refs: ref_map.remove(&oid).unwrap_or_default(),
            parent_count: commit.parent_count(),
            parent_hashes,
            parent_links,
            lane,
            node_kind: if Some(oid) == head_oid {
                "head".to_string()
            } else if commit.parent_count() >= 2 {
                "merge".to_string()
            } else {
                "commit".to_string()
            },
            lines,
            hash,
        });
    }

    Ok(rows)
}

#[tauri::command]
pub fn git_graph(path: String, limit: usize) -> Result<Vec<GraphCommitInfo>, String> {
    let repo = open_repo(&path)?;
    build_graph_rows(&repo, limit)
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
