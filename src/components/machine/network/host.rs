//! What a check or a heal touches on this computer, behind one trait so the decisions in
//! `health.rs` and the gate in `tasks` are tested with a fake. `RealHost` is the only
//! implementation that reads disks, runs git, or calls catalog/pack/driver.

use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use super::model::{LocalRepo, RepoMode};
use crate::{catalog, driver, pack, profile, repos};

pub trait Host: Send + Sync {
    fn driver_installed(&self) -> bool;
    /// Ids of catalog items installed but out of date.
    fn outdated_items(&self) -> Vec<String>;
    /// Catalog item ids with their status, for the task gate; `None` when the registry is missing.
    fn item_states(&self) -> Option<Vec<(String, catalog::ItemStatus)>>;
    /// Catalog ids this profile may use; `None` means all.
    fn allowed_items(&self) -> Option<Vec<String>>;
    /// Repos the profile may use; empty means any.
    fn allowed_repos(&self) -> Vec<String>;
    fn repos(&self) -> Vec<LocalRepo>;
    fn repo_paths(&self) -> Vec<PathBuf>;
    fn workspace_ready(&self) -> bool;
    fn disk_free_bytes(&self) -> Option<u64>;
    /// Commits the kun checkout is behind its upstream; `None` when it is not a git checkout.
    fn kun_behind(&self) -> Option<u32>;
    fn login(&self) -> String;
    fn current_task(&self) -> Option<String>;
    /// # Errors
    /// When the action fails; the reason is shown to the person.
    fn reinstall(&self, id: &str) -> Result<(), String>;
    /// # Errors
    /// When the action fails; the reason is shown to the person.
    fn pull_repo(&self, name: &str) -> Result<(), String>;
    /// # Errors
    /// When the action fails; the reason is shown to the person.
    fn prepare_workspace(&self) -> Result<(), String>;
    /// # Errors
    /// When the action fails; the reason is shown to the person.
    fn pull_kun(&self) -> Result<(), String>;
    /// Removes clones whose sprint ended (only when nothing would be lost); returns what it did.
    fn sweep(&self) -> Vec<String>;
}

fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim().to_owned())
}

/// `(behind, ahead)` against the upstream, as of the last fetch; `None` without an upstream.
fn behind_ahead(dir: &Path) -> Option<(u32, u32)> {
    let text = git(dir, &["rev-list", "--left-right", "--count", "@{u}...HEAD"])?;
    let (b, a) = text.split_once(char::is_whitespace)?;
    Some((b.trim().parse().ok()?, a.trim().parse().ok()?))
}

fn pull_ff(dir: &Path) -> Result<(), String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["pull", "--ff-only", "--quiet"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr)
            .trim()
            .chars()
            .take(200)
            .collect())
    }
}

/// The clones under the workspace's `repos/` folder, read by the repos feature after a fetch.
fn scan_repos(root: &Path) -> Vec<LocalRepo> {
    for dir in repos::local_paths(root) {
        let _ = git(&dir, &["fetch", "--quiet"]);
    }
    repos::local_repos(root)
        .into_iter()
        .map(|r| LocalRepo {
            name: r.name,
            mode: match r.mode {
                repos::RepoMode::Keep => RepoMode::Keep,
                repos::RepoMode::Sprint => RepoMode::Sprint,
            },
            branch: r.branch,
            behind: r.behind,
            ahead: r.ahead,
            dirty: r.dirty,
        })
        .collect()
}

/// Where this machine's clones are (the repos feature owns the location).
fn repos_root() -> Option<PathBuf> {
    repos::repos_root().ok()
}

/// The task this machine started and has not released or finished, kept in `task.json`.
fn task_file() -> Option<PathBuf> {
    pack::machine_dir().ok().map(|d| d.join("task.json"))
}

/// The id of the task this machine holds, if any.
#[must_use]
pub fn held_task() -> Option<String> {
    let text = std::fs::read_to_string(task_file()?).ok()?;
    serde_json::from_str::<serde_json::Value>(&text)
        .ok()?
        .get("id")?
        .as_str()
        .map(str::to_owned)
}

/// Remembers (`Some`) or forgets (`None`) the held task.
///
/// # Errors
/// When the file cannot be written.
pub fn set_held_task(id: Option<&str>) -> Result<(), String> {
    let path = task_file().ok_or("no home folder")?;
    match id {
        Some(id) => {
            if let Some(dir) = path.parent() {
                std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
            }
            std::fs::write(&path, serde_json::json!({ "id": id }).to_string())
                .map_err(|e| e.to_string())
        }
        None => match std::fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        },
    }
}

pub struct RealHost;

impl RealHost {
    fn env() -> catalog::Env {
        catalog::Env::from_process()
    }

    fn scope(env: &catalog::Env) -> Option<std::collections::BTreeSet<String>> {
        let resolved = profile::current().ok()?;
        catalog::allowed_ids(env, &resolved.profile).ok().flatten()
    }
}

impl Host for RealHost {
    fn driver_installed(&self) -> bool {
        driver::detect().iter().any(|d| d.installed)
    }

    fn outdated_items(&self) -> Vec<String> {
        let env = Self::env();
        catalog::list_items_scoped(&env, Self::scope(&env).as_ref())
            .map(|items| {
                items
                    .into_iter()
                    .filter(|i| i.status == catalog::ItemStatus::Outdated)
                    .map(|i| i.id)
                    .collect()
            })
            .unwrap_or_default()
    }

    fn item_states(&self) -> Option<Vec<(String, catalog::ItemStatus)>> {
        let env = Self::env();
        catalog::list_items(&env)
            .ok()
            .map(|items| items.into_iter().map(|i| (i.id, i.status)).collect())
    }

