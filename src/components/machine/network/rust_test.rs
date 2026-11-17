use std::sync::Mutex;

use super::{
    api::{Api, ApiError, api_base},
    health::{self, Facts, Heal, MIN_FREE_BYTES},
    host::fake::FakeHost,
    model::{LocalRepo, RepoMode},
    *,
};

fn repo(name: &str, behind: u32, dirty: bool) -> LocalRepo {
    LocalRepo {
        name: name.into(),
        mode: RepoMode::Keep,
        branch: "main".into(),
        behind,
        ahead: 0,
        dirty,
    }
}

fn healthy() -> FakeHost {
    FakeHost {
        driver: true,
        workspace: true,
        disk: Some(50 << 30),
        kun_behind: Some(0),
        ..FakeHost::default()
    }
}

fn key<'a>(r: &'a HealthReport, k: &str) -> &'a model::HealthItem {
    r.items
        .iter()
        .find(|i| i.key == k)
        .unwrap_or_else(|| panic!("no item {k}: {r:?}"))
}

#[test]
fn a_healthy_machine_needs_no_heal() {
    let host = healthy();
    assert_eq!(health::plan(&health::gather(&host)), Vec::new());
    let report = health::run_cycle(&host, "2026-11-17T00:00:00Z");
    assert!(report.items.iter().all(|i| i.ok && !i.healed), "{report:?}");
    assert!(host.calls().is_empty());
}

#[test]
fn plan_runs_kun_first_and_the_catalog_last_and_skips_dirty_repos() {
    let facts = Facts {
        driver_installed: true,
        outdated: vec!["skill:funnel".into()],
        repos: vec![
            repo("hogwarts", 3, false),
            repo("mkan", 2, true),
            repo("souq", 0, false),
        ],
        workspace_ready: false,
        disk_free_bytes: Some(MIN_FREE_BYTES),
        kun_behind: Some(1),
    };
    assert_eq!(
        health::plan(&facts),
        vec![
            Heal::Kun,
            Heal::Repo("hogwarts".into()),
            Heal::Workspace,
            Heal::Catalog("skill:funnel".into())
        ]
    );
}

#[test]
fn heals_are_reported_healed_and_failures_stay_needs_you() {
    let host = FakeHost {
        outdated: vec!["skill:funnel".into(), "skill:edit".into()],
        repos: vec![repo("hogwarts", 3, false), repo("mkan", 2, true)],
        workspace: false,
        kun_behind: Some(2),
        fail: vec!["catalog:skill:edit".into()],
        ..healthy()
    };
    let r = health::run_cycle(&host, "t");
    assert!(key(&r, "kun").healed && key(&r, "kun").ok);
    assert!(key(&r, "repo:hogwarts").healed);
    assert!(key(&r, "workspace").healed);
    let catalog = key(&r, "catalog");
    assert!(
        !catalog.ok && !catalog.healed && catalog.detail.contains("skill:edit: boom"),
        "{catalog:?}"
    );
    let mkan = key(&r, "repo:mkan");
    assert!(
        !mkan.ok && mkan.detail.contains("local changes"),
        "a dirty clone is never pulled: {mkan:?}"
    );
    assert!(!host.calls().contains(&"repo:mkan".to_owned()));
    assert_eq!(
        host.calls().first().map(String::as_str),
        Some("kun"),
        "kun is pulled first"
    );
}

#[test]
fn a_failed_kun_pull_is_not_healed_and_the_catalog_is_not_reread() {
    let host = FakeHost {
        kun_behind: Some(4),
        fail: vec!["kun".into()],
        ..healthy()
    };
    let r = health::run_cycle(&host, "t");
    let kun = key(&r, "kun");
    assert!(!kun.ok && !kun.healed && kun.detail.contains("boom"));
}

#[test]
fn driver_and_disk_are_reported_never_healed() {
    let host = FakeHost {
        driver: false,
        disk: Some(1 << 30),
        ..healthy()
    };
    let r = health::run_cycle(&host, "t");
    assert!(!key(&r, "driver").ok && !key(&r, "driver").healed);
    assert!(!key(&r, "disk").ok && key(&r, "disk").detail.contains("1 GB"));
    assert!(host.calls().is_empty());
    // Unknown free space is not an alarm.
    let unknown = health::run_cycle(
        &FakeHost {
            disk: None,
            ..healthy()
        },
        "t",
    );
    assert!(key(&unknown, "disk").ok);
}

