//! engine — keeps the teammate's `~/kun` checkout current and shows how healthy it is.
//!
//! Everything runs as a subprocess of the real `git` / `bash`: machine never reimplements
//! the engine. Updates are fast-forward only (never reset, never force). The parsing is
//! pure (`strip_ansi`, `parse_behind`, `summarize_pull`) so it is unit-tested.

use std::{
    path::{Path, PathBuf},
    process::Stdio,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use tokio::process::Command;
use ts_rs::TS;

const GIT_TIMEOUT: Duration = Duration::from_secs(30);
const PULL_TIMEOUT: Duration = Duration::from_secs(120);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_OUTPUT: usize = 64 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("no kun checkout at {0}")]
    NoCheckout(String),
    #[error("{0} is not installed or not on a known path")]
    NotInstalled(&'static str),
    #[error("{0}")]
    Unsupported(&'static str),
    #[error("could not run {0}: {1}")]
    Spawn(&'static str, std::io::Error),
    #[error("{0} timed out after {1}s")]
    Timeout(&'static str, u64),
    #[error("cannot read {0}: {1}")]
    Read(String, std::io::Error),
}

impl Serialize for EngineError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Result of the last `health` run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "engine/types.ts")]
pub struct HealthReport {
    pub ok: bool,
    /// Unix seconds when it finished.
    pub at: u32,
    /// ANSI-stripped output, capped.
    pub output: String,
}

/// The kun checkout: where it is, which commit, how far behind its upstream.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "engine/types.ts")]
pub struct EngineStatus {
    pub dir: String,
    pub exists: bool,
    pub branch: Option<String>,
    pub sha: Option<String>,
    pub subject: Option<String>,
    /// Commits upstream has that this checkout lacks. `None` when it could not be checked.
    pub behind: Option<u32>,
    /// Uncommitted changes in the checkout (an update may refuse).
    pub dirty: bool,
    pub health: Option<HealthReport>,
    /// Why part of the status is missing (offline, no git, ...).
    pub note: Option<String>,
}

/// What `update` did.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "engine/types.ts")]
pub struct UpdateReport {
    pub ok: bool,
    pub up_to_date: bool,
    pub before: Option<String>,
    pub after: Option<String>,
    pub output: String,
}

/// The live state file (`~/.claude/state/aware.md`).
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "engine/types.ts")]
pub struct LiveState {
    pub path: String,
    pub exists: bool,
    pub text: String,
}

static LAST_HEALTH: Mutex<Option<HealthReport>> = Mutex::new(None);

/// `KUN_DIR` or `~/kun`.
#[must_use]
pub fn kun_dir() -> PathBuf {
    env_or("KUN_DIR", || {
        dirs::home_dir().unwrap_or_default().join("kun")
    })
}

/// `CLAUDE_DIR` or `~/.claude`.
#[must_use]
pub fn claude_dir() -> PathBuf {
    env_or("CLAUDE_DIR", || {
        dirs::home_dir().unwrap_or_default().join(".claude")
    })
}

fn env_or(key: &str, fallback: impl FnOnce() -> PathBuf) -> PathBuf {
    match std::env::var_os(key) {
        Some(v) if !v.is_empty() => PathBuf::from(v),
        _ => fallback(),
    }
}

/// Removes ANSI escape sequences (colors, cursor moves, OSC titles) and bare carriage
/// returns, so captured terminal output reads as plain text.
#[must_use]
pub fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\u{1b}' => match chars.peek() {
                Some('[') => {
                    chars.next();
                    // CSI: parameters/intermediates, then one final byte 0x40..=0x7e.
                    for n in chars.by_ref() {
                        if ('\u{40}'..='\u{7e}').contains(&n) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    // OSC: ends at BEL or ESC \.
                    while let Some(n) = chars.next() {
                        if n == '\u{7}' {
                            break;
                        }
                        if n == '\u{1b}' {
                            chars.next();
                            break;
                        }
                    }
                }
                Some(_) => {
                    chars.next();
                }
                None => {}
            },
            '\r' => {
                // "\r\n" is a newline; a lone "\r" is a progress redraw, drop it.
                if chars.peek() != Some(&'\n') {
                    // keep the redraw's last state by discarding what came before on this line
                    if let Some(pos) = out.rfind('\n') {
                        out.truncate(pos + 1);
                    } else {
                        out.clear();
                    }
                }
            }
            c => out.push(c),
        }
    }
    out
}

