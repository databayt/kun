//! repos — the logic, with the root folder and the clone base injected so tests run on temp dirs.

use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;
use ts_rs::TS;

use super::{
    git,
    model::{LocalRepo, OrgRepoArg, RepoEntry, RepoError, RepoMode, RepoRow, SweepReport, io_err},
    state,
};

/// Where the repos come from. Tests point it at a `file://` folder of bare repos.
pub const GITHUB_BASE: &str = "https://github.com/databayt";

/// The default shallow depth of a clone; `0` asks for the full history.
pub(super) const DEFAULT_DEPTH: u32 = 50;

/// What happened to one repo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "repos/types.ts")]
pub enum SyncState {
    Cloning,
    Pulling,
    Done,
    Failed,
}

/// One progress step of a clone, a pull or `sync_all`; `message` carries git's progress or failure text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "repos/types.ts")]
pub struct SyncEvent {
    pub repo: String,
    pub state: SyncState,
    pub message: Option<String>,
}

fn event(repo: &str, state: SyncState, message: Option<String>) -> SyncEvent {
    SyncEvent {
        repo: repo.to_owned(),
        state,
        message,
    }
}

/// The root folder of every clone: `<workspace root>/repos`.
///
/// # Errors
/// When there is no home folder and no `KUN_HOME`.
pub fn repos_root() -> Result<PathBuf, RepoError> {
    crate::pack::workspace_root()
        .map(|p| p.join("repos"))
        .map_err(|_| RepoError::NoHome)
}

fn valid(name: &str) -> Result<(), RepoError> {
    if crate::pack::valid_name(name) {
        Ok(())
    } else {
        Err(RepoError::BadName(name.to_owned()))
    }
}

/// `https://github.com/databayt/<name>` or the same with `.git`: nothing else may be an origin.
fn remote_name(url: &str) -> Option<&str> {
    let rest = url.strip_prefix("https://github.com/databayt/")?;
    let name = rest.strip_suffix(".git").unwrap_or(rest);
    crate::pack::valid_name(name).then_some(name)
}

/// The folders under `root` that are git clones, sorted by name. Agent chat adds these with `--add-dir`.
#[must_use]
pub fn local_paths(root: &Path) -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = fs::read_dir(root)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter(|e| crate::pack::valid_name(&e.file_name().to_string_lossy()))
        .map(|e| e.path())
        .filter(|p| git::is_repo(p))
        .collect();
    paths.sort();
    paths
}

/// The clones under `root` with their branch, ahead/behind and dirty state. `fetch` first refreshes
/// each one from its remote (slow, needs the network).
#[must_use]
pub(super) fn local_repos_with(root: &Path, fetch: bool) -> Vec<LocalRepo> {
    let state = state::load(root);
    local_paths(root)
        .into_iter()
        .map(|dir| {
            if fetch {
                git::fetch(&dir);
            }
            let name = dir
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            let entry = state.get(&name);
            let (ahead, behind) = git::ahead_behind(&dir);
            LocalRepo {
                mode: entry.map_or(RepoMode::Keep, |e| e.mode),
                sprint: entry.and_then(|e| e.sprint.clone()),
                branch: git::branch(&dir),
                behind,
                ahead,
                dirty: git::porcelain(&dir).is_ok_and(|(t, u)| t + u > 0),
                name,
            }
        })
        .collect()
}

/// [`local_repos_with`] without a fetch.
#[must_use]
pub fn local_repos(root: &Path) -> Vec<LocalRepo> {
    local_repos_with(root, false)
}

