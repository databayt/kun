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
        assert!(matches!(build_job(bad, DriverKind::Claude, "hi".into(), ".".into(), None), Err(ChatError::BadJobId)), "{bad}");
    }
    let job = build_job("j-1", DriverKind::Codex, "hi".into(), "/tmp".into(), Some("s1".into())).unwrap();
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
