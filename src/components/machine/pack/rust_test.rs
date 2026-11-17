use super::*;

fn kun_fixture() -> tempfile::TempDir {
    let kun = tempfile::tempdir().unwrap();
    let dept = kun.path().join("departments/sales");
    fs::create_dir_all(&dept).unwrap();
    fs::write(dept.join("prompt.md"), "You are Sales.\n").unwrap();
    fs::write(
        dept.join("pack.json"),
        r#"{"name":"sales","title":{"ar":"المبيعات","en":"Sales"},"items":["skills/edit","funnel",{"name":"nope"},"../evil"],
            "defaultDriver":"codex",
            "quickActions":[{"label_ar":"عرض","label_en":"Proposal","prompt":"Draft a proposal"},{"label_ar":"x","label_en":"x","prompt":" "}]}"#,
    )
    .unwrap();
    for s in ["edit", "funnel", "unused"] {
        fs::create_dir_all(kun.path().join(".claude/skills").join(s)).unwrap();
    }
    fs::write(kun.path().join("CLAUDE.md"), "# kun").unwrap();
    kun
}

#[test]
fn builds_folder_with_context_and_skill_links() {
    let kun = kun_fixture();
    let home = tempfile::tempdir().unwrap();
    let dir = ensure_in(kun.path(), home.path(), "sales").unwrap();

    let claude = fs::read_to_string(dir.join("CLAUDE.md")).unwrap();
    assert!(claude.starts_with("You are Sales.\n"));
    assert!(claude.contains(&format!("@{}/CLAUDE.md", kun.path().display())));
    assert!(fs::read_to_string(dir.join("AGENTS.md")).unwrap().contains("Company rules: read"));

    let skills = dir.join(".claude/skills");
    assert!(skills.join("edit").exists() && skills.join("funnel").exists());
    assert!(!skills.join("unused").exists());
    assert!(!dir.join(".agents").exists(), "no .agents/skills in kun, none linked");
}

#[test]
fn is_idempotent_and_prunes_stale_links() {
    let kun = kun_fixture();
    let home = tempfile::tempdir().unwrap();
    let dir = ensure_in(kun.path(), home.path(), "sales").unwrap();
    let stale = dir.join(".claude/skills/unused");
    link::symlink(&kun.path().join(".claude/skills/unused"), &stale).unwrap();
    let mine = dir.join(".claude/skills/mine");
    fs::create_dir_all(&mine).unwrap();

    let again = ensure_in(kun.path(), home.path(), "sales").unwrap();
    assert_eq!(dir, again);
    assert!(fs::symlink_metadata(&stale).is_err(), "stale link of ours is removed");
    assert!(mine.is_dir(), "real folders are never touched");
    assert!(dir.join(".claude/skills/edit").exists());
}

#[test]
fn rejects_bad_names_and_missing_packs() {
    let kun = kun_fixture();
    let home = tempfile::tempdir().unwrap();
    for bad in ["", "../x", "a/b", ".hidden", "-x"] {
        assert!(matches!(ensure_in(kun.path(), home.path(), bad), Err(PackError::BadName)), "{bad}");
    }
    assert!(matches!(ensure_in(kun.path(), home.path(), "legal"), Err(PackError::Missing(..))));
}

#[test]
fn info_reads_titles_and_drops_empty_quick_actions() {
    let kun = kun_fixture();
    let info = info_in(kun.path(), "sales").unwrap();
    assert_eq!(info.title_ar, "المبيعات");
    assert_eq!(info.default_driver, Some(DriverKind::Codex));
    assert_eq!(info.quick_actions.len(), 1);
    let bare = info_in(kun.path(), "video").unwrap();
    assert_eq!((bare.title_en.as_str(), bare.quick_actions.len()), ("video", 0));
}

#[test]
fn lists_departments_with_a_prompt() {
    let kun = kun_fixture();
    fs::create_dir_all(kun.path().join("departments/empty")).unwrap();
    assert_eq!(departments_in(kun.path()), vec!["sales".to_string()]);
}

