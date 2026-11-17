use super::*;

#[test]
fn empty_when_no_file() {
    let d = tempfile::tempdir().unwrap();
    assert!(list_in(d.path()).unwrap().is_empty());
}

#[test]
fn upsert_keeps_title_and_bumps_time() {
    let d = tempfile::tempdir().unwrap();
    let a = upsert_in(
        d.path(),
        "abc-1",
        "  عرض   سعر  ",
        "sales",
        DriverKind::Claude,
    )
    .unwrap();
    assert_eq!(a.title, "عرض سعر");
    let b = upsert_in(d.path(), "abc-1", "ignored", "sales", DriverKind::Claude).unwrap();
    assert_eq!((b.title.as_str(), b.created_at), ("عرض سعر", a.created_at));
    assert_eq!(list_in(d.path()).unwrap().len(), 1);
}

#[test]
fn rename_get_delete() {
    let d = tempfile::tempdir().unwrap();
    upsert_in(d.path(), "s1", "one", "sales", DriverKind::Codex).unwrap();
    assert_eq!(rename_in(d.path(), "s1", "two").unwrap().title, "two");
    assert_eq!(get_in(d.path(), "s1").unwrap().driver, DriverKind::Codex);
    delete_in(d.path(), "s1").unwrap();
    assert!(matches!(
        get_in(d.path(), "s1"),
        Err(SessionsError::NotFound)
    ));
    assert!(matches!(
        delete_in(d.path(), "s1"),
        Err(SessionsError::NotFound)
    ));
}

#[test]
fn validates_input() {
    let d = tempfile::tempdir().unwrap();
    for id in ["", "a/b", "../x", "a b"] {
        assert!(
            matches!(
                upsert_in(d.path(), id, "t", "sales", DriverKind::Claude),
                Err(SessionsError::BadId)
            ),
            "{id}"
        );
    }
    assert!(matches!(
        upsert_in(d.path(), "ok", "   ", "sales", DriverKind::Claude),
        Err(SessionsError::BadTitle)
    ));
    assert!(matches!(
        rename_in(d.path(), "ok", "a\u{7}b"),
        Err(SessionsError::BadTitle)
    ));
}

#[test]
fn damaged_file_is_reported_not_overwritten() {
    let d = tempfile::tempdir().unwrap();
    fs::write(d.path().join("sessions.json"), "{oops").unwrap();
    assert!(matches!(
        upsert_in(d.path(), "s1", "t", "sales", DriverKind::Claude),
        Err(SessionsError::Corrupt(_))
    ));
    assert_eq!(
        fs::read_to_string(d.path().join("sessions.json")).unwrap(),
        "{oops"
    );
}

#[test]
fn newest_first() {
    let d = tempfile::tempdir().unwrap();
    let mk = |id: &str, at: u64| Session {
        id: id.into(),
        title: id.into(),
        department: "sales".into(),
        driver: DriverKind::Claude,
        created_at: at,
        updated_at: at,
    };
    write(d.path(), vec![mk("old", 1), mk("new", 9)]).unwrap();
    let ids: Vec<_> = list_in(d.path())
        .unwrap()
        .into_iter()
        .map(|s| s.id)
        .collect();
    assert_eq!(ids, ["new", "old"]);
}
