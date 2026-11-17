use std::sync::Mutex;

use super::{
    model::{KunBlock, Readiness, ReadyState, Task, TaskStatus, TasksResponse},
    readiness::{self, Facts, readiness as verdict},
    *,
};
use crate::{
    catalog::ItemStatus,
    network::{
        host::fake::FakeHost,
        model::{LocalRepo, RepoMode},
    },
};

fn task(id_n: u32) -> Task {
    Task {
        id: format!("databayt/hogwarts#{id_n}"),
        repo: "hogwarts".into(),
        number: id_n,
        title: "Draft the pilot proposal".into(),
        url: format!("https://github.com/databayt/hogwarts/issues/{id_n}"),
        department: "sales".into(),
        status: TaskStatus::Todo,
        holder: None,
        priority: Some(1),
        sprint: Some("Sprint 3".into()),
        order: 0,
        kun: KunBlock {
            repos: vec!["hogwarts".into()],
            items: vec!["skill:proposal".into()],
            after: Vec::new(),
        },
        after_open: Vec::new(),
        body: "Quote Al-Ibda.".into(),
        updated_at: "t".into(),
    }
}

fn clone_of(name: &str, behind: u32) -> LocalRepo {
    LocalRepo {
        name: name.into(),
        mode: RepoMode::Keep,
        branch: "main".into(),
        behind,
        ahead: 0,
        dirty: false,
    }
}

fn ready_facts() -> Facts {
    Facts {
        me: "ali".into(),
        repos: vec![clone_of("hogwarts", 0)],
        items: vec![("skill:proposal".into(), ItemStatus::Installed)],
        allowed_items: None,
        allowed_repos: Vec::new(),
    }
}

fn run(t: &Task, f: &Facts) -> Readiness {
    verdict(t, f, 0, 1)
}

#[test]
fn a_task_with_everything_in_place_is_ready() {
    let r = run(&task(1), &ready_facts());
    assert_eq!((r.state, r.missing.is_empty()), (ReadyState::Ready, true));
}

#[test]
fn missing_and_stale_repos_and_items_say_what_to_fetch() {
    let mut f = ready_facts();
    f.repos = vec![clone_of("hogwarts", 2)];
    f.items = vec![("skill:proposal".into(), ItemStatus::Outdated)];
    let r = run(&task(1), &f);
    assert_eq!(r.state, ReadyState::Missing);
    assert_eq!(r.missing, ["behind:hogwarts", "item:skill:proposal"]);
    f.repos.clear();
    f.items.clear();
    assert_eq!(
        run(&task(1), &f).missing,
        ["repo:hogwarts", "item:skill:proposal"]
    );
}

#[test]
fn open_afters_a_foreign_holder_and_a_full_wip_block() {
    let mut t = task(2);
    t.after_open = vec!["databayt/hogwarts#1".into()];
    t.holder = Some("sara".into());
    let r = verdict(&t, &ready_facts(), 1, 1);
    assert_eq!(r.state, ReadyState::Blocked);
    assert_eq!(r.missing, ["after:databayt/hogwarts#1", "held:sara", "wip"]);
}

#[test]
fn my_own_task_is_ready_even_when_wip_is_full() {
    let mut t = task(3);
    t.holder = Some("ali".into());
    t.status = TaskStatus::InProgress;
    assert_eq!(verdict(&t, &ready_facts(), 1, 1).state, ReadyState::Ready);
    // A second task is refused while one is in progress, and allowed once the CEO sets wip:2.
    assert_eq!(
        verdict(&task(4), &ready_facts(), 1, 1).state,
        ReadyState::Blocked
    );
    assert_eq!(
        verdict(&task(4), &ready_facts(), 1, 2).state,
        ReadyState::Ready
    );
}

