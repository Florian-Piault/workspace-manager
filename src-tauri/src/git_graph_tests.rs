use git2::{Repository, Signature};
use tempfile::TempDir;

fn make_test_repo_with_one_commit() -> (TempDir, Repository) {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    std::fs::write(dir.path().join("README.md"), "hello graph\n").unwrap();

    let mut index = repo.index().unwrap();
    index.add_path(std::path::Path::new("README.md")).unwrap();
    index.write().unwrap();

    let tree_id = index.write_tree().unwrap();
    let sig = Signature::now("Pi", "pi@example.com").unwrap();

    {
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "initial commit", &tree, &[])
            .unwrap();
    }

    (dir, repo)
}

#[test]
fn graph_for_single_commit_repo_returns_one_row() {
    let (_dir, repo) = make_test_repo_with_one_commit();
    let rows = crate::git::build_graph_rows(&repo, 50).unwrap();
    assert_eq!(rows.len(), 1);
}