#[test]
fn item_names_are_filtered() {
    let v: Vec<Value> = serde_json::from_str(r#"["skills/edit","..",{"name":"funnel"},3]"#).unwrap();
    assert_eq!(item_names(&v), vec!["edit".to_string(), "funnel".into()]);
}

#[test]
fn catalog_ids_select_only_skills() {
    let v: Vec<Value> = serde_json::from_str(r#"["skill:scrape", "agent:lead", "skill:funnel", "pack:sales"]"#).unwrap();
    assert_eq!(item_names(&v), vec!["scrape".to_string(), "funnel".into()]);
}

// ---- workspace ----

use crate::profile::{Access, CatalogAccess, CodeAccess, Department, MachineProfile, WorkspaceAccess};

fn profile(code: CodeAccess) -> MachineProfile {
    MachineProfile {
        login: "moed".into(),
        name: "معد".into(),
        os: "windows".into(),
        driver: DriverKind::Claude,
        departments: ["sales"]
            .map(|d| Department { name: d.into(), title: d.into(), title_ar: None, quick_actions: Vec::new(), skills: Vec::new() })
            .into(),
        repos: vec!["kun".into(), "hogwarts".into(), "mkan".into()],
        access: Access { code, workspace: WorkspaceAccess::Write, catalog: CatalogAccess::Profile, engine: false },
        hidden: Vec::new(),
    }
}

#[test]
fn read_only_settings_are_pinned() {
    let json = settings_json(Path::new("/home/moed/Kun/repos"), Path::new("/home/moed/Kun/moed/work"), &profile(CodeAccess::Read).access);
    insta::assert_snapshot!("read_only_settings", json);
}

#[test]
fn write_access_has_no_repo_denies_and_no_work_means_no_writes() {
    let repos = Path::new("/r");
    let work = Path::new("/w");
    let write: serde_json::Value = serde_json::from_str(&settings_json(repos, work, &Access::FULL)).unwrap();
    assert_eq!(write["permissions"]["deny"].as_array().unwrap().len(), 0);
    let none = Access { workspace: WorkspaceAccess::None, ..Access::FULL };
    let v: serde_json::Value = serde_json::from_str(&settings_json(repos, work, &none)).unwrap();
    assert_eq!(v["permissions"]["allow"].as_array().unwrap().len(), 0);
    assert!(v["permissions"]["deny"].as_array().unwrap().iter().any(|r| r == "Write(//w/**)"));
}

#[test]
fn rule_paths_follow_claude_code_spelling() {
    assert_eq!(workspace::rule_path(Path::new("/Users/a/Kun/repos")), "//Users/a/Kun/repos");
    assert_eq!(workspace::rule_path(Path::new("C:\\Users\\Moed\\Kun\\repos")), "//c/Users/Moed/Kun/repos");
}

#[test]
fn the_workspace_has_rules_knowledge_work_and_settings() {
    let kun = kun_fixture();
    let docs = kun.path().join("content/docs");
    fs::create_dir_all(&docs).unwrap();
    fs::write(docs.join("pricing.mdx"), "---\ntitle: Pricing\ndescription: The SAR anchors\n---\nbody").unwrap();
    let root = tempfile::tempdir().unwrap();
    let block = root.path().join("repos/hogwarts/src/components/attendance");
    fs::create_dir_all(&block).unwrap();
    fs::write(block.join("README.md"), "# Attendance\n\nTeachers mark the class in one tap.\nParents get a message.\n").unwrap();
    fs::create_dir_all(root.path().join("repos/mkan")).unwrap();
    fs::write(root.path().join("repos/mkan/README.md"), "# Mkan\nRentals in Sudan.").unwrap();

    let ws = ensure_workspace_in(kun.path(), root.path(), &profile(CodeAccess::Read)).unwrap();
    assert_eq!(ws.dir, root.path().join("moed"));
    assert!(ws.work.is_dir() && ws.repos.is_dir());

    let claude = fs::read_to_string(ws.dir.join("CLAUDE.md")).unwrap();
    assert!(claude.contains("KNOWLEDGE.md") && claude.contains("Arabic first") && claude.contains("You are Sales."));
    assert!(claude.contains(&ws.work.display().to_string()));
    assert_eq!(fs::read_to_string(ws.dir.join("AGENTS.md")).unwrap(), claude);

    let knowledge = fs::read_to_string(ws.dir.join("KNOWLEDGE.md")).unwrap();
    assert!(knowledge.contains("**Pricing**") && knowledge.contains("The SAR anchors"));
    assert!(knowledge.contains("**attendance**") && knowledge.contains("Teachers mark the class in one tap."));
    assert!(knowledge.contains("Rentals in Sudan."));
    for step in ["30-second pitch", "Demo path", "Video shot list"] {
        assert!(knowledge.contains(step), "{step}");
    }

    let settings: serde_json::Value = serde_json::from_str(&fs::read_to_string(&ws.settings_file).unwrap()).unwrap();
    assert!(settings["permissions"]["deny"].as_array().unwrap().iter().any(|r| r == "Bash(git push*)"));
    assert!(ws.dir.join(".claude/skills/edit").exists() && ws.dir.join(".claude/skills/funnel").exists());

    // idempotent, and `work/` is never touched
    fs::write(ws.work.join("draft.md"), "mine").unwrap();
    let again = ensure_workspace_in(kun.path(), root.path(), &profile(CodeAccess::Read)).unwrap();
    assert_eq!(ws, again);
    assert_eq!(fs::read_to_string(ws.work.join("draft.md")).unwrap(), "mine");
}

#[test]
fn knowledge_skips_repos_the_profile_does_not_list() {
    let kun = kun_fixture();
    let root = tempfile::tempdir().unwrap();
    fs::create_dir_all(root.path().join("repos/mkan")).unwrap();
    fs::write(root.path().join("repos/mkan/README.md"), "secret mkan").unwrap();
    let mut p = profile(CodeAccess::Read);
    p.repos = vec!["kun".into()];
    let k = workspace::knowledge_md(kun.path(), &root.path().join("repos"), &p);
    assert!(!k.contains("secret mkan"));
}

#[test]
fn workspace_names_are_checked() {
    let kun = kun_fixture();
    let root = tempfile::tempdir().unwrap();
    let mut p = profile(CodeAccess::Read);
    p.login = "../x".into();
    assert!(matches!(ensure_workspace_in(kun.path(), root.path(), &p), Err(PackError::BadName)));
}

#[test]
fn copied_skill_folders_are_refreshed_and_pruned() {
    let src = tempfile::tempdir().unwrap();
    let dest = tempfile::tempdir().unwrap();
    fs::create_dir_all(src.path().join("edit")).unwrap();
    fs::write(src.path().join("edit/SKILL.md"), "v1").unwrap();
    let copy = dest.path().join("edit");
    link::copy_dir(&src.path().join("edit"), &copy).unwrap();
    assert!(copy.join(link::COPY_MARKER).is_file());
    fs::write(src.path().join("edit/SKILL.md"), "v2").unwrap();
    link::link_skills(src.path(), dest.path(), &["edit".to_owned()]).unwrap();
    assert_eq!(fs::read_to_string(dest.path().join("edit/SKILL.md")).unwrap(), "v2");
    link::link_skills(src.path(), dest.path(), &[]).unwrap();
    assert!(!dest.path().join("edit").exists(), "an unwanted copy of ours is removed");
}

// ---- repos ----

fn git(dir: &Path, args: &[&str]) -> bool {
    std::process::Command::new("git")
        .args(["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"])
        .args(args)
        .current_dir(dir)
        .status()
        .is_ok_and(|s| s.success())
}

#[test]
fn git_args_clone_shallow_then_fast_forward_only() {
    let root = tempfile::tempdir().unwrap();
    let (clone, cwd) = repos::git_args("https://github.com/databayt", root.path(), "mkan");
    assert_eq!(
        clone,
        ["clone", "--depth", "50", "--", "https://github.com/databayt/mkan.git", &root.path().join("mkan").display().to_string()]
    );
    assert!(cwd.is_none());
    fs::create_dir_all(root.path().join("mkan/.git")).unwrap();
    let (pull, cwd) = repos::git_args("https://github.com/databayt", root.path(), "mkan");
    assert_eq!(pull, ["pull", "--ff-only"]);
    assert_eq!(cwd, Some(root.path().join("mkan")));
}

#[tokio::test]
async fn sync_clones_then_pulls_a_local_origin() {
    let origins = tempfile::tempdir().unwrap();
    let work = origins.path().join("work");
    fs::create_dir_all(&work).unwrap();
    if !git(&work, &["init", "-q", "-b", "main"]) {
        return; // no git on this machine
    }
    fs::write(work.join("README.md"), "one").unwrap();
    assert!(git(&work, &["add", "."]) && git(&work, &["commit", "-q", "-m", "one"]));
    let bare = origins.path().join("demo.git");
    assert!(git(origins.path(), &["clone", "-q", "--bare", work.to_str().unwrap(), bare.to_str().unwrap()]));

    let root = tempfile::tempdir().unwrap();
    let url = origins.path().display().to_string();
    let mut events = Vec::new();
    repos::sync_all(root.path(), &["demo".to_owned()], &url, |e| events.push((e.state, e.repo))).await.unwrap();
    assert_eq!(events, vec![(SyncState::Cloning, "demo".into()), (SyncState::Done, "demo".into())]);
    assert_eq!(fs::read_to_string(root.path().join("demo/README.md")).unwrap(), "one");

    fs::write(work.join("README.md"), "two").unwrap();
    assert!(git(&work, &["commit", "-q", "-am", "two"]) && git(&work, &["push", "-q", bare.to_str().unwrap(), "main"]));
    let mut again = Vec::new();
    repos::sync_all(root.path(), &["demo".to_owned(), "missing".to_owned()], &url, |e| again.push((e.state, e.repo))).await.unwrap();
    assert_eq!(again[0], (SyncState::Pulling, "demo".into()));
    assert_eq!(again[1], (SyncState::Done, "demo".into()));
    assert_eq!(again[3], (SyncState::Failed, "missing".into()), "a failing repo does not stop the run");
    assert_eq!(fs::read_to_string(root.path().join("demo/README.md")).unwrap(), "two");
}

#[tokio::test]
async fn sync_refuses_unsafe_repo_names() {
    let root = tempfile::tempdir().unwrap();
    let got = repos::sync_all(root.path(), &["../evil".to_owned()], "x", |_| {}).await;
    assert!(matches!(got, Err(PackError::BadRepo(_))));
}
