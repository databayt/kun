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
    symlink(&kun.path().join(".claude/skills/unused"), &stale).unwrap();
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
    let bare = info_in(kun.path(), "media").unwrap();
    assert_eq!((bare.title_en.as_str(), bare.quick_actions.len()), ("media", 0));
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
