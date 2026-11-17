use super::*;

#[test]
fn defaults_when_missing() {
    let d = tempfile::tempdir().unwrap();
    assert_eq!(load_in(d.path()).unwrap(), Settings::default());
}

#[test]
fn round_trips_and_trims() {
    let d = tempfile::tempdir().unwrap();
    let saved = save_in(
        d.path(),
        Settings {
            person: "  هويدا ".into(),
            department: "video".into(),
            driver: DriverKind::Opencode,
            login: " moed ".into(),
        },
    )
    .unwrap();
    assert_eq!(saved.person, "هويدا");
    assert_eq!(saved.login, "moed");
    assert_eq!(load_in(d.path()).unwrap(), saved);
}

#[test]
fn rejects_bad_fields() {
    let d = tempfile::tempdir().unwrap();
    let base = Settings::default();
    assert!(matches!(
        save_in(
            d.path(),
            Settings {
                person: "x".repeat(81),
                ..base.clone()
            }
        ),
        Err(SettingsError::BadPerson)
    ));
    assert!(matches!(
        save_in(
            d.path(),
            Settings {
                person: "a\nb".into(),
                ..base.clone()
            }
        ),
        Err(SettingsError::BadPerson)
    ));
    assert!(matches!(
        save_in(
            d.path(),
            Settings {
                department: "../x".into(),
                ..base
            }
        ),
        Err(SettingsError::BadDepartment)
    ));
    for login in ["Moed", "a b", "../x", "moed_1"] {
        assert!(
            matches!(
                save_in(
                    d.path(),
                    Settings {
                        login: login.into(),
                        ..Settings::default()
                    }
                ),
                Err(SettingsError::BadLogin)
            ),
            "{login}"
        );
    }
    assert!(!d.path().join("settings.json").exists());
}

#[test]
fn partial_file_fills_defaults_and_bad_driver_is_corrupt() {
    let d = tempfile::tempdir().unwrap();
    fs::write(d.path().join("settings.json"), r#"{"person":"Ali"}"#).unwrap();
    let s = load_in(d.path()).unwrap();
    assert_eq!((s.person.as_str(), s.driver), ("Ali", DriverKind::Claude));
    fs::write(d.path().join("settings.json"), r#"{"driver":"gpt"}"#).unwrap();
    assert!(matches!(load_in(d.path()), Err(SettingsError::Corrupt(_))));
}
