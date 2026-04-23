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

fn make_linear_repo() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    let first = write_commit(&repo, &dir, "README.md", "one\n", "first", &[]);
    let second = write_commit(&repo, &dir, "README.md", "two\n", "second", &[first]);
    write_commit(&repo, &dir, "README.md", "three\n", "third", &[second]);

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
    let (_dir, repo) = make_linear_repo();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();
    assert!(rows.iter().all(|row| row.lane == 0));
}

#[test]
fn graph_for_linear_history_links_each_commit_to_its_true_parent() {
    let (_dir, repo) = make_linear_repo();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();

    let third = rows.iter().find(|row| row.message == "third").unwrap();
    let second = rows.iter().find(|row| row.message == "second").unwrap();
    let first = rows.iter().find(|row| row.message == "first").unwrap();

    assert_eq!(third.parent_hashes, vec![second.hash.clone()]);
    assert_eq!(third.parent_links.len(), 1);
    assert_eq!(third.parent_links[0].parent_hash, second.hash);
    assert_eq!(third.parent_links[0].to_lane, 0);
    assert!(third.parent_links[0].direct);
    assert!(third.lines.iter().any(|line| line.kind == "vertical" && line.from_lane == 0 && line.to_lane == 0));

    assert_eq!(second.parent_hashes, vec![first.hash.clone()]);
    assert_eq!(second.parent_links.len(), 1);
    assert_eq!(second.parent_links[0].parent_hash, first.hash);
    assert_eq!(second.parent_links[0].to_lane, 0);
    assert!(second.parent_links[0].direct);
}

#[test]
fn graph_for_branch_and_merge_uses_multiple_lanes_and_merge_lines() {
    let (_dir, repo) = make_repo_with_branch_and_merge();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();

    assert!(rows.iter().any(|row| row.lane > 0));
    assert!(rows.iter().any(|row| row.parent_count >= 2));
    assert!(rows.iter().any(|row| row.lines.iter().any(|line| line.kind == "merge")));

    let merge_row = rows.iter().find(|row| row.message == "merge feature").unwrap();
    assert_eq!(merge_row.parent_links.len(), 2);
    assert_eq!(merge_row.parent_links[0].kind, "first_parent");
    assert_eq!(merge_row.parent_links[1].kind, "merge_parent");
    assert_eq!(merge_row.parent_links[0].parent_hash, merge_row.parent_hashes[0]);
    assert_eq!(merge_row.parent_links[1].parent_hash, merge_row.parent_hashes[1]);
    assert!(merge_row.parent_links.iter().map(|link| link.parent_hash.as_str()).eq(merge_row.parent_hashes.iter().map(|hash| hash.as_str())));
}

#[test]
fn graph_collapses_duplicate_parent_lanes_after_branch_converges() {
    let (_dir, repo) = make_repo_with_branch_and_merge();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();

    let feature_row = rows.iter().find(|row| row.message == "feature work").unwrap();
    let root_row = rows.iter().find(|row| row.message == "root").unwrap();
    assert!(feature_row.lines.iter().any(|line| {
        line.kind == "horizontal" && line.from_lane == feature_row.lane && line.to_lane == root_row.lane
    }));
    assert_eq!(feature_row.parent_links.len(), 1);
    assert_eq!(feature_row.parent_links[0].parent_hash, root_row.hash);
    assert_eq!(feature_row.parent_links[0].to_lane, root_row.lane);
    assert!(!feature_row.parent_links[0].direct);

    assert_eq!(root_row.lane, 0);
    assert!(root_row.parent_hashes.is_empty());
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

#[test]
fn graph_emits_vertical_lines_for_newly_spawned_parent_lanes() {
    let (_dir, repo) = make_repo_with_branch_and_merge();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();

    let merge_row = rows.iter().find(|row| row.message == "merge feature").unwrap();
    let merge_parent_lane = merge_row
        .parent_links
        .iter()
        .find(|link| link.kind == "merge_parent")
        .map(|link| link.to_lane)
        .unwrap();

    assert!(merge_row.lines.iter().any(|line| {
        line.kind == "vertical" && line.from_lane == merge_parent_lane && line.to_lane == merge_parent_lane
    }));
}
