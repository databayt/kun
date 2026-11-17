use super::*;

#[test]
fn titles_are_one_short_line() {
    assert_eq!(title_from("  اكتب \n عرض   سعر "), "اكتب عرض سعر");
    let long = "x".repeat(100);
    assert_eq!(title_from(&long).chars().count(), 61);
    assert_eq!(title_from("   "), "…");
}

#[test]
fn job_ids_are_validated_and_the_job_is_built() {
    for bad in ["", "a b", "../x", &"a".repeat(65)] {
        assert!(
            matches!(
                build_job(
                    bad,
                    DriverKind::Claude,
                    "hi".into(),
                    ".".into(),
                    None,
                    Vec::new(),
                    Vec::new()
                ),
                Err(ChatError::BadJobId)
            ),
            "{bad}"
        );
    }
    let job = build_job(
        "j-1",
        DriverKind::Codex,
        "hi".into(),
        "/tmp".into(),
        Some("s1".into()),
        Vec::new(),
        Vec::new(),
    )
    .unwrap();
    assert_eq!(
        (job.driver, job.cwd.as_str(), job.session.as_deref()),
        (DriverKind::Codex, "/tmp", Some("s1"))
    );
}

#[test]
fn cancel_reaches_a_registered_job_once() {
    let (tx, mut rx) = oneshot::channel();
    let reg = register("test-cancel", tx).unwrap();
    let (tx2, _rx2) = oneshot::channel();
    assert!(matches!(
        register("test-cancel", tx2),
        Err(ChatError::Duplicate)
    ));
    assert!(cancel("test-cancel"));
    assert!(rx.try_recv().is_ok());
    assert!(!cancel("test-cancel"));
    drop(reg);
    assert!(!cancel("never-ran"));
}

#[test]
fn registration_is_released_on_drop() {
    let (tx, _rx) = oneshot::channel();
    drop(register("test-drop", tx).unwrap());
    let (tx, _rx) = oneshot::channel();
    assert!(register("test-drop", tx).is_ok());
}

fn resolved(driver: DriverKind, locked: bool) -> Resolved {
    use crate::profile::{Access, MachineProfile};
    Resolved {
        profile: MachineProfile {
            login: "moed".into(),
            name: String::new(),
            os: "windows".into(),
            driver,
            departments: Vec::new(),
            repos: vec!["kun".into(), "mkan".into()],
            access: Access::FULL,
            hidden: Vec::new(),
        },
        secrets: Vec::new(),
        driver_locked: locked,
        explicit: true,
    }
}

#[test]
fn a_locked_profile_fixes_the_driver() {
    let locked = resolved(DriverKind::Claude, true);
    assert_eq!(
        pick_driver(&locked, Some(DriverKind::Codex), DriverKind::Opencode),
        DriverKind::Claude
    );
    let open = resolved(DriverKind::Claude, false);
    assert_eq!(
        pick_driver(&open, Some(DriverKind::Codex), DriverKind::Opencode),
        DriverKind::Codex
    );
    assert_eq!(
        pick_driver(&open, None, DriverKind::Opencode),
        DriverKind::Opencode
    );
}

#[test]
fn the_job_sees_only_the_cloned_repos_and_the_settings_file() {
    let root = tempfile::tempdir().unwrap();
    let ws = Workspace {
        dir: root.path().join("moed"),
        repos: root.path().join("repos"),
        work: root.path().join("moed/work"),
        settings_file: root.path().join("moed/.claude-settings.json"),
    };
    std::fs::create_dir_all(ws.repos.join("kun")).unwrap();
    let repos = ["kun".to_owned(), "mkan".to_owned()];
    let extras = job_extras(DriverKind::Claude, &repos, &ws);
    assert_eq!(
        extras,
        vec![
            "--add-dir".to_owned(),
            ws.repos.join("kun").display().to_string(),
            "--settings".into(),
            ws.settings_file.display().to_string(),
        ]
    );
    assert!(job_extras(DriverKind::Codex, &repos, &ws).is_empty());
    let job = build_job(
        "j1",
        DriverKind::Claude,
        "hi".into(),
        ".".into(),
        None,
        extras,
        vec![("GEMINI_API_KEY".into(), "k".into())],
    )
    .unwrap();
    assert!(driver::args_for(&job).is_ok());
}

#[test]
fn a_task_run_adds_its_repos_once_and_only_for_claude() {
    let dirs = [
        PathBuf::from("/w/repos/hogwarts"),
        PathBuf::from("/w/repos/kun"),
    ];
    let have = vec![
        "--add-dir".to_owned(),
        "/w/repos/kun".to_owned(),
        "--settings".to_owned(),
        "/w/s.json".to_owned(),
    ];
    assert_eq!(
        task_extras(DriverKind::Claude, &have, &dirs),
        ["--add-dir", "/w/repos/hogwarts"]
    );
    assert!(task_extras(DriverKind::Codex, &have, &dirs).is_empty());
    // What it builds passes the driver's own whitelist.
    let mut all = have.clone();
    all.extend(task_extras(DriverKind::Claude, &have, &dirs));
    assert!(
        build_job(
            "j",
            DriverKind::Claude,
            "hi".into(),
            ".".into(),
            None,
            all,
            Vec::new()
        )
        .is_ok()
    );
    assert!(
        driver::args_for(
            &build_job(
                "j",
                DriverKind::Claude,
                "hi".into(),
                ".".into(),
                None,
                vec!["--add-dir".into(), "/w/repos/hogwarts".into()],
                Vec::new()
            )
            .unwrap()
        )
        .is_ok()
    );
}

#[test]
fn a_task_run_needs_the_seed_that_start_wrote() {
    use crate::network::host::fake::FakeHost;
    let host = FakeHost {
        paths: vec!["/w/repos/hogwarts".into()],
        ..FakeHost::default()
    };
    let dir = tempfile::tempdir().unwrap();
    let cwd = dir.path().display().to_string();
    let id = "databayt/hogwarts#10";
    assert!(matches!(
        task_setup(&cwd, "nope", DriverKind::Claude, &[], &host),
        Err(ChatError::BadTask)
    ));
    assert!(matches!(
        task_setup(&cwd, id, DriverKind::Claude, &[], &host),
        Err(ChatError::TaskNotStarted)
    ));
    std::fs::write(
        dir.path().join(SEED_FILE),
        format!("<!-- kun-task: {id} repos=hogwarts,kun -->\n# t\n"),
    )
    .unwrap();
    assert_eq!(
        task_setup(&cwd, id, DriverKind::Claude, &[], &host).unwrap(),
        ["--add-dir", "/w/repos/hogwarts"]
    );
    assert!(matches!(
        task_setup(&cwd, "databayt/hogwarts#11", DriverKind::Claude, &[], &host),
        Err(ChatError::TaskNotStarted)
    ));
}

#[test]
fn the_task_prompt_points_at_the_seed() {
    let p = task_prompt("databayt/kun#3", "start");
    assert!(p.contains("TASK.md") && p.contains("databayt/kun#3") && p.ends_with("start"));
}