/// Parses the output of `git rev-list --count HEAD..@{u}`.
#[must_use]
pub fn parse_behind(output: &str) -> Option<u32> {
    output.trim().parse().ok()
}

/// Whether `git pull --ff-only` found nothing to do.
#[must_use]
pub fn summarize_pull(output: &str) -> bool {
    let lower = output.to_lowercase();
    lower.contains("already up to date") || lower.contains("already up-to-date")
}

/// Splits `git log -1 --format=%h%x09%s` into (sha, subject).
#[must_use]
pub fn parse_head(output: &str) -> Option<(String, String)> {
    let line = output.lines().next()?.trim();
    let (sha, subject) = line.split_once('\t')?;
    (!sha.is_empty()).then(|| (sha.to_string(), subject.trim().to_string()))
}

/// Cuts text to at most `max` bytes on a char boundary, keeping the tail (the verdict).
#[must_use]
pub fn clip_tail(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    let mut start = text.len() - max;
    while !text.is_char_boundary(start) {
        start += 1;
    }
    format!("…\n{}", &text[start..])
}

fn find_tool(name: &'static str) -> Result<PathBuf, EngineError> {
    // GUI apps start with a minimal PATH, so look in the usual installer dirs first.
    let mut dirs_: Vec<PathBuf> = ["/usr/bin", "/bin", "/opt/homebrew/bin", "/usr/local/bin"]
        .iter()
        .map(PathBuf::from)
        .collect();
    if let Some(path) = std::env::var_os("PATH") {
        dirs_.extend(std::env::split_paths(&path));
    }
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    dirs_
        .into_iter()
        .map(|d| d.join(&exe))
        .find(|p| p.is_file())
        .ok_or(EngineError::NotInstalled(name))
}

struct Captured {
    ok: bool,
    text: String,
}

async fn run_capture(
    label: &'static str,
    mut cmd: Command,
    limit: Duration,
) -> Result<Captured, EngineError> {
    cmd.stdin(Stdio::null())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("NO_COLOR", "1")
        .kill_on_drop(true);
    let out = tokio::time::timeout(limit, cmd.output())
        .await
        .map_err(|_| EngineError::Timeout(label, limit.as_secs()))?
        .map_err(|e| EngineError::Spawn(label, e))?;
    let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
    let err = String::from_utf8_lossy(&out.stderr);
    if !err.trim().is_empty() {
        if !text.is_empty() && !text.ends_with('\n') {
            text.push('\n');
        }
        text.push_str(&err);
    }
    Ok(Captured {
        ok: out.status.success(),
        text: clip_tail(strip_ansi(&text).trim_end(), MAX_OUTPUT),
    })
}

async fn git(dir: &Path, args: &[&str], limit: Duration) -> Result<Captured, EngineError> {
    let mut cmd = Command::new(find_tool("git")?);
    cmd.arg("-C").arg(dir).args(args);
    run_capture("git", cmd, limit).await
}

fn check_checkout(dir: &Path) -> Result<(), EngineError> {
    if dir.join(".git").exists() {
        Ok(())
    } else {
        Err(EngineError::NoCheckout(dir.display().to_string()))
    }
}

fn now_secs() -> u32 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u32::try_from(d.as_secs()).unwrap_or(u32::MAX))
}

fn last_health() -> Option<HealthReport> {
    LAST_HEALTH.lock().ok().and_then(|g| g.clone())
}

