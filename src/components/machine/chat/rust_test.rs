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
        assert!(matches!(build_job(bad, DriverKind::Claude, "hi".into(), ".".into(), None, Vec::new(), Vec::new()), Err(ChatError::BadJobId)), "{bad}");
    }
    let job = build_job("j-1", DriverKind::Codex, "hi".into(), "/tmp".into(), Some("s1".into()), Vec::new(), Vec::new()).unwrap();
    assert_eq!((job.driver, job.cwd.as_str(), job.session.as_deref()), (DriverKind::Codex, "/tmp", Some("s1")));
}

#[test]
fn cancel_reaches_a_registered_job_once() {
    let (tx, mut rx) = oneshot::channel();
    let reg = register("test-cancel", tx).unwrap();
    let (tx2, _rx2) = oneshot::channel();
    assert!(matches!(register("test-cancel", tx2), Err(ChatError::Duplicate)));
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
    assert_eq!(pick_driver(&locked, Some(DriverKind::Codex), DriverKind::Opencode), DriverKind::Claude);
    let open = resolved(DriverKind::Claude, false);
    assert_eq!(pick_driver(&open, Some(DriverKind::Codex), DriverKind::Opencode), DriverKind::Codex);
    assert_eq!(pick_driver(&open, None, DriverKind::Opencode), DriverKind::Opencode);
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
    let job = build_job("j1", DriverKind::Claude, "hi".into(), ".".into(), None, extras, vec![("GEMINI_API_KEY".into(), "k".into())]).unwrap();
    assert!(driver::args_for(&job).is_ok());
}
