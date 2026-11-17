use std::{fs, path::Path};

use super::*;

/// A throwaway kun checkout + claude dir + kun home, with a registry built from real files.
struct World {
    _root: tempfile::TempDir,
    env: Env,
}

fn item(id: &str, deps: &[&str], files: &[(&str, &str, &str)]) -> serde_json::Value {
    let (kind, name) = id.split_once(':').unwrap();
    serde_json::json!({
        "id": id, "name": name, "type": format!("kun:{kind}"), "title": name,
        "description": "", "keywords": [], "dependencies": deps, "version": format!("v-{id}"),
        "files": files.iter().map(|(p, t, body)| serde_json::json!({
            "path": p, "target": t, "sha256": sha256_hex(body.as_bytes()),
        })).collect::<Vec<_>>(),
    })
}

fn world(items: &[serde_json::Value], sources: &[(&str, &str)]) -> World {
    let root = tempfile::tempdir().unwrap();
    let env = Env {
        kun_dir: root.path().join("kun"),
        claude_dir: root.path().join("claude"),
        kun_home: root.path().join("home"),
    };
    for (path, body) in sources {
        let p = env.kun_dir.join(path);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, body).unwrap();
    }
    let reg = env.kun_dir.join("public/r/kun/index.json");
    fs::create_dir_all(reg.parent().unwrap()).unwrap();
    fs::write(reg, serde_json::json!({ "items": items }).to_string()).unwrap();
    World { _root: root, env }
}

/// funnel skill (2 files), lead agent, and a pack that needs both.
fn standard() -> World {
    world(
        &[
            item(
                "skill:funnel",
                &[],
                &[
                    (
                        ".claude/skills/funnel/SKILL.md",
                        "skills/funnel/SKILL.md",
                        "# funnel",
                    ),
                    (
                        ".claude/skills/funnel/scripts/run.sh",
                        "skills/funnel/scripts/run.sh",
                        "echo hi",
                    ),
                ],
            ),
            item(
                "agent:lead",
                &[],
                &[(".claude/agents/lead.md", "agents/lead.md", "# lead")],
            ),
            item(
                "pack:sales",
                &["skill:funnel", "agent:lead"],
                &[(
                    "departments/sales/pack.json",
                    "departments/sales/pack.json",
                    "{}",
                )],
            ),
        ],
        &[
            (".claude/skills/funnel/SKILL.md", "# funnel"),
            (".claude/skills/funnel/scripts/run.sh", "echo hi"),
            (".claude/agents/lead.md", "# lead"),
            ("departments/sales/pack.json", "{}"),
        ],
    )
}

fn status(env: &Env, id: &str) -> ItemStatus {
    list_items(env)
        .unwrap()
        .into_iter()
        .find(|i| i.id == id)
        .unwrap()
        .status
}