/// The page's rows: every org repo (or, with no org list, every profile repo) merged with what is on disk,
/// plus clones that belong to neither. Sorted by name.
#[must_use]
pub(super) fn rows(
    root: &Path,
    org: &[OrgRepoArg],
    profile_repos: &[String],
    fetch: bool,
) -> Vec<RepoRow> {
    let mut local: BTreeMap<String, LocalRepo> = local_repos_with(root, fetch)
        .into_iter()
        .map(|r| (r.name.clone(), r))
        .collect();
    let listed: Vec<OrgRepoArg> = if org.is_empty() {
        profile_repos
            .iter()
            .map(|name| OrgRepoArg {
                name: name.clone(),
                ..OrgRepoArg::default()
            })
            .collect()
    } else {
        org.to_vec()
    };
    let mut out: Vec<RepoRow> = listed
        .into_iter()
        .map(|o| {
            let l = local.remove(&o.name);
            row(&o.name, o.description, o.private, l.as_ref())
        })
        .collect();
    out.extend(
        local
            .into_values()
            .map(|l| row(&l.name, None, false, Some(&l))),
    );
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn row(
    name: &str,
    description: Option<String>,
    private: bool,
    local: Option<&LocalRepo>,
) -> RepoRow {
    RepoRow {
        name: name.to_owned(),
        description,
        private,
        local: local.is_some(),
        mode: local.as_ref().map(|l| l.mode),
        sprint: local.as_ref().and_then(|l| l.sprint.clone()),
        branch: local.as_ref().map(|l| l.branch.clone()).unwrap_or_default(),
        behind: local.as_ref().map_or(0, |l| l.behind),
        ahead: local.as_ref().map_or(0, |l| l.ahead),
        dirty: local.as_ref().is_some_and(|l| l.dirty),
    }
}

fn depth_args(depth: Option<u32>) -> Vec<String> {
    match depth.unwrap_or(DEFAULT_DEPTH) {
        0 => Vec::new(),
        n => vec!["--depth".into(), n.to_string()],
    }
}

/// Clones `<base>/<name>.git` into `<root>/<name>`: shallow (50) unless `depth` says otherwise, `0` for full.
/// Progress lines stream through `emit` when `progress` is set.
///
/// # Errors
/// On a bad name, an existing clone, or a git failure (also emitted as a `Failed` event).
pub(super) async fn clone_in(
    base: &str,
    root: &Path,
    name: &str,
    depth: Option<u32>,
    progress: bool,
    emit: &mut impl FnMut(SyncEvent),
) -> Result<(), RepoError> {
    valid(name)?;
    let dest = root.join(name);
    if dest.exists() {
        return Err(RepoError::AlreadyCloned(name.to_owned()));
    }
    fs::create_dir_all(root).map_err(io_err(root))?;
    emit(event(name, SyncState::Cloning, None));
    let mut args: Vec<String> = vec!["clone".into()];
    if progress {
        args.push("--progress".into());
    }
    args.extend(depth_args(depth));
    args.extend([
        "--".into(),
        format!("{base}/{name}.git"),
        dest.display().to_string(),
    ]);
    let result = git::run(&args, None, &mut |line| {
        if progress {
            emit(event(name, SyncState::Cloning, Some(line.to_owned())));
        }
    })
    .await;
    finish(root, name, result, emit)
}

/// `git pull --ff-only` in an existing clone; nothing else ever moves a branch.
///
/// # Errors
/// When the repo is not cloned, or git refuses (diverged, offline).
pub(super) async fn pull_in(
    root: &Path,
    name: &str,
    progress: bool,
    emit: &mut impl FnMut(SyncEvent),
) -> Result<(), RepoError> {
    valid(name)?;
    let dir = root.join(name);
    if !git::is_repo(&dir) {
        return Err(RepoError::NotCloned(name.to_owned()));
    }
    emit(event(name, SyncState::Pulling, None));
    let args: Vec<String> = ["pull", "--ff-only"].map(String::from).to_vec();
    let result = git::run(&args, Some(&dir), &mut |line| {
        if progress {
            emit(event(name, SyncState::Pulling, Some(line.to_owned())));
        }
    })
    .await;
    finish(root, name, result, emit)
}

fn finish(
    root: &Path,
    name: &str,
    result: Result<(), String>,
    emit: &mut impl FnMut(SyncEvent),
) -> Result<(), RepoError> {
    match result {
        Ok(()) => {
            state::ensure(root, name)?;
            emit(event(name, SyncState::Done, None));
            Ok(())
        }
        Err(message) => {
            emit(event(name, SyncState::Failed, Some(message.clone())));
            Err(RepoError::Git(message))
        }
    }
}

/// Clones what is missing and fast-forwards what is there, one repo at a time. A failing repo is
/// reported and the rest still run. This is the profile sync `pack` calls.
///
/// # Errors
/// On a repo name that is not a plain name, or when `root` cannot be created.
pub async fn sync_all(
    root: &Path,
    names: &[String],
    base: &str,
    mut emit: impl FnMut(SyncEvent) + Send,
) -> Result<(), RepoError> {
    if let Some(bad) = names.iter().find(|n| !crate::pack::valid_name(n)) {
        return Err(RepoError::BadName(bad.clone()));
    }
    fs::create_dir_all(root).map_err(io_err(root))?;
    for name in names {
        // The failure is already an event; the loop goes on.
        let _ = if git::is_repo(&root.join(name)) {
            pull_in(root, name, false, &mut emit).await
        } else {
            clone_in(base, root, name, None, false, &mut emit).await
        };
    }
    Ok(())
}

/// Switches a clone between `keep` and `sprint`. A sprint clone carries its sprint's name.
///
/// # Errors
/// When the repo is not cloned.
pub(super) fn set_mode_in(
    root: &Path,
    name: &str,
    mode: RepoMode,
    sprint: Option<String>,
) -> Result<(), RepoError> {
    valid(name)?;
    if !git::is_repo(&root.join(name)) {
        return Err(RepoError::NotCloned(name.to_owned()));
    }
    let mut st = state::load(root);
    let added_at = st.get(name).map_or_else(state::now, |e| e.added_at);
    let sprint = if mode == RepoMode::Sprint {
        sprint.filter(|s| !s.trim().is_empty())
    } else {
        None
    };
    st.insert(
        name.to_owned(),
        RepoEntry {
            mode,
            sprint,
            added_at,
        },
    );
    state::save(root, &st)
}

/// Deletes a clone, but only when nothing would be lost.
///
/// # Errors
/// [`RepoError::Refused`] listing the losses when there are any; `NotCloned` when it is not there.
pub(super) fn remove_in(root: &Path, name: &str) -> Result<(), RepoError> {
    valid(name)?;
    let dir = root.join(name);
    let meta = fs::symlink_metadata(&dir).map_err(|_| RepoError::NotCloned(name.to_owned()))?;
    if !meta.is_dir() {
        // A symlink or a file is not a clone this app made; it is never followed or deleted.
        return Err(RepoError::BadName(name.to_owned()));
    }
    if git::is_repo(&dir) {
        let losses = git::losses(&dir)?;
        if !losses.is_empty() {
            return Err(RepoError::Refused {
                name: name.to_owned(),
                losses,
            });
        }
    }
    fs::remove_dir_all(&dir).map_err(io_err(&dir))?;
    let mut st = state::load(root);
    if st.remove(name).is_some() {
        state::save(root, &st)?;
    }
    Ok(())
}

/// Points `origin` at another databayt URL. Only `https://github.com/databayt/<name>[.git]` is allowed:
/// no credentials in the URL, no other host. A read-only profile therefore stays https read-only.
///
/// # Errors
/// On any other URL, or when the repo is not cloned.
pub(super) fn set_remote_in(root: &Path, name: &str, url: &str) -> Result<(), RepoError> {
    valid(name)?;
    if remote_name(url).is_none() {
        return Err(RepoError::BadRemote(url.to_owned()));
    }
    let dir = root.join(name);
    if !git::is_repo(&dir) {
        return Err(RepoError::NotCloned(name.to_owned()));
    }
    git::set_origin(&dir, url)
}

/// The GitHub page of a repo: its origin when that is a databayt URL, else `https://github.com/databayt/<name>`.
///
/// # Errors
/// On a bad name.
pub(super) fn remote_url_in(root: &Path, name: &str) -> Result<String, RepoError> {
    valid(name)?;
    let page = |n: &str| format!("{GITHUB_BASE}/{n}");
    Ok(git::origin(&root.join(name))
        .as_deref()
        .and_then(remote_name)
        .map_or_else(|| page(name), page))
}

/// Removes sprint-mode clones whose sprint is not `current_sprint` any more, when they are clean and
/// fully pushed. The rest stay and are reported. A sprint clone with no sprint name is never swept.
///
/// # Errors
/// When the state file cannot be written.
pub(super) fn sweep_in(root: &Path, current_sprint: &str) -> Result<SweepReport, RepoError> {
    let mut report = SweepReport::default();
    for (name, entry) in state::load(root) {
        let ended = entry.mode == RepoMode::Sprint
            && entry.sprint.as_deref().is_some_and(|s| s != current_sprint);
        if !ended {
            continue;
        }
        match remove_in(root, &name) {
            Ok(()) => report.removed.push(name),
            Err(RepoError::NotCloned(_)) => {
                let mut st = state::load(root);
                st.remove(&name);
                state::save(root, &st)?;
            }
            Err(_) => report.kept.push(name),
        }
    }
    Ok(report)
}
