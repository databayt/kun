use std::{fs, path::Path};

use super::{
    ops::{self, SyncEvent, SyncState},
    state, *,
};

fn git(dir: &Path, args: &[&str]) -> bool {
    std::process::Command::new("git")
        .args([
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@t",
            "-c",
            "commit.gpgsign=false",
            "-c",
            "protocol.file.allow=always",
        ])
        .args(args)
        .current_dir(dir)
        .status()
        .is_ok_and(|s| s.success())
}

struct Origin {
    _dir: tempfile::TempDir,
    work: std::path::PathBuf,
    bare: std::path::PathBuf,
    base: String,
}

/// A bare `demo.git` under a temp folder, plus the work tree that feeds it; `None` without git.
fn origin() -> Option<Origin> {
    let dir = tempfile::tempdir().unwrap();
    let work = dir.path().join("work");
    fs::create_dir_all(&work).unwrap();
    if !git(&work, &["init", "-q", "-b", "main"]) {
        return None;
    }
    fs::write(work.join("README.md"), "one").unwrap();
    assert!(git(&work, &["add", "."]) && git(&work, &["commit", "-q", "-m", "one"]));
    let bare = dir.path().join("demo.git");
    assert!(git(
        dir.path(),
        &[
            "clone",
            "-q",
            "--bare",
            work.to_str().unwrap(),
            bare.to_str().unwrap()
        ]
    ));
    let url = format!("file://{}", dir.path().display());
    Some(Origin {
        _dir: dir,
        work,
        bare,
        base: url,
    })
}

async fn cloned(o: &Origin, root: &Path) {
    ops::clone_in(&o.base, root, "demo", None, false, &mut |_| {})
        .await
        .unwrap();
}

#[tokio::test]
async fn clone_streams_events_and_records_keep() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    let mut events: Vec<SyncEvent> = Vec::new();
    ops::clone_in(&o.base, root.path(), "demo", None, true, &mut |e| {
        events.push(e);
    })
    .await
    .unwrap();
    assert_eq!(events.first().unwrap().state, SyncState::Cloning);
    assert_eq!(events.last().unwrap().state, SyncState::Done);
    assert!(
        events.iter().any(|e| e.message.is_some()),
        "progress lines are streamed"
    );
    assert_eq!(
        fs::read_to_string(root.path().join("demo/README.md")).unwrap(),
        "one"
    );
    assert_eq!(state::load(root.path())["demo"].mode, RepoMode::Keep);
    let again = ops::clone_in(&o.base, root.path(), "demo", None, false, &mut |_| {}).await;
    assert!(matches!(again, Err(RepoError::AlreadyCloned(_))));
}

#[tokio::test]
async fn clone_rejects_bad_names_and_reports_a_missing_origin() {
    let root = tempfile::tempdir().unwrap();
    for bad in ["../evil", "a/b", ".kun-repos.json", "", "-x"] {
        let got = ops::clone_in(
            "file:///nowhere",
            root.path(),
            bad,
            None,
            false,
            &mut |_| {},
        )
        .await;
        assert!(matches!(got, Err(RepoError::BadName(_))), "{bad}");
    }
    let mut events = Vec::new();
    let got = ops::clone_in(
        "file:///nowhere",
        root.path(),
        "ghost",
        None,
        false,
        &mut |e| events.push(e.state),
    )
    .await;
    assert!(matches!(got, Err(RepoError::Git(_))));
    assert_eq!(events, [SyncState::Cloning, SyncState::Failed]);
}

#[tokio::test]
async fn depth_one_gives_a_shallow_clone_and_zero_the_full_history() {
    let Some(o) = origin() else { return };
    fs::write(o.work.join("README.md"), "two").unwrap();
    assert!(
        git(&o.work, &["commit", "-q", "-am", "two"])
            && git(&o.work, &["push", "-q", o.bare.to_str().unwrap(), "main"])
    );
    let root = tempfile::tempdir().unwrap();
    ops::clone_in(&o.base, root.path(), "demo", Some(1), false, &mut |_| {})
        .await
        .unwrap();
    assert!(root.path().join("demo/.git/shallow").exists());
    fs::remove_dir_all(root.path().join("demo")).unwrap();
    ops::clone_in(&o.base, root.path(), "demo", Some(0), false, &mut |_| {})
        .await
        .unwrap();
    assert!(!root.path().join("demo/.git/shallow").exists());
}