#[test]
fn the_sprint_sweep_is_an_item_only_when_it_did_something() {
    let r = health::run_cycle(
        &FakeHost {
            swept: vec!["removed mkan".into()],
            ..healthy()
        },
        "t",
    );
    assert!(key(&r, "sprint").healed);
    assert!(
        health::run_cycle(&healthy(), "t")
            .items
            .iter()
            .all(|i| i.key != "sprint")
    );
}

#[test]
fn contract_limits_hold() {
    let many: Vec<LocalRepo> = (0..150).map(|i| repo(&format!("r{i}"), 0, false)).collect();
    let r = health::run_cycle(
        &FakeHost {
            repos: many,
            ..healthy()
        },
        "t",
    );
    assert!(r.items.len() <= 100);
    let long = FakeHost {
        kun_behind: Some(1),
        fail: vec!["kun".into()],
        ..healthy()
    };
    assert!(
        health::run_cycle(&long, "t")
            .items
            .iter()
            .all(|i| i.detail.chars().count() <= 500 && i.key.len() <= 80)
    );
}

#[test]
fn api_base_prefers_the_env_then_the_build() {
    assert_eq!(api_base(Some("http://x.test/"), false), "http://x.test");
    assert_eq!(api_base(Some("  "), false), "https://kun.databayt.org");
    assert_eq!(api_base(None, true), "http://localhost:3000");
    assert_eq!(api_base(None, false), "https://kun.databayt.org");
}

#[test]
fn iso_time_is_rfc3339_utc() {
    assert_eq!(iso_from_unix(0), "1970-01-01T00:00:00Z");
    assert_eq!(iso_from_unix(1_700_000_000), "2023-11-14T22:13:20Z");
    assert_eq!(
        iso_from_unix(1_709_164_800 + 86_399),
        "2024-02-29T23:59:59Z"
    );
}

#[test]
fn task_ids_and_recipients_are_validated() {
    assert!(valid_task_id("databayt/hogwarts#40"));
    assert!(valid_task_id("databayt/kun.site_x-1#7"));
    for bad in [
        "hogwarts#40",
        "databayt/hogwarts",
        "databayt/#4",
        "databayt/Hogwarts#4",
        "databayt/a#x",
        "databayt/a#1/../b",
        "",
    ] {
        assert!(!valid_task_id(bad), "{bad}");
    }
}

/// Records every request and answers from a script.
struct Mock {
    seen: Mutex<Vec<(String, String)>>,
    answer: Result<String, (u16, String)>,
}

impl Mock {
    fn ok(body: &str) -> Self {
        Self {
            seen: Mutex::new(Vec::new()),
            answer: Ok(body.to_owned()),
        }
    }

    fn reply(&self, method: &str, path: &str, body: &str) -> Result<String, ApiError> {
        self.seen
            .lock()
            .unwrap()
            .push((format!("{method} {path}"), body.to_owned()));
        self.answer
            .clone()
            .map_err(|(status, body)| ApiError::Status { status, body })
    }
}

impl Api for Mock {
    async fn get(&self, path: &str) -> Result<String, ApiError> {
        self.reply("GET", path, "")
    }

    async fn post(&self, path: &str, body: String) -> Result<String, ApiError> {
        self.reply("POST", path, &body)
    }
}

