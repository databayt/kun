//! git, the only way repos touches a clone. Reads are blocking (`std::process`, short, run from
//! `spawn_blocking`); clone and pull are async and stream git's progress. Never pushes, never
//! commits, never stores a credential.

use std::{
    path::Path,
    process::{Command as StdCommand, Stdio},
};

use tokio::{io::AsyncReadExt, process::Command};

use super::model::{Loss, LossKind, RepoError};

fn std_git(dir: &Path, args: &[&str]) -> Option<String> {
    let out = StdCommand::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim_end().to_owned())
}

/// Whether `dir` is a git work tree of its own.
pub(super) fn is_repo(dir: &Path) -> bool {
    dir.join(".git").exists()
}

/// The branch HEAD is on; the short commit when detached; empty on a repo with no commit.
pub(super) fn branch(dir: &Path) -> String {
    match std_git(dir, &["branch", "--show-current"]) {
        Some(b) if !b.is_empty() => b,
        _ => std_git(dir, &["rev-parse", "--short", "HEAD"]).unwrap_or_default(),
    }
}

/// `(ahead, behind)` against the upstream; `(0, 0)` without one.
pub(super) fn ahead_behind(dir: &Path) -> (u32, u32) {
    let Some(text) = std_git(dir, &["rev-list", "--left-right", "--count", "HEAD...@{u}"]) else {
        return (0, 0);
    };
    let mut it = text
        .split_whitespace()
        .map(|n| n.parse::<u32>().unwrap_or(0));
    (it.next().unwrap_or(0), it.next().unwrap_or(0))
}

/// `(tracked changes, untracked files)` from `git status --porcelain`.
pub(super) fn porcelain(dir: &Path) -> Result<(u32, u32), RepoError> {
    let text = std_git(dir, &["status", "--porcelain"])
        .ok_or_else(|| RepoError::Git(format!("status failed in {}", dir.display())))?;
    let (mut tracked, mut untracked) = (0, 0);
    for line in text.lines().filter(|l| !l.is_empty()) {
        if line.starts_with("??") {
            untracked += 1;
        } else {
            tracked += 1;
        }
    }
    Ok((tracked, untracked))
}

/// Everything removing this clone would throw away. Empty means it is safe to delete.
pub(super) fn losses(dir: &Path) -> Result<Vec<Loss>, RepoError> {
    let (tracked, untracked) = porcelain(dir)?;
    // Commits reachable from a local branch but from no remote-tracking ref: covers branches with no upstream too.
    let unpushed = std_git(
        dir,
        &["rev-list", "--count", "--branches", "--not", "--remotes"],
    )
    .and_then(|n| n.parse::<u32>().ok())
    .unwrap_or(0);
    let stashes = std_git(dir, &["stash", "list"]).map_or(0, |s| {
        u32::try_from(s.lines().filter(|l| !l.is_empty()).count()).unwrap_or(u32::MAX)
    });
    Ok([
        (LossKind::Dirty, tracked),
        (LossKind::Untracked, untracked),
        (LossKind::Unpushed, unpushed),
        (LossKind::Stash, stashes),
    ]
    .into_iter()
    .filter(|(_, count)| *count > 0)
    .map(|(kind, count)| Loss { kind, count })
    .collect())
}

/// Refreshes the remote-tracking refs so ahead/behind are current. Failure (offline) is ignored.
pub(super) fn fetch(dir: &Path) {
    let _ = std_git(dir, &["fetch", "--quiet"]);
}

/// `git remote get-url origin`.
pub(super) fn origin(dir: &Path) -> Option<String> {
    std_git(dir, &["remote", "get-url", "origin"]).filter(|u| !u.is_empty())
}

/// `git remote set-url origin <url>`.
pub(super) fn set_origin(dir: &Path, url: &str) -> Result<(), RepoError> {
    std_git(dir, &["remote", "set-url", "origin", url])
        .map(|_| ())
        .ok_or_else(|| RepoError::Git("could not set the origin".into()))
}

/// Runs git, handing every progress line git prints (split on `\r` and `\n`) to `on_line`.
/// Returns the last stderr text when git fails.
pub(super) async fn run(
    args: &[String],
    cwd: Option<&Path>,
    on_line: &mut impl FnMut(&str),
) -> Result<(), String> {
    let mut git = Command::new("git");
    git.args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(dir) = cwd {
        git.current_dir(dir);
    }
    let mut child = git.spawn().map_err(|e| format!("git: {e}"))?;
    let mut stderr = child.stderr.take().ok_or("git: no stderr")?;
    let (mut buf, mut pending, mut last) = ([0u8; 4096], String::new(), String::new());
    loop {
        let n = stderr
            .read(&mut buf)
            .await
            .map_err(|e| format!("git: {e}"))?;
        if n == 0 {
            break;
        }
        pending.push_str(&String::from_utf8_lossy(&buf[..n]));
        while let Some(i) = pending.find(['\r', '\n']) {
            let line = pending[..i].trim().to_owned();
            pending.drain(..=i);
            if !line.is_empty() {
                on_line(&line);
                last = line;
            }
        }
    }
    let tail = pending.trim();
    if !tail.is_empty() {
        on_line(tail);
        tail.clone_into(&mut last);
    }
    let status = child.wait().await.map_err(|e| format!("git: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(last.chars().take(300).collect())
    }
}
