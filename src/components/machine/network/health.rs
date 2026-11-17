//! The health check: gather facts, decide which fixes are safe, apply them, report.
//!
//! Safe means it cannot lose work: reinstall an outdated catalog item (hash-verified copy),
//! `git pull --ff-only` a clean clone, rebuild the workspace, pull the kun checkout. Everything
//! else (no agent installed, low disk, local changes that block a pull) is reported as a
//! "needs you" item and left alone.

use super::{
    host::Host,
    model::{HealthItem, HealthReport, LocalRepo},
};

/// Free space below which the machine says so.
pub const MIN_FREE_BYTES: u64 = 5 * 1024 * 1024 * 1024;

/// What the machine looked like before any fix.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Facts {
    pub driver_installed: bool,
    pub outdated: Vec<String>,
    pub repos: Vec<LocalRepo>,
    pub workspace_ready: bool,
    pub disk_free_bytes: Option<u64>,
    /// `None` when kun is not a git checkout here.
    pub kun_behind: Option<u32>,
}

/// One safe fix.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Heal {
    Kun,
    Repo(String),
    Workspace,
    Catalog(String),
}

/// Reads the facts from the host.
#[must_use]
pub fn gather(host: &impl Host) -> Facts {
    Facts {
        driver_installed: host.driver_installed(),
        outdated: host.outdated_items(),
        repos: host.repos(),
        workspace_ready: host.workspace_ready(),
        disk_free_bytes: host.disk_free_bytes(),
        kun_behind: host.kun_behind(),
    }
}

/// A clone is safe to fast-forward when it is behind and has no local changes.
fn repo_pullable(r: &LocalRepo) -> bool {
    r.behind > 0 && !r.dirty
}

/// The safe fixes for these facts, in the order they run: kun first (the registry may move),
/// then clones, the workspace, and the catalog last (it reads the pulled registry).
#[must_use]
pub fn plan(facts: &Facts) -> Vec<Heal> {
    let mut heals = Vec::new();
    if facts.kun_behind.is_some_and(|b| b > 0) {
        heals.push(Heal::Kun);
    }
    heals.extend(
        facts
            .repos
            .iter()
            .filter(|r| repo_pullable(r))
            .map(|r| Heal::Repo(r.name.clone())),
    );
    if !facts.workspace_ready {
        heals.push(Heal::Workspace);
    }
    heals.extend(facts.outdated.iter().cloned().map(Heal::Catalog));
    heals
}

/// What happened to each heal: `Ok` or the reason it failed.
pub type Outcomes = Vec<(Heal, Result<(), String>)>;

fn item(key: &str, ok: bool, detail: impl Into<String>, healed: bool) -> HealthItem {
    let mut detail: String = detail.into();
    if detail.chars().count() > 480 {
        detail = detail.chars().take(480).collect();
    }
    HealthItem {
        key: key.to_owned(),
        ok,
        detail,
        healed,
    }
}

fn outcome<'a>(outcomes: &'a Outcomes, heal: &Heal) -> Option<&'a Result<(), String>> {
    outcomes.iter().find(|(h, _)| h == heal).map(|(_, r)| r)
}

/// The report: every fact as an item, marked healed when its fix worked.
#[must_use]
pub fn report_items(facts: &Facts, outcomes: &Outcomes) -> Vec<HealthItem> {
    let mut items = Vec::new();

    items.push(if facts.driver_installed {
        item("driver", true, "an agent is installed", false)
    } else {
        item(
            "driver",
            false,
            "no agent installed: install Claude Code, Codex or opencode",
            false,
        )
    });

    items.push(match facts.disk_free_bytes {
        Some(b) if b >= MIN_FREE_BYTES => item("disk", true, format!("{} GB free", b >> 30), false),
        Some(b) => item(
            "disk",
            false,
            format!("{} GB free, below 5 GB: free some space", b >> 30),
            false,
        ),
        None => item("disk", true, "free space unknown", false),
    });

    match facts.kun_behind {
        None => items.push(item("kun", true, "not a git checkout", false)),
        Some(0) => items.push(item("kun", true, "up to date", false)),
        Some(n) => items.push(match outcome(outcomes, &Heal::Kun) {
            Some(Ok(())) => item("kun", true, format!("pulled {n} commits"), true),
            Some(Err(e)) => item("kun", false, format!("behind by {n}: {e}"), false),
            None => item("kun", false, format!("behind by {n}"), false),
        }),
    }

    items.push(if facts.workspace_ready {
        item("workspace", true, "prepared", false)
    } else {
        match outcome(outcomes, &Heal::Workspace) {
            Some(Ok(())) => item("workspace", true, "prepared again", true),
            Some(Err(e)) => item("workspace", false, e.clone(), false),
            None => item("workspace", false, "not prepared", false),
        }
    });

    if facts.outdated.is_empty() {
        items.push(item("catalog", true, "everything current", false));
    } else {
        let failed: Vec<String> = facts
            .outdated
            .iter()
            .filter_map(|id| match outcome(outcomes, &Heal::Catalog(id.clone())) {
                Some(Ok(())) => None,
                Some(Err(e)) => Some(format!("{id}: {e}")),
                None => Some(id.clone()),
            })
            .collect();
        items.push(if failed.is_empty() {
            item(
                "catalog",
                true,
                format!("reinstalled {}", facts.outdated.join(", ")),
                true,
            )
        } else {
            item(
                "catalog",
                false,
                format!("outdated: {}", failed.join("; ")),
                false,
            )
        });
    }

    for r in &facts.repos {
        let key = format!("repo:{}", r.name);
        items.push(if r.behind == 0 {
            let note = if r.dirty {
                "up to date, local changes"
            } else {
                "up to date"
            };
            item(&key, true, note, false)
        } else if r.dirty {
            item(
                &key,
                false,
                format!(
                    "behind by {} with local changes: pull it yourself",
                    r.behind
                ),
                false,
            )
        } else {
            match outcome(outcomes, &Heal::Repo(r.name.clone())) {
                Some(Ok(())) => item(&key, true, format!("pulled {} commits", r.behind), true),
                Some(Err(e)) => item(&key, false, format!("behind by {}: {e}", r.behind), false),
                None => item(&key, false, format!("behind by {}", r.behind), false),
            }
        });
    }
    items
}

fn apply_one(host: &impl Host, heal: &Heal) -> Result<(), String> {
    match heal {
        Heal::Kun => host.pull_kun(),
        Heal::Repo(name) => host.pull_repo(name),
        Heal::Workspace => host.prepare_workspace(),
        Heal::Catalog(id) => host.reinstall(id),
    }
}

/// One full check-and-heal pass.
#[must_use]
pub fn run_cycle(host: &impl Host, now: &str) -> HealthReport {
    let mut facts = gather(host);
    let mut outcomes: Outcomes = Vec::new();
    if facts.kun_behind.is_some_and(|b| b > 0) {
        let result = host.pull_kun();
        if result.is_ok() {
            // The pull may have moved the registry: judge the catalog against the new one.
            facts.outdated = host.outdated_items();
        }
        outcomes.push((Heal::Kun, result));
    }
    for heal in plan(&facts).into_iter().filter(|h| *h != Heal::Kun) {
        let result = apply_one(host, &heal);
        outcomes.push((heal, result));
    }
    let mut items = report_items(&facts, &outcomes);
    let swept = host.sweep();
    if !swept.is_empty() {
        items.push(item("sprint", true, swept.join("; "), true));
    }
    items.truncate(100);
    HealthReport {
        checked_at: now.to_owned(),
        items,
    }
}