#[test]
fn the_profile_can_forbid_items_and_repos() {
    let mut f = ready_facts();
    f.allowed_items = Some(vec!["skill:pricing".into()]);
    f.allowed_repos = vec!["mkan".into()];
    let r = run(&task(5), &f);
    assert_eq!(r.state, ReadyState::Blocked);
    assert_eq!(r.missing, ["profile:hogwarts", "profile:skill:proposal"]);
    // `databayt/<repo>` and the bare name are the same repo.
    let mut t = task(6);
    t.kun.repos = vec!["databayt/hogwarts".into()];
    assert_eq!(run(&t, &ready_facts()).state, ReadyState::Ready);
}

#[test]
fn a_machine_without_a_login_holds_nothing() {
    let mut f = ready_facts();
    f.me = String::new();
    let mut t = task(7);
    t.holder = Some("ali".into());
    assert_eq!(run(&t, &f).missing, ["held:ali"]);
}

#[test]
fn the_seed_round_trips_and_names_its_task() {
    let t = task(8);
    let text = readiness::seed_text(&t);
    assert!(
        text.contains("# Draft the pilot proposal")
            && text.contains("Quote Al-Ibda.")
            && text.contains("KNOWLEDGE.md")
    );
    assert_eq!(
        readiness::seed_repos(&text, &t.id),
        Some(vec!["hogwarts".to_owned()])
    );
    assert_eq!(
        readiness::seed_repos(&text, "databayt/hogwarts#9"),
        None,
        "another task's seed is not this one's"
    );
    assert_eq!(readiness::seed_repos("# not a seed", &t.id), None);
}

/// Serves a canned task list and records the claims.
struct Server {
    tasks: TasksResponse,
    claim: Result<String, (u16, String)>,
    posts: Mutex<Vec<(String, String)>>,
}

impl Api for Server {
    async fn get(&self, path: &str) -> Result<String, ApiError> {
        assert!(path.starts_with("/api/machine/tasks?department="), "{path}");
        Ok(serde_json::to_string(&self.tasks).unwrap())
    }

    async fn post(&self, path: &str, body: String) -> Result<String, ApiError> {
        self.posts.lock().unwrap().push((path.to_owned(), body));
        self.claim
            .clone()
            .map_err(|(status, body)| ApiError::Status { status, body })
    }
}

fn server(board: Vec<Task>, in_progress: u32) -> Server {
    Server {
        tasks: TasksResponse {
            sprint: None,
            mine: Vec::new(),
            board,
            in_progress,
            wip_limit: 1,
        },
        claim: Ok(String::new()),
        posts: Mutex::new(Vec::new()),
    }
}

fn depts() -> Vec<String> {
    vec!["sales".into()]
}

#[tokio::test]
async fn start_claims_then_writes_the_seed() {
    let t = task(10);
    let mut s = server(vec![t.clone()], 0);
    s.claim = Ok(serde_json::json!({ "ok": true, "task": { "id": t.id, "repo": "hogwarts", "number": 10, "title": "Draft the pilot proposal", "url": "u",
        "department": "sales", "status": "in-progress", "holder": "ali", "priority": 1, "sprint": null, "order": 0,
        "kun": { "repos": ["hogwarts"], "items": [], "after": [] }, "afterOpen": [], "body": "b", "updatedAt": "t" } }).to_string());
    let dir = tempfile::tempdir().unwrap();
    let started = start_with(&s, &ready_facts(), &depts(), dir.path(), &t.id)
        .await
        .unwrap();
    assert_eq!(started.status, TaskStatus::InProgress);
    assert_eq!(s.posts.lock().unwrap()[0].0, "/api/machine/claim");
    let seed = fs::read_to_string(dir.path().join(SEED_FILE)).unwrap();
    assert_eq!(
        readiness::seed_repos(&seed, &t.id),
        Some(vec!["hogwarts".to_owned()])
    );
}

