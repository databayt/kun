use std::{cell::RefCell, collections::HashMap};

use super::*;

fn kun() -> tempfile::TempDir {
    let kun = tempfile::tempdir().unwrap();
    for dept in ["sales", "video"] {
        let d = kun.path().join("departments").join(dept);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("prompt.md"), "prompt").unwrap();
    }
    fs::write(
        kun.path().join("departments/sales/pack.json"),
        r#"{"name":"sales","title":"Sales","title_ar":"المبيعات","items":["skill:proposal","skill:ghost","agent:lead"],
            "quickActions":[{"label_ar":"عرض","label_en":"Quote","prompt":"Quote a school"}]}"#,
    )
    .unwrap();
    let skill = kun.path().join(".claude/skills/proposal");
    fs::create_dir_all(&skill).unwrap();
    fs::write(
        skill.join("SKILL.md"),
        "---\nname: proposal\ndescription: \"Generate a client proposal\"\n---\n# body\n",
    )
    .unwrap();
    let machines = kun.path().join("machines");
    fs::create_dir_all(&machines).unwrap();
    fs::write(
        machines.join("moed.json"),
        r#"{"login":"moed","name":"معد","os":"windows","driver":"claude","departments":["sales"],"repos":["kun","hogwarts"],
            "access":{"code":"read","workspace":"write","catalog":"profile","engine":false},
            "secrets":["TWENTY_API_KEY","GEMINI_API_KEY"]}"#,
    )
    .unwrap();
    kun
}

#[test]
fn loads_moeds_profile() {
    let kun = kun();
    let r = resolve_in(kun.path(), "moed", DriverKind::Codex).unwrap();
    assert!(r.explicit && r.driver_locked);
    let p = r.profile;
    assert_eq!(
        (p.login.as_str(), p.name.as_str(), p.os.as_str(), p.driver),
        ("moed", "معد", "windows", DriverKind::Claude)
    );
    assert_eq!(p.repos, ["kun", "hogwarts"]);
    assert_eq!(
        p.access,
        Access {
            code: CodeAccess::Read,
            workspace: WorkspaceAccess::Write,
            catalog: CatalogAccess::Profile,
            engine: false
        }
    );
    assert_eq!(r.secrets, ["TWENTY_API_KEY", "GEMINI_API_KEY"]);
    let sales = &p.departments[0];
    assert_eq!(
        (sales.title.as_str(), sales.title_ar.as_deref()),
        ("Sales", Some("المبيعات"))
    );
    assert_eq!(sales.quick_actions.len(), 1);
    assert_eq!(
        sales.skills,
        vec![SkillRef {
            name: "proposal".into(),
            title: "proposal".into(),
            description: "Generate a client proposal".into()
        }],
        "skills without a SKILL.md and agents are not listed"
    );
}

#[test]
fn no_login_or_no_file_is_full_access() {
    let kun = kun();
    for login in ["", "abdout"] {
        let r = resolve_in(kun.path(), login, DriverKind::Opencode).unwrap();
        assert!(!r.explicit && !r.driver_locked);
        assert_eq!(r.profile.access, Access::FULL);
        assert_eq!(r.profile.driver, DriverKind::Opencode);
        let names: Vec<&str> = r
            .profile
            .departments
            .iter()
            .map(|d| d.name.as_str())
            .collect();
        assert_eq!(names, ["sales", "video"]);
    }
}