#[tokio::test]
async fn pull_fast_forwards_and_reports_behind() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    fs::write(o.work.join("README.md"), "two").unwrap();
    assert!(
        git(&o.work, &["commit", "-q", "-am", "two"])
            && git(&o.work, &["push", "-q", o.bare.to_str().unwrap(), "main"])
    );
    let dir = root.path().join("demo");
    assert!(git(&dir, &["fetch", "-q"]));
    let local = local_repos(root.path());
    assert_eq!(
        (local[0].behind, local[0].ahead, local[0].dirty),
        (1, 0, false)
    );
    assert_eq!(local[0].branch, "main");
    ops::pull_in(root.path(), "demo", false, &mut |_| {})
        .await
        .unwrap();
    assert_eq!(fs::read_to_string(dir.join("README.md")).unwrap(), "two");
    assert_eq!(local_repos(root.path())[0].behind, 0);
    let missing = ops::pull_in(root.path(), "nope", false, &mut |_| {}).await;
    assert!(matches!(missing, Err(RepoError::NotCloned(_))));
}

#[tokio::test]
async fn pull_never_merges_a_diverged_branch() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    let dir = root.path().join("demo");
    fs::write(dir.join("local.txt"), "mine").unwrap();
    assert!(git(&dir, &["add", "."]) && git(&dir, &["commit", "-q", "-m", "local"]));
    fs::write(o.work.join("README.md"), "two").unwrap();
    assert!(
        git(&o.work, &["commit", "-q", "-am", "two"])
            && git(&o.work, &["push", "-q", o.bare.to_str().unwrap(), "main"])
    );
    let got = ops::pull_in(root.path(), "demo", false, &mut |_| {}).await;
    assert!(
        matches!(got, Err(RepoError::Git(_))),
        "--ff-only refuses a diverged branch"
    );
}

#[tokio::test]
async fn sync_all_clones_pulls_and_survives_a_missing_repo() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    let mut events = Vec::new();
    ops::sync_all(root.path(), &["demo".into()], &o.base, |e| {
        events.push((e.state, e.repo));
    })
    .await
    .unwrap();
    assert_eq!(
        events,
        vec![
            (SyncState::Cloning, "demo".into()),
            (SyncState::Done, "demo".into())
        ]
    );
    let mut again = Vec::new();
    ops::sync_all(
        root.path(),
        &["demo".into(), "missing".into()],
        &o.base,
        |e| again.push((e.state, e.repo)),
    )
    .await
    .unwrap();
    assert_eq!(again[0], (SyncState::Pulling, "demo".into()));
    assert_eq!(again[3], (SyncState::Failed, "missing".into()));
    let bad = ops::sync_all(root.path(), &["../evil".into()], "x", |_| {}).await;
    assert!(matches!(bad, Err(RepoError::BadName(_))));
}

#[tokio::test]
async fn remove_deletes_a_clean_clone_and_its_state() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    ops::remove_in(root.path(), "demo").unwrap();
    assert!(!root.path().join("demo").exists());
    assert!(state::load(root.path()).is_empty());
    assert!(matches!(
        ops::remove_in(root.path(), "demo"),
        Err(RepoError::NotCloned(_))
    ));
}

fn refused(root: &Path) -> Vec<(LossKind, u32)> {
    match ops::remove_in(root, "demo") {
        Err(RepoError::Refused { losses, .. }) => {
            losses.into_iter().map(|l| (l.kind, l.count)).collect()
        }
        other => panic!("expected a refusal, got {other:?}"),
    }
}

#[tokio::test]
async fn remove_refuses_and_lists_what_would_be_lost() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    let dir = root.path().join("demo");

    fs::write(dir.join("new.txt"), "x").unwrap();
    assert_eq!(refused(root.path()), [(LossKind::Untracked, 1)]);
    fs::remove_file(dir.join("new.txt")).unwrap();

    fs::write(dir.join("README.md"), "edited").unwrap();
    assert_eq!(refused(root.path()), [(LossKind::Dirty, 1)]);
    assert!(local_repos(root.path())[0].dirty);

    assert!(git(&dir, &["stash", "-q"]));
    assert_eq!(refused(root.path()), [(LossKind::Stash, 1)]);
    assert!(git(&dir, &["stash", "drop", "-q"]));

    fs::write(dir.join("README.md"), "committed").unwrap();
    assert!(git(&dir, &["commit", "-q", "-am", "local"]));
    assert_eq!(refused(root.path()), [(LossKind::Unpushed, 1)]);
    assert_eq!(local_repos(root.path())[0].ahead, 1);

    assert!(git(&dir, &["push", "-q", "origin", "main"]));
    assert!(dir.exists(), "refusals deleted nothing");
    ops::remove_in(root.path(), "demo").unwrap();
}

#[tokio::test]
async fn a_branch_with_no_upstream_counts_as_unpushed() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    let dir = root.path().join("demo");
    assert!(git(&dir, &["checkout", "-q", "-b", "idea"]));
    fs::write(dir.join("idea.txt"), "x").unwrap();
    assert!(git(&dir, &["add", "."]) && git(&dir, &["commit", "-q", "-m", "idea"]));
    assert_eq!(refused(root.path()), [(LossKind::Unpushed, 1)]);
}

