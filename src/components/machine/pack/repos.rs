//! Repos: the public databayt repos a profile reads, cloned into `~/Kun/repos/<name>`.
//!
//! Clone with `git clone --depth 50`, refresh with `git pull --ff-only`, nothing else. machine
//! never pushes, never commits and never stores a git credential: these repos are public.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tokio::process::Command;
use ts_rs::TS;

use super::{PackError, valid_name};

/// Where the repos come from. Tests point it at a local folder of bare repos.
pub(super) const GITHUB_BASE: &str = "https://github.com/databayt";

/// What happened to one repo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "pack/types.ts")]
pub enum SyncState {
    Cloning,
    Pulling,
    Done,
    Failed,
}

/// One progress step of `sync_repos`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "pack/types.ts")]
pub struct SyncEvent {
    pub repo: String,
    pub state: SyncState,
    pub message: Option<String>,
}

/// The exact git argv for one repo: a shallow clone when it is missing, else a fast-forward pull.
/// The second element is the working directory (`None` for a clone).
pub(super) fn git_args(base: &str, root: &Path, name: &str) -> (Vec<String>, Option<PathBuf>) {
    let dest = root.join(name);
    if dest.join(".git").exists() {
        (vec!["pull".into(), "--ff-only".into()], Some(dest))
    } else {
        (
            vec!["clone".into(), "--depth".into(), "50".into(), "--".into(), format!("{base}/{name}.git"), dest.display().to_string()],
            None,
        )
    }
}

async fn sync_one(base: &str, root: &Path, name: &str, emit: &mut impl FnMut(SyncEvent)) {
    let (args, cwd) = git_args(base, root, name);
    let pulling = cwd.is_some();
    emit(SyncEvent {
        repo: name.to_owned(),
        state: if pulling { SyncState::Pulling } else { SyncState::Cloning },
        message: None,
    });
    let mut git = Command::new("git");
    git.args(&args).env("GIT_TERMINAL_PROMPT", "0").kill_on_drop(true);
    if let Some(dir) = cwd {
        git.current_dir(dir);
    }
    let event = match git.output().await {
        Ok(out) if out.status.success() => SyncEvent { repo: name.to_owned(), state: SyncState::Done, message: None },
        Ok(out) => SyncEvent {
            repo: name.to_owned(),
            state: SyncState::Failed,
            message: Some(String::from_utf8_lossy(&out.stderr).trim().chars().take(300).collect()),
        },
        Err(e) => SyncEvent { repo: name.to_owned(), state: SyncState::Failed, message: Some(format!("git: {e}")) },
    };
    emit(event);
}

/// Syncs every repo in turn. A failing repo is reported and the rest still run.
///
/// # Errors
/// On a repo name that is not a plain name, or when `root` cannot be created.
pub(super) async fn sync_all(
    root: &Path,
    repos: &[String],
    base: &str,
    mut emit: impl FnMut(SyncEvent) + Send,
) -> Result<(), PackError> {
    if let Some(bad) = repos.iter().find(|r| !valid_name(r)) {
        return Err(PackError::BadRepo(bad.clone()));
    }
    std::fs::create_dir_all(root).map_err(super::io_err(root))?;
    for name in repos {
        sync_one(base, root, name, &mut emit).await;
    }
    Ok(())
}