#[tokio::test]
async fn start_refuses_before_claiming_when_the_gate_says_no() {
    let t = task(11);
    let s = server(vec![t.clone()], 1);
    let dir = tempfile::tempdir().unwrap();
    let err = start_with(&s, &ready_facts(), &depts(), dir.path(), &t.id)
        .await
        .unwrap_err();
    assert!(
        matches!(&err, TaskError::NotReady(m) if m == &["wip"]),
        "{err}"
    );
    assert!(s.posts.lock().unwrap().is_empty(), "nothing was claimed");
    assert!(!dir.path().join(SEED_FILE).exists());
    let gone = start_with(
        &s,
        &ready_facts(),
        &depts(),
        dir.path(),
        "databayt/hogwarts#99",
    )
    .await
    .unwrap_err();
    assert!(matches!(gone, TaskError::NotFound));
    let bad = start_with(&s, &ready_facts(), &depts(), dir.path(), "x")
        .await
        .unwrap_err();
    assert!(matches!(bad, TaskError::Invalid(_)));
}

#[tokio::test]
async fn a_server_refusal_is_surfaced_and_leaves_no_seed() {
    let t = task(12);
    let mut s = server(vec![t.clone()], 0);
    s.claim = Err((409, r#"{"error":"held","detail":"sara has it"}"#.into()));
    let dir = tempfile::tempdir().unwrap();
    let err = start_with(&s, &ready_facts(), &depts(), dir.path(), &t.id)
        .await
        .unwrap_err();
    assert!(
        matches!(&err, TaskError::Refused(m) if m == "held: sara has it"),
        "{err}"
    );
    assert!(!dir.path().join(SEED_FILE).exists());
}

#[tokio::test]
async fn restarting_my_own_task_skips_the_claim() {
    let mut t = task(13);
    t.holder = Some("ali".into());
    t.status = TaskStatus::InProgress;
    let s = server(vec![t.clone()], 1);
    let dir = tempfile::tempdir().unwrap();
    start_with(&s, &ready_facts(), &depts(), dir.path(), &t.id)
        .await
        .unwrap();
    assert!(s.posts.lock().unwrap().is_empty());
    assert!(dir.path().join(SEED_FILE).exists());
}

#[tokio::test]
async fn release_and_done_validate_and_post() {
    let mut s = server(Vec::new(), 0);
    s.claim = Ok(r#"{"ok":true}"#.into());
    release_with(&s, "databayt/kun#3").await.unwrap();
    finish_with(&s, "databayt/kun#3", "  shipped  ")
        .await
        .unwrap();
    {
        let posts = s.posts.lock().unwrap();
        assert_eq!(posts[0].0, "/api/machine/release");
        assert_eq!(posts[1].0, "/api/machine/done");
        let body: serde_json::Value = serde_json::from_str(&posts[1].1).unwrap();
        assert_eq!(
            body,
            serde_json::json!({ "id": "databayt/kun#3", "summary": "shipped" })
        );
    }
    assert!(matches!(
        finish_with(&s, "databayt/kun#3", "  ").await,
        Err(TaskError::Invalid(_))
    ));
    assert!(matches!(
        release_with(&s, "kun#3").await,
        Err(TaskError::Invalid(_))
    ));
    let mut no = server(Vec::new(), 0);
    no.claim = Ok(r#"{"ok":false,"error":"not-found"}"#.into());
    assert!(
        matches!(release_with(&no, "databayt/kun#3").await, Err(TaskError::Refused(m)) if m == "not-found")
    );
}

#[test]
fn facts_come_from_the_host() {
    let host = FakeHost {
        login: "ali".into(),
        repos: vec![clone_of("hogwarts", 0)],
        items: vec![("skill:proposal".into(), ItemStatus::Installed)],
        allowed_repos: vec!["hogwarts".into()],
        ..FakeHost::default()
    };
    let f = gather_facts(&host);
    assert_eq!(
        (
            f.me.as_str(),
            f.repos.len(),
            f.items.len(),
            f.allowed_repos.len()
        ),
        ("ali", 1, 1, 1)
    );
}

#[test]
fn a_tasks_repo_dirs_are_the_matching_local_clones() {
    let host = FakeHost {
        paths: vec!["/w/repos/hogwarts".into(), "/w/repos/mkan".into()],
        ..FakeHost::default()
    };
    let dirs = task_repo_dirs(&host, &["hogwarts".into(), "kun".into()]);
    assert_eq!(dirs, vec![PathBuf::from("/w/repos/hogwarts")]);
}