/// Reads the checkout's status. Fetches quietly first so `behind` is current; if that
/// fails (offline) the rest is still reported with a note.
///
/// # Errors
/// Only when git itself cannot be started; a missing checkout is reported in the value.
pub async fn read_status(dir: &Path) -> Result<EngineStatus, EngineError> {
    let mut status = EngineStatus {
        dir: dir.display().to_string(),
        exists: dir.join(".git").exists(),
        branch: None,
        sha: None,
        subject: None,
        behind: None,
        dirty: false,
        health: last_health(),
        note: None,
    };
    if !status.exists {
        status.note = Some(format!("no kun checkout at {}", status.dir));
        return Ok(status);
    }
    if let Ok(head) = git(dir, &["log", "-1", "--format=%h%x09%s"], GIT_TIMEOUT).await
        && let Some((sha, subject)) = parse_head(&head.text)
    {
        status.sha = Some(sha);
        status.subject = Some(subject);
    }
    if let Ok(b) = git(dir, &["rev-parse", "--abbrev-ref", "HEAD"], GIT_TIMEOUT).await
        && b.ok
    {
        status.branch = Some(b.text.trim().to_string());
    }
    if let Ok(s) = git(
        dir,
        &["status", "--porcelain", "--untracked-files=no"],
        GIT_TIMEOUT,
    )
    .await
    {
        status.dirty = s.ok && !s.text.trim().is_empty();
    }
    match git(dir, &["fetch", "--quiet"], GIT_TIMEOUT).await {
        Ok(f) if f.ok => {}
        Ok(f) => status.note = Some(format!("fetch failed: {}", f.text.trim())),
        Err(e) => status.note = Some(e.to_string()),
    }
    if let Ok(c) = git(dir, &["rev-list", "--count", "HEAD..@{u}"], GIT_TIMEOUT).await
        && c.ok
    {
        status.behind = parse_behind(&c.text);
    }
    Ok(status)
}

/// Fast-forwards the checkout. Never resets or forces.
///
/// # Errors
/// If there is no checkout, git is missing or the pull times out.
pub async fn pull(dir: &Path) -> Result<UpdateReport, EngineError> {
    check_checkout(dir)?;
    let before = git(dir, &["rev-parse", "--short", "HEAD"], GIT_TIMEOUT)
        .await
        .ok()
        .map(|c| c.text.trim().to_string());
    let done = git(dir, &["pull", "--ff-only"], PULL_TIMEOUT).await?;
    let after = git(dir, &["rev-parse", "--short", "HEAD"], GIT_TIMEOUT)
        .await
        .ok()
        .map(|c| c.text.trim().to_string());
    Ok(UpdateReport {
        ok: done.ok,
        up_to_date: done.ok && summarize_pull(&done.text),
        before,
        after,
        output: done.text,
    })
}

/// Runs the engine's health script.
///
/// # Errors
/// If bash is unavailable (Windows), the script is missing or it times out.
pub async fn run_health(dir: &Path) -> Result<HealthReport, EngineError> {
    if cfg!(windows) {
        return Err(EngineError::Unsupported(
            "الفحص يحتاج bash ولا يعمل على ويندوز بعد · health needs bash, not supported on Windows yet",
        ));
    }
    check_checkout(dir)?;
    let script = dir.join(".claude/scripts/health.sh");
    if !script.is_file() {
        return Err(EngineError::NoCheckout(script.display().to_string()));
    }
    let mut cmd = Command::new(find_tool("bash")?);
    cmd.arg(&script).current_dir(dir);
    let run = run_capture("health.sh", cmd, HEALTH_TIMEOUT).await?;
    let report = HealthReport {
        ok: run.ok,
        at: now_secs(),
        output: run.text,
    };
    if let Ok(mut g) = LAST_HEALTH.lock() {
        *g = Some(report.clone());
    }
    Ok(report)
}

/// Reads the live state file.
///
/// # Errors
/// If the file exists but cannot be read.
pub async fn read_state(claude: &Path) -> Result<LiveState, EngineError> {
    let path = claude.join("state/aware.md");
    let shown = path.display().to_string();
    match tokio::fs::read_to_string(&path).await {
        Ok(text) => Ok(LiveState {
            path: shown,
            exists: true,
            text: clip_tail(&text, MAX_OUTPUT),
        }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(LiveState {
            path: shown,
            exists: false,
            text: String::new(),
        }),
        Err(e) => Err(EngineError::Read(shown, e)),
    }
}

/// `status` — checkout path, commit, behind count, last health.
#[tauri::command]
async fn status() -> Result<EngineStatus, EngineError> {
    read_status(&kun_dir()).await
}

/// `update` — `git pull --ff-only` on the checkout.
#[tauri::command]
async fn update() -> Result<UpdateReport, EngineError> {
    pull(&kun_dir()).await
}

/// `health` — run health.sh and return its output.
#[tauri::command]
async fn health() -> Result<HealthReport, EngineError> {
    run_health(&kun_dir()).await
}

/// `state` — `~/.claude/state/aware.md`.
#[tauri::command]
async fn state() -> Result<LiveState, EngineError> {
    read_state(&claude_dir()).await
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("engine")
        .invoke_handler(tauri::generate_handler![status, update, health, state])
        .build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