fn rel_files(dir: &Path) -> Vec<String> {
    let mut v: Vec<String> = walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|e| e.file_type().is_file())
        .map(|e| {
            e.path()
                .strip_prefix(dir)
                .unwrap()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    v.sort();
    v
}

#[test]
fn fixture_registry_parses() {
    let reg: Registry = serde_json::from_str(include_str!("fixtures/index.json")).unwrap();
    assert_eq!(reg.items.len(), 3);
    let pack = reg.items.iter().find(|i| i.id == "pack:sales").unwrap();
    assert_eq!(pack.kind, "kun:pack");
    assert!(pack.dependencies.contains(&"agent:lead".to_string()));
    assert_eq!(pack.status, ItemStatus::Available);
}

#[test]
fn install_copies_files_and_records_lock() {
    let w = standard();
    assert_eq!(status(&w.env, "skill:funnel"), ItemStatus::Available);
    assert_eq!(
        install_item(&w.env, "skill:funnel").unwrap(),
        vec!["skill:funnel"]
    );
    assert_eq!(
        fs::read_to_string(w.env.claude_dir.join("skills/funnel/SKILL.md")).unwrap(),
        "# funnel"
    );
    assert_eq!(status(&w.env, "skill:funnel"), ItemStatus::Installed);
    let lock = read_lock(&w.env);
    assert_eq!(lock.items["skill:funnel"].files.len(), 2);
    // No temp files left behind.
    assert!(
        rel_files(&w.env.claude_dir)
            .iter()
            .all(|f| !f.contains("kun-tmp"))
    );
}

#[test]
fn pack_installs_dependencies_first() {
    let w = standard();
    let done = install_item(&w.env, "pack:sales").unwrap();
    assert_eq!(done, vec!["skill:funnel", "agent:lead", "pack:sales"]);
    assert!(w.env.claude_dir.join("agents/lead.md").is_file());
    assert!(
        w.env
            .claude_dir
            .join("departments/sales/pack.json")
            .is_file()
    );
}

#[test]
fn edited_target_is_outdated_and_reinstall_fixes_it() {
    let w = standard();
    install_item(&w.env, "agent:lead").unwrap();
    fs::write(w.env.claude_dir.join("agents/lead.md"), "# edited").unwrap();
    assert_eq!(status(&w.env, "agent:lead"), ItemStatus::Outdated);
    install_item(&w.env, "agent:lead").unwrap();
    assert_eq!(status(&w.env, "agent:lead"), ItemStatus::Installed);
}

#[test]
fn new_registry_version_is_outdated() {
    let w = standard();
    install_item(&w.env, "agent:lead").unwrap();
    // The checkout moves on: new source content, new hash.
    fs::write(w.env.kun_dir.join(".claude/agents/lead.md"), "# lead v2").unwrap();
    let reg = item(
        "agent:lead",
        &[],
        &[(".claude/agents/lead.md", "agents/lead.md", "# lead v2")],
    );
    fs::write(
        w.env.registry_path(),
        serde_json::json!({ "items": [reg] }).to_string(),
    )
    .unwrap();
    assert_eq!(status(&w.env, "agent:lead"), ItemStatus::Outdated);
    install_item(&w.env, "agent:lead").unwrap();
    assert_eq!(
        fs::read_to_string(w.env.claude_dir.join("agents/lead.md")).unwrap(),
        "# lead v2"
    );
}

#[test]
fn uninstall_removes_only_recorded_files() {
    let w = standard();
    install_item(&w.env, "skill:funnel").unwrap();
    let mine = w.env.claude_dir.join("skills/funnel/notes.md");
    fs::write(&mine, "mine").unwrap();
    let other = w.env.claude_dir.join("skills/other/SKILL.md");
    fs::create_dir_all(other.parent().unwrap()).unwrap();
    fs::write(&other, "other").unwrap();

    uninstall_item(&w.env, "skill:funnel").unwrap();
    assert!(!w.env.claude_dir.join("skills/funnel/SKILL.md").exists());
    assert!(
        !w.env.claude_dir.join("skills/funnel/scripts").exists(),
        "empty dir is pruned"
    );
    assert!(mine.is_file(), "a file the user made survives");
    assert!(other.is_file());
    assert!(read_lock(&w.env).items.is_empty());
    assert_eq!(status(&w.env, "skill:funnel"), ItemStatus::Available);
}

#[test]
fn uninstall_refuses_while_a_dependent_is_installed() {
    let w = standard();
    install_item(&w.env, "pack:sales").unwrap();
    let err = uninstall_item(&w.env, "skill:funnel").unwrap_err();
    assert!(matches!(err, CatalogError::InUse(_, ref by) if by == "pack:sales"));
    assert!(w.env.claude_dir.join("skills/funnel/SKILL.md").is_file());
    uninstall_item(&w.env, "pack:sales").unwrap();
    uninstall_item(&w.env, "skill:funnel").unwrap();
}

#[test]
fn target_escaping_claude_dir_is_refused() {
    for bad in ["../evil.md", "/tmp/evil.md", "skills/../../evil.md"] {
        let w = world(
            &[item(
                "skill:evil",
                &[],
                &[(".claude/skills/evil/SKILL.md", bad, "x")],
            )],
            &[(".claude/skills/evil/SKILL.md", "x")],
        );
        let err = install_item(&w.env, "skill:evil").unwrap_err();
        assert!(matches!(err, CatalogError::Unsafe(_)), "{bad}: {err}");
        assert!(!w.env.claude_dir.parent().unwrap().join("evil.md").exists());
    }
}

#[cfg(unix)]
#[test]
fn symlinked_directory_cannot_smuggle_a_write_out() {
    let w = standard();
    let outside = w.env.claude_dir.parent().unwrap().join("outside");
    fs::create_dir_all(&outside).unwrap();
    fs::create_dir_all(&w.env.claude_dir).unwrap();
    std::os::unix::fs::symlink(&outside, w.env.claude_dir.join("agents")).unwrap();
    let err = install_item(&w.env, "agent:lead").unwrap_err();
    assert!(matches!(err, CatalogError::Unsafe(_)));
    assert!(rel_files(&outside).is_empty());
}

#[test]
fn source_that_no_longer_matches_the_registry_is_refused() {
    let w = standard();
    fs::write(w.env.kun_dir.join(".claude/agents/lead.md"), "tampered").unwrap();
    let err = install_item(&w.env, "agent:lead").unwrap_err();
    assert!(matches!(err, CatalogError::Stale(_)));
    assert!(!w.env.claude_dir.join("agents/lead.md").exists());
}

#[test]
fn names_are_validated() {
    let w = standard();
    for bad in [
        "",
        "../etc",
        "Skill:funnel",
        "skill:fun nel",
        "skill/funnel",
        "skill:funnel\n",
    ] {
        assert!(
            matches!(install_item(&w.env, bad), Err(CatalogError::InvalidName)),
            "{bad:?}"
        );
        assert!(
            matches!(uninstall_item(&w.env, bad), Err(CatalogError::InvalidName)),
            "{bad:?}"
        );
    }
    assert!(matches!(
        install_item(&w.env, "skill:nope"),
        Err(CatalogError::UnknownItem(_))
    ));
}

#[test]
fn missing_registry_says_how_to_build_it() {
    let w = world(&[], &[]);
    fs::remove_file(w.env.registry_path()).unwrap();
    let msg = list_items(&w.env).unwrap_err().to_string();
    assert!(msg.contains("pnpm kun:registry"), "{msg}");
}

#[cfg(unix)]
#[test]
fn executable_bit_is_kept() {
    use std::os::unix::fs::PermissionsExt;
    let w = standard();
    let src = w.env.kun_dir.join(".claude/skills/funnel/scripts/run.sh");
    fs::set_permissions(&src, fs::Permissions::from_mode(0o755)).unwrap();
    install_item(&w.env, "skill:funnel").unwrap();
    let mode = fs::metadata(w.env.claude_dir.join("skills/funnel/scripts/run.sh"))
        .unwrap()
        .permissions()
        .mode();
    assert_eq!(mode & 0o111, 0o111);
}

// ---- profile scope ----

fn profile_for(depts: &[&str], catalog: CatalogAccess) -> MachineProfile {
    use crate::{
        driver::DriverKind,
        profile::{Access, Department},
    };
    MachineProfile {
        login: "moed".into(),
        name: String::new(),
        os: "windows".into(),
        driver: DriverKind::Claude,
        departments: depts
            .iter()
            .map(|d| Department {
                name: (*d).into(),
                title: (*d).into(),
                title_ar: None,
                quick_actions: Vec::new(),
                skills: Vec::new(),
            })
            .collect(),
        repos: Vec::new(),
        access: Access {
            catalog,
            ..Access::FULL
        },
        hidden: Vec::new(),
    }
}

/// `standard()` plus a second pack and a skill that only it needs.
fn two_packs() -> World {
    let w = standard();
    let reg = w.env.kun_dir.join("public/r/kun/index.json");
    let mut json: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&reg).unwrap()).unwrap();
    let items = json["items"].as_array_mut().unwrap();
    items.push(item(
        "skill:edit",
        &[],
        &[(
            ".claude/skills/edit/SKILL.md",
            "skills/edit/SKILL.md",
            "# edit",
        )],
    ));
    items.push(item(
        "pack:video",
        &["skill:edit"],
        &[(
            "departments/video/pack.json",
            "departments/video/pack.json",
            "{}",
        )],
    ));
    fs::write(&reg, json.to_string()).unwrap();
    for (p, body) in [
        (".claude/skills/edit/SKILL.md", "# edit"),
        ("departments/video/pack.json", "{}"),
    ] {
        let path = w.env.kun_dir.join(p);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }
    w
}