#[test]
fn bad_logins_and_damaged_files_are_errors_not_full_access() {
    let kun = kun();
    for login in ["Moed", "../x", "a b"] {
        assert!(
            matches!(
                resolve_in(kun.path(), login, DriverKind::Claude),
                Err(ProfileError::BadLogin)
            ),
            "{login}"
        );
    }
    let machines = kun.path().join("machines");
    fs::write(machines.join("bad.json"), "{nope").unwrap();
    fs::write(machines.join("liar.json"), r#"{"login":"moed"}"#).unwrap();
    fs::write(
        machines.join("evil.json"),
        r#"{"login":"evil","repos":["../x"]}"#,
    )
    .unwrap();
    fs::write(
        machines.join("keys.json"),
        r#"{"login":"keys","secrets":["lower"]}"#,
    )
    .unwrap();
    for login in ["bad", "liar", "evil", "keys"] {
        assert!(
            matches!(
                resolve_in(kun.path(), login, DriverKind::Claude),
                Err(ProfileError::Corrupt(..))
            ),
            "{login}"
        );
    }
}

#[test]
fn a_profile_without_access_gets_the_least() {
    let kun = kun();
    fs::write(
        kun.path().join("machines/lite.json"),
        r#"{"login":"lite","departments":["video"]}"#,
    )
    .unwrap();
    let r = resolve_in(kun.path(), "lite", DriverKind::Claude).unwrap();
    assert_eq!(r.profile.access, Access::LEAST);
    assert!(!r.driver_locked);
}

#[test]
fn the_ts_shape_is_the_contract() {
    let kun = kun();
    let json = serde_json::to_value(
        resolve_in(kun.path(), "moed", DriverKind::Claude)
            .unwrap()
            .profile,
    )
    .unwrap();
    let mut keys: Vec<&str> = json
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "access",
            "departments",
            "driver",
            "hidden",
            "login",
            "name",
            "os",
            "repos"
        ]
    );
    assert_eq!(json["access"]["code"], "read");
    assert_eq!(json["departments"][0]["skills"][0]["name"], "proposal");
}

#[derive(Default)]
struct Memory(RefCell<HashMap<String, String>>);

impl SecretStore for Memory {
    fn set(&self, account: &str, value: &str) -> Result<(), String> {
        self.0.borrow_mut().insert(account.into(), value.into());
        Ok(())
    }
    fn get(&self, account: &str) -> Result<Option<String>, String> {
        Ok(self.0.borrow().get(account).cloned())
    }
}

#[test]
fn secrets_only_for_listed_names_and_trimmed() {
    let kun = kun();
    let r = resolve_in(kun.path(), "moed", DriverKind::Claude).unwrap();
    let store = Memory::default();
    assert!(!secret_present(&store, &r, "GEMINI_API_KEY").unwrap());
    store_secret(&store, &r, "GEMINI_API_KEY", "  key-1\n").unwrap();
    assert!(secret_present(&store, &r, "GEMINI_API_KEY").unwrap());
    assert_eq!(
        store.get("moed/GEMINI_API_KEY").unwrap().as_deref(),
        Some("key-1")
    );
    assert!(matches!(
        store_secret(&store, &r, "AWS_SECRET", "x"),
        Err(ProfileError::NotAllowed(_))
    ));
    assert!(matches!(
        secret_present(&store, &r, "AWS_SECRET"),
        Err(ProfileError::NotAllowed(_))
    ));
    for bad in ["", "  ", "a\u{0}b", &"x".repeat(9000)] {
        assert!(matches!(
            store_secret(&store, &r, "TWENTY_API_KEY", bad),
            Err(ProfileError::BadValue)
        ));
    }
    assert!(store.0.borrow().get("moed/TWENTY_API_KEY").is_none());
}

#[test]
fn a_run_gets_only_the_secrets_that_are_stored() {
    let kun = kun();
    let r = resolve_in(kun.path(), "moed", DriverKind::Claude).unwrap();
    let store = Memory::default();
    assert!(secret_env(&store, &r).unwrap().is_empty());
    store_secret(&store, &r, "GEMINI_API_KEY", "g").unwrap();
    assert_eq!(
        secret_env(&store, &r).unwrap(),
        vec![("GEMINI_API_KEY".to_owned(), "g".to_owned())]
    );
}

#[test]
fn hidden_skills_leave_the_menu_and_bad_ids_are_refused() {
    let kun = kun();
    fs::write(
        kun.path().join("machines/gated.json"),
        r#"{"login":"gated","departments":["sales"],"hidden":["skill:proposal"]}"#,
    )
    .unwrap();
    let r = resolve_in(kun.path(), "gated", DriverKind::Claude).unwrap();
    assert!(
        r.profile.departments[0]
            .skills
            .iter()
            .all(|s| s.name != "proposal")
    );
    assert_eq!(r.profile.hidden, vec!["skill:proposal".to_string()]);

    fs::write(
        kun.path().join("machines/bad.json"),
        r#"{"login":"bad","hidden":["../etc"]}"#,
    )
    .unwrap();
    assert!(matches!(
        resolve_in(kun.path(), "bad", DriverKind::Claude),
        Err(ProfileError::Corrupt(..))
    ));
}