    fn allowed_items(&self) -> Option<Vec<String>> {
        Self::scope(&Self::env()).map(|s| s.into_iter().collect())
    }

    fn allowed_repos(&self) -> Vec<String> {
        profile::current()
            .map(|r| {
                if r.explicit {
                    r.profile.repos
                } else {
                    Vec::new()
                }
            })
            .unwrap_or_default()
    }

    fn repos(&self) -> Vec<LocalRepo> {
        repos_root().map(|r| scan_repos(&r)).unwrap_or_default()
    }

    fn repo_paths(&self) -> Vec<PathBuf> {
        repos_root()
            .map(|root| repos::local_paths(&root))
            .unwrap_or_default()
    }

    fn workspace_ready(&self) -> bool {
        match profile::current() {
            Ok(r) if r.explicit => pack::workspace_root()
                .is_ok_and(|root| root.join(&r.profile.login).join("CLAUDE.md").is_file()),
            _ => true,
        }
    }

    fn disk_free_bytes(&self) -> Option<u64> {
        let dir = pack::workspace_root().ok().or_else(dirs::home_dir)?;
        // The workspace may not exist yet; ask about the nearest folder that does.
        let probe = dir.ancestors().find(|p| p.exists())?;
        fs4::available_space(probe).ok()
    }

    fn kun_behind(&self) -> Option<u32> {
        let dir = pack::kun_dir().ok()?;
        if !dir.join(".git").exists() {
            return None;
        }
        let _ = git(&dir, &["fetch", "--quiet"]);
        behind_ahead(&dir).map(|(b, _)| b)
    }

    fn login(&self) -> String {
        profile::current()
            .map(|r| r.profile.login)
            .unwrap_or_default()
    }

    fn current_task(&self) -> Option<String> {
        held_task()
    }

    fn reinstall(&self, id: &str) -> Result<(), String> {
        let env = Self::env();
        catalog::install_item_scoped(&env, id, Self::scope(&env).as_ref())
            .map(drop)
            .map_err(|e| e.to_string())
    }

    fn pull_repo(&self, name: &str) -> Result<(), String> {
        let root = repos_root().ok_or("no workspace")?;
        pull_ff(&root.join(name))
    }

    fn prepare_workspace(&self) -> Result<(), String> {
        let resolved = profile::current().map_err(|e| e.to_string())?;
        if resolved.explicit {
            pack::workspace(&resolved.profile)
                .map(drop)
                .map_err(|e| e.to_string())
        } else {
            Ok(())
        }
    }

    fn pull_kun(&self) -> Result<(), String> {
        pull_ff(&pack::kun_dir().map_err(|e| e.to_string())?)
    }

    fn sweep(&self) -> Vec<String> {
        Vec::new()
    }
}

/// A scripted machine for the tests of `health`, `tasks` and `chat`.
#[cfg(test)]
pub mod fake {
    use std::sync::Mutex;

    use super::{Host, LocalRepo, PathBuf, catalog};

    #[derive(Default)]
    pub struct FakeHost {
        pub driver: bool,
        pub outdated: Vec<String>,
        pub items: Vec<(String, catalog::ItemStatus)>,
        pub allowed_items: Option<Vec<String>>,
        pub allowed_repos: Vec<String>,
        pub repos: Vec<LocalRepo>,
        pub paths: Vec<PathBuf>,
        pub workspace: bool,
        pub disk: Option<u64>,
        pub kun_behind: Option<u32>,
        pub login: String,
        pub task: Option<String>,
        pub fail: Vec<String>,
        pub swept: Vec<String>,
        /// Every heal the host was asked to do, in order.
        pub calls: Mutex<Vec<String>>,
    }

    impl FakeHost {
        fn act(&self, what: &str) -> Result<(), String> {
            self.calls.lock().unwrap().push(what.to_owned());
            if self.fail.iter().any(|f| f == what) {
                Err("boom".to_owned())
            } else {
                Ok(())
            }
        }

        /// # Panics
        /// When the call log is poisoned.
        pub fn calls(&self) -> Vec<String> {
            self.calls.lock().unwrap().clone()
        }
    }

    impl Host for FakeHost {
        fn driver_installed(&self) -> bool {
            self.driver
        }
        fn outdated_items(&self) -> Vec<String> {
            self.outdated.clone()
        }
        fn item_states(&self) -> Option<Vec<(String, catalog::ItemStatus)>> {
            Some(self.items.clone())
        }
        fn allowed_items(&self) -> Option<Vec<String>> {
            self.allowed_items.clone()
        }
        fn allowed_repos(&self) -> Vec<String> {
            self.allowed_repos.clone()
        }
        fn repos(&self) -> Vec<LocalRepo> {
            self.repos.clone()
        }
        fn repo_paths(&self) -> Vec<PathBuf> {
            self.paths.clone()
        }
        fn workspace_ready(&self) -> bool {
            self.workspace
        }
        fn disk_free_bytes(&self) -> Option<u64> {
            self.disk
        }
        fn kun_behind(&self) -> Option<u32> {
            self.kun_behind
        }
        fn login(&self) -> String {
            self.login.clone()
        }
        fn current_task(&self) -> Option<String> {
            self.task.clone()
        }
        fn reinstall(&self, id: &str) -> Result<(), String> {
            self.act(&format!("catalog:{id}"))
        }
        fn pull_repo(&self, name: &str) -> Result<(), String> {
            self.act(&format!("repo:{name}"))
        }
        fn prepare_workspace(&self) -> Result<(), String> {
            self.act("workspace")
        }
        fn pull_kun(&self) -> Result<(), String> {
            self.act("kun")
        }
        fn sweep(&self) -> Vec<String> {
            self.swept.clone()
        }
    }
}