#[test]
fn a_profile_lists_only_its_packs_and_what_they_need() {
    let w = two_packs();
    let profile = profile_for(&["sales"], CatalogAccess::Profile);
    let allowed = allowed_ids(&w.env, &profile).unwrap();
    let ids: Vec<String> = list_items_scoped(&w.env, allowed.as_ref())
        .unwrap()
        .into_iter()
        .map(|i| i.id)
        .collect();
    assert_eq!(ids, vec!["skill:funnel", "agent:lead", "pack:sales"]);
    assert_eq!(
        list_items(&w.env).unwrap().len(),
        5,
        "unscoped still lists everything"
    );
}

#[test]
fn full_catalog_access_means_no_limit() {
    let w = two_packs();
    assert!(
        allowed_ids(&w.env, &profile_for(&["sales"], CatalogAccess::All))
            .unwrap()
            .is_none()
    );
}

#[test]
fn install_and_uninstall_refuse_outside_the_profile() {
    let w = two_packs();
    let allowed = allowed_ids(&w.env, &profile_for(&["sales"], CatalogAccess::Profile)).unwrap();
    for outside in ["pack:video", "skill:edit"] {
        assert!(
            matches!(
                install_item_scoped(&w.env, outside, allowed.as_ref()),
                Err(CatalogError::OutsideProfile(_))
            ),
            "{outside}"
        );
        assert!(
            matches!(
                uninstall_item_scoped(&w.env, outside, allowed.as_ref()),
                Err(CatalogError::OutsideProfile(_))
            ),
            "{outside}"
        );
    }
    assert!(
        !w.env.claude_dir.join("skills/edit").exists(),
        "nothing was written"
    );

    let done = install_item_scoped(&w.env, "pack:sales", allowed.as_ref()).unwrap();
    assert_eq!(done.last().map(String::as_str), Some("pack:sales"));
    uninstall_item_scoped(&w.env, "pack:sales", allowed.as_ref()).unwrap();
}

#[test]
fn hidden_lanes_never_install_even_through_their_pack() {
    let w = two_packs();
    let mut profile = profile_for(&["video"], CatalogAccess::Profile);
    profile.hidden = vec!["skill:edit".into()];
    let allowed = allowed_ids(&w.env, &profile).unwrap();
    let ids: Vec<String> = list_items_scoped(&w.env, allowed.as_ref())
        .unwrap()
        .into_iter()
        .map(|i| i.id)
        .collect();
    assert_eq!(ids, vec!["pack:video"], "the hidden skill is not listed");
    assert!(matches!(
        install_item_scoped(&w.env, "skill:edit", allowed.as_ref()),
        Err(CatalogError::OutsideProfile(_))
    ));
    let done = install_item_scoped(&w.env, "pack:video", allowed.as_ref()).unwrap();
    assert_eq!(
        done,
        vec!["pack:video"],
        "the pack installs without its hidden lane"
    );
    assert!(!w.env.claude_dir.join("skills/edit").exists());
}