#[tokio::test]
async fn a_pass_posts_the_contract_heartbeat_and_returns_unread() {
    let host = Arc::new(FakeHost {
        repos: vec![repo("hogwarts", 0, true)],
        task: Some("databayt/kun#9".into()),
        ..healthy()
    });
    let api = Mock::ok(r#"{"ok":true,"serverTime":"t","unread":3}"#);
    let cycle = sync_once(&host, &api, "2026-11-17T10:00:00Z")
        .await
        .unwrap();
    assert_eq!(cycle.unread.unwrap(), 3);
    let seen = api.seen.lock().unwrap();
    assert_eq!(seen.len(), 1);
    assert_eq!(seen[0].0, "POST /api/machine/heartbeat");
    let v: serde_json::Value = serde_json::from_str(&seen[0].1).unwrap();
    assert_eq!(v["health"]["checkedAt"], "2026-11-17T10:00:00Z");
    assert_eq!(v["currentTask"], "databayt/kun#9");
    assert_eq!(
        v["repos"][0],
        serde_json::json!({"name":"hogwarts","mode":"keep","branch":"main","behind":0,"ahead":0,"dirty":true})
    );
    assert!(v["appVersion"].is_string() && v["os"].is_string());
    assert!(v["health"]["items"][0].get("key").is_some());
}

#[tokio::test]
async fn a_failed_heartbeat_still_returns_the_report() {
    let host = Arc::new(healthy());
    let api = Mock {
        seen: Mutex::new(Vec::new()),
        answer: Err((503, "down".into())),
    };
    let cycle = sync_once(&host, &api, "t").await.unwrap();
    assert!(matches!(
        cycle.unread,
        Err(ApiError::Status { status: 503, .. })
    ));
    assert!(!cycle.report.items.is_empty());
}

#[tokio::test]
async fn messages_are_validated_before_they_are_sent() {
    let api = Mock::ok("{}");
    for (to, text, task) in [
        ("Bad Login", "hi", None),
        ("ali", "   ", None),
        ("ali", "hi", Some("nope".to_owned())),
    ] {
        assert!(matches!(
            send_with(&api, to, MessageKind::Note, text, task).await,
            Err(NetError::Invalid(_))
        ));
    }
    assert!(api.seen.lock().unwrap().is_empty());
    send_with(
        &api,
        "ali",
        MessageKind::Nudge,
        "  look at this  ",
        Some("databayt/kun#1".into()),
    )
    .await
    .unwrap();
    let seen = api.seen.lock().unwrap();
    assert_eq!(seen[0].0, "POST /api/machine/messages");
    let v: serde_json::Value = serde_json::from_str(&seen[0].1).unwrap();
    assert_eq!(
        v,
        serde_json::json!({"to":"ali","kind":"nudge","body":{"text":"look at this","taskId":"databayt/kun#1"}})
    );
}

#[test]
fn contract_answers_deserialize() {
    let team: TeamResponse = serde_json::from_str(
        r#"{"machines":[{"login":"ali","name":"Ali","os":"macos","departments":["sales"],"lastSeenAt":null,"healthOk":true,"currentTask":null}]}"#,
    )
    .unwrap();
    assert_eq!(team.machines[0].health_ok, Some(true));
    let msgs: MessagesResponse = serde_json::from_str(
        r#"{"messages":[{"id":"1","from":"abdout","to":"ali","kind":"job","body":{"text":"go","taskId":"databayt/kun#2"},"createdAt":"t","readAt":null}]}"#,
    )
    .unwrap();
    assert_eq!(msgs.messages[0].kind, MessageKind::Job);
}

#[test]
fn the_token_is_trimmed_validated_and_kept_per_login() {
    use std::{cell::RefCell, collections::HashMap};
    struct Mem(RefCell<HashMap<String, String>>);
    impl crate::profile::SecretStore for Mem {
        fn set(&self, a: &str, v: &str) -> Result<(), String> {
            self.0.borrow_mut().insert(a.to_owned(), v.to_owned());
            Ok(())
        }
        fn get(&self, a: &str) -> Result<Option<String>, String> {
            Ok(self.0.borrow().get(a).cloned())
        }
    }
    let m = Mem(RefCell::new(HashMap::new()));
    token::store(&m, "ali", "  abc123\n").unwrap();
    assert_eq!(token::read(&m, "ali").unwrap().as_deref(), Some("abc123"));
    assert_eq!(token::read(&m, "sara").unwrap(), None);
    for bad in ["", "   ", "a b", "a\u{7}b"] {
        assert!(token::store(&m, "ali", bad).is_err(), "{bad:?}");
    }
    token::store(&m, "", "dev").unwrap();
    assert_eq!(token::read(&m, "").unwrap().as_deref(), Some("dev"));
}