#[tokio::test]
async fn refusal_serializes_with_its_losses() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    fs::write(root.path().join("demo/new.txt"), "x").unwrap();
    let err = ops::remove_in(root.path(), "demo").unwrap_err();
    let json = serde_json::to_value(&err).unwrap();
    assert_eq!(json["code"], "refused");
    assert_eq!(json["losses"][0]["kind"], "untracked");
}

#[tokio::test]
async fn modes_persist_and_sweep_removes_only_clean_ended_sprints() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    assert!(matches!(
        ops::set_mode_in(root.path(), "ghost", RepoMode::Keep, None),
        Err(RepoError::NotCloned(_))
    ));

    ops::set_mode_in(root.path(), "demo", RepoMode::Sprint, Some("s1".into())).unwrap();
    let raw = fs::read_to_string(root.path().join(".kun-repos.json")).unwrap();
    assert!(
        raw.contains("\"mode\": \"sprint\"")
            && raw.contains("\"sprint\": \"s1\"")
            && raw.contains("addedAt"),
        "{raw}"
    );
    let l = &local_repos(root.path())[0];
    assert_eq!(
        (l.mode, l.sprint.as_deref()),
        (RepoMode::Sprint, Some("s1"))
    );

    let still = ops::sweep_in(root.path(), "s1").unwrap();
    assert!(
        still.removed.is_empty() && still.kept.is_empty(),
        "the sprint is not over"
    );

    fs::write(root.path().join("demo/wip.txt"), "x").unwrap();
    let dirty = ops::sweep_in(root.path(), "s2").unwrap();
    assert_eq!(
        (dirty.removed.len(), dirty.kept.clone()),
        (0, vec!["demo".to_owned()])
    );
    assert!(root.path().join("demo").exists());

    fs::remove_file(root.path().join("demo/wip.txt")).unwrap();
    let clean = ops::sweep_in(root.path(), "s2").unwrap();
    assert_eq!(clean.removed, ["demo"]);
    assert!(!root.path().join("demo").exists());

    // keep mode is never swept
    cloned(&o, root.path()).await;
    assert!(ops::sweep_in(root.path(), "s3").unwrap().removed.is_empty());
}

#[tokio::test]
async fn set_remote_only_accepts_databayt_https_urls() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    for bad in [
        "https://github.com/evil/demo.git",
        "git@github.com:databayt/demo.git",
        "https://token@github.com/databayt/demo.git",
        "https://github.com/databayt/demo/extra",
        "http://github.com/databayt/demo",
        "file:///tmp/x",
        "https://github.com/databayt/",
    ] {
        assert!(
            matches!(
                ops::set_remote_in(root.path(), "demo", bad),
                Err(RepoError::BadRemote(_))
            ),
            "{bad}"
        );
    }
    ops::set_remote_in(root.path(), "demo", "https://github.com/databayt/demo.git").unwrap();
    assert_eq!(
        ops::remote_url_in(root.path(), "demo").unwrap(),
        "https://github.com/databayt/demo"
    );
    assert_eq!(
        ops::remote_url_in(root.path(), "other").unwrap(),
        "https://github.com/databayt/other"
    );
}

#[tokio::test]
async fn rows_merge_org_local_and_the_profile_fallback() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    let org = vec![
        OrgRepoArg {
            name: "zed".into(),
            description: Some("z".into()),
            private: true,
        },
        OrgRepoArg {
            name: "demo".into(),
            ..OrgRepoArg::default()
        },
    ];
    let rows = ops::rows(root.path(), &org, &["unused".into()], false);
    assert_eq!(
        rows.iter()
            .map(|r| (r.name.as_str(), r.local))
            .collect::<Vec<_>>(),
        [("demo", true), ("zed", false)]
    );
    assert_eq!(rows[0].mode, Some(RepoMode::Keep));
    assert_eq!(rows[1].mode, None);
    assert!(rows[1].private);

    let fallback = ops::rows(root.path(), &[], &["kun".into()], false);
    assert_eq!(
        fallback
            .iter()
            .map(|r| (r.name.as_str(), r.local))
            .collect::<Vec<_>>(),
        [("demo", true), ("kun", false)]
    );
}

#[tokio::test]
async fn local_paths_lists_only_clones() {
    let Some(o) = origin() else { return };
    let root = tempfile::tempdir().unwrap();
    cloned(&o, root.path()).await;
    fs::create_dir_all(root.path().join("plain-folder")).unwrap();
    assert_eq!(ops::local_paths(root.path()), [root.path().join("demo")]);
    assert!(ops::local_paths(&root.path().join("absent")).is_empty());
}

#[test]
fn remove_never_follows_a_symlink() {
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        assert!(matches!(
            ops::remove_in(root.path(), "link"),
            Err(RepoError::BadName(_))
        ));
        assert!(outside.path().exists());
    }
}
