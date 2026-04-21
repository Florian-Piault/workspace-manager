use git2::{Oid, Repository, Signature};
use tempfile::TempDir;

fn write_commit(repo: &Repository, dir: &TempDir, file_name: &str, contents: &str, message: &str, parents: &[Oid]) -> Oid {
    std::fs::write(dir.path().join(file_name), contents).unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(std::path::Path::new(file_name)).unwrap();
    index.write().unwrap();

    let tree_id = index.write_tree().unwrap();
    let sig = Signature::now("Pi", "pi@example.com").unwrap();
    let parent_commits = parents
        .iter()
        .map(|oid| repo.find_commit(*oid).unwrap())
        .collect::<Vec<_>>();
    let parent_refs = parent_commits.iter().collect::<Vec<_>>();

    let tree = repo.find_tree(tree_id).unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)
        .unwrap()
}

fn make_test_repo_with_one_commit() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    write_commit(&repo, &dir, "README.md", "hello graph\n", "initial commit", &[]);
    (dir, repo)
}

fn make_repo_with_branch_and_merge() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    let root = write_commit(&repo, &dir, "README.md", "root\n", "root", &[]);
    let main_second = write_commit(&repo, &dir, "main.txt", "main work\n", "main work", &[root]);

    {
        let root_commit = repo.find_commit(root).unwrap();
        repo.branch("feature", &root_commit, true).unwrap();
    }
    repo.set_head("refs/heads/feature").unwrap();

    let feature_commit = write_commit(&repo, &dir, "feature.txt", "feature work\n", "feature work", &[root]);

    repo.reference("refs/remotes/origin/feature", feature_commit, true, "test remote")
        .unwrap();

    repo.set_head("refs/heads/master").unwrap();
    let merge_tree_id = {
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("README.md")).unwrap();
        index.add_path(std::path::Path::new("main.txt")).unwrap();
        index.add_path(std::path::Path::new("feature.txt")).unwrap();
        index.write().unwrap();
        index.write_tree().unwrap()
    };

    let sig = Signature::now("Pi", "pi@example.com").unwrap();
    {
        let merge_tree = repo.find_tree(merge_tree_id).unwrap();
        let main_parent = repo.find_commit(main_second).unwrap();
        let feature_parent = repo.find_commit(feature_commit).unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "merge feature",
            &merge_tree,
            &[&main_parent, &feature_parent],
        )
        .unwrap();
    }

    (dir, repo)
}

#[test]
fn graph_for_single_commit_repo_returns_one_row() {
    let (_dir, repo) = make_test_repo_with_one_commit();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].lane, 0);
    assert!(rows[0].parent_hashes.is_empty());
    assert!(rows[0]
        .refs
        .iter()
        .any(|r| r.kind == "local" && r.checkout_target.as_deref() == Some(&r.name)));
}

#[test]
fn graph_for_linear_history_keeps_all_rows_on_lane_zero() {
    let (_dir, repo) = make_test_repo_with_one_commit();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();
    assert!(rows.iter().all(|row| row.lane == 0));
}

#[test]
fn graph_for_branch_and_merge_uses_multiple_lanes_and_merge_lines() {
    let (_dir, repo) = make_repo_with_branch_and_merge();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();

    assert!(rows.iter().any(|row| row.lane > 0));
    assert!(rows.iter().any(|row| row.parent_count >= 2));
    assert!(rows.iter().any(|row| row.lines.iter().any(|line| line.kind == "merge")));
}

#[test]
fn graph_refs_are_classified_with_head_local_and_remote_kinds() {
    let (_dir, repo) = make_repo_with_branch_and_merge();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();
    let refs = rows.iter().flat_map(|row| row.refs.iter()).collect::<Vec<_>>();

    assert!(refs.iter().any(|r| r.kind == "head"));
    assert!(refs.iter().any(|r| r.kind == "local" && r.name == "master"));
    assert!(refs.iter().any(|r| r.kind == "local" && r.name == "feature"));
    assert!(refs.iter().any(|r| r.kind == "remote" && r.name == "origin/feature"));
}
