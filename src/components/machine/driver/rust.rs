//! driver — runs a prompt through the agent CLI the teammate is already signed into.
//!
//! machine never proxies a model and never touches a login: it spawns the unmodified
//! `claude`, `codex` or `opencode` binary on the owner's own machine and reads its JSON
//! event stream. The parsing is pure (`parse_line`) so it is tested against fixtures.

use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};
use ts_rs::TS;

/// Which agent CLI runs the job.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "driver/types.ts")]
pub enum DriverKind {
    Claude,
    Codex,
    Opencode,
}

impl DriverKind {
    pub const ALL: [Self; 3] = [Self::Claude, Self::Codex, Self::Opencode];

    #[must_use]
    pub fn binary(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Opencode => "opencode",
        }
    }
}

/// Whether a driver is usable on this machine.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "driver/types.ts")]
pub struct DriverStatus {
    pub kind: DriverKind,
    pub installed: bool,
    pub path: Option<String>,
}

/// One unit of work: a prompt, where to run it, and which session to resume.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "driver/types.ts")]
pub struct Job {
    pub job_id: String,
    pub driver: DriverKind,
    pub prompt: String,
    pub cwd: String,
    pub session: Option<String>,
    pub timeout_secs: Option<u32>,
    /// Extra flags, already paired as `[flag, value, flag, value…]`. Only an allow-listed few
    /// are accepted (`--add-dir`, `--settings`, claude only); see [`args_for`].
    #[serde(default)]
    pub extra_args: Vec<String>,
    /// Environment for this one run (a profile's secrets). Never sent to or from JS.
    #[serde(default)]
    pub env: Vec<(String, String)>,
}

/// What the UI sees while a job runs. Normalized across drivers.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase")]
#[ts(export, export_to = "driver/types.ts")]
pub enum Event {
    Started { session: String },
    Text { text: String },
    Tool { name: String },
    Done { session: Option<String>, ok: bool, result: Option<String> },
    Error { message: String },
}

#[derive(Debug, thiserror::Error)]
pub enum DriverError {
    #[error("{0} is not installed or not on PATH")]
    NotInstalled(&'static str),
    #[error("job is invalid: {0}")]
    Invalid(&'static str),
    #[error("could not start {0}: {1}")]
    Spawn(&'static str, std::io::Error),
    #[error("timed out after {0}s")]
    Timeout(u32),
}

impl Serialize for DriverError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

const DEFAULT_TIMEOUT_SECS: u32 = 30 * 60;
const MAX_PROMPT_BYTES: usize = 64 * 1024;
const MAX_EXTRA_ARGS: usize = 32;
/// The only flags a caller may add, each with one value.
const EXTRA_FLAGS: [&str; 2] = ["--add-dir", "--settings"];
/// Environment names a run may never override.
const PROTECTED_ENV: [&str; 6] = ["PATH", "HOME", "USERPROFILE", "SHELL", "NODE_OPTIONS", "CLAUDE_CONFIG_DIR"];

/// Apps launched from the Finder or Start menu get a minimal PATH, so look where
/// the CLIs' own installers put them before falling back to PATH.
fn search_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(home) = dirs::home_dir() {
        for sub in [".local/bin", ".opencode/bin", ".npm-global/bin", ".bun/bin", ".cargo/bin"] {
            dirs.push(home.join(sub));
        }
    }
    if cfg!(windows) {
        dirs.extend(windows_dirs(
            std::env::var_os("LOCALAPPDATA").map(PathBuf::from),
            std::env::var_os("USERPROFILE").map(PathBuf::from),
            std::env::var_os("APPDATA").map(PathBuf::from),
        ));
    }
    dirs.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].map(PathBuf::from));
    if let Some(path) = std::env::var_os("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    dirs
}

/// Where the Windows installers put the CLIs: `%LOCALAPPDATA%\Programs\claude`,
/// `%USERPROFILE%\.local\bin` and the npm global `%APPDATA%\npm`.
fn windows_dirs(local_app_data: Option<PathBuf>, user_profile: Option<PathBuf>, app_data: Option<PathBuf>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(p) = local_app_data {
        dirs.push(p.join("Programs").join("claude"));
    }
    if let Some(p) = user_profile {
        dirs.push(p.join(".local").join("bin"));
    }
    if let Some(p) = app_data {
        dirs.push(p.join("npm"));
    }
    dirs
}

fn find_binary(name: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    let candidates: &[&str] = if cfg!(windows) { &["", ".exe", ".cmd"] } else { &[""] };
    dirs.iter().find_map(|dir| {
        candidates
            .iter()
            .map(|ext| dir.join(format!("{name}{ext}")))
            .find(|p| p.is_file())
    })
}

/// Which drivers are installed here. Being signed in is checked by running them.
#[must_use]
pub fn detect() -> Vec<DriverStatus> {
    let dirs = search_dirs();
    DriverKind::ALL
        .into_iter()
        .map(|kind| {
            let path = find_binary(kind.binary(), &dirs);
            DriverStatus { kind, installed: path.is_some(), path: path.map(|p| p.display().to_string()) }
        })
        .collect()
}

/// Extra flags are `--add-dir <dir>` / `--settings <file>` pairs and only for claude; the
/// environment may not touch the variables that decide which binary or config runs.
fn validate_extras(job: &Job) -> Result<(), DriverError> {
    if !job.extra_args.is_empty() {
        let tame = |a: &String| a.len() <= 4096 && !a.chars().any(char::is_control);
        if job.driver != DriverKind::Claude {
            return Err(DriverError::Invalid("extra args are claude-only"));
        }
        if job.extra_args.len() > MAX_EXTRA_ARGS || !job.extra_args.len().is_multiple_of(2) || !job.extra_args.iter().all(tame) {
            return Err(DriverError::Invalid("extra args"));
        }
        for pair in job.extra_args.chunks_exact(2) {
            if !EXTRA_FLAGS.contains(&pair[0].as_str()) || pair[1].is_empty() || pair[1].starts_with('-') {
                return Err(DriverError::Invalid("extra args"));
            }
        }
    }
    for (name, value) in &job.env {
        let name_ok = !name.is_empty()
            && name.len() <= 64
            && name.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
            && !PROTECTED_ENV.contains(&name.as_str())
            && !name.starts_with("LD_")
            && !name.starts_with("DYLD_");
        if !name_ok || value.len() > 8192 || value.contains('\0') {
            return Err(DriverError::Invalid("env"));
        }
    }
    Ok(())
}

/// The exact argv for a job. Pure, so it is unit-tested.
///
/// # Errors
/// When the prompt is empty or too large, or the session id has unsafe characters.
pub fn args_for(job: &Job) -> Result<Vec<String>, DriverError> {
    if job.prompt.trim().is_empty() {
        return Err(DriverError::Invalid("empty prompt"));
    }
    if job.prompt.len() > MAX_PROMPT_BYTES {
        return Err(DriverError::Invalid("prompt too large"));
    }
    if let Some(s) = &job.session
        && !s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(DriverError::Invalid("session id"));
    }
    validate_extras(job)?;
    let mut args: Vec<String> = match job.driver {
        DriverKind::Claude => {
            let mut a: Vec<String> = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "auto"]
                .into_iter()
                .map(String::from)
                .collect();
            a.extend(job.extra_args.iter().cloned());
            if job.session.is_some() {
                a.push("--resume".into());
            }
            a
        }
        // Codex: workspace-write sandbox; docs discourage unattended ChatGPT-plan runs,
        // so machine only ever starts codex from the owner's own click.
        DriverKind::Codex => ["exec", "--json", "--sandbox", "workspace-write"].map(String::from).to_vec(),
        DriverKind::Opencode => {
            let mut a = vec!["run".to_string(), "--format".into(), "json".into()];
            if job.session.is_some() {
                a.push("--session".into());
            }
            a
        }
    };
    if let Some(s) = &job.session {
        match job.driver {
            DriverKind::Codex => args.extend(["resume".to_string(), s.clone()]),
            _ => args.push(s.clone()),
        }
    }
    // `--` ends option parsing, so a prompt that starts with "-" is never read as a flag.
    args.push("--".into());
    args.push(job.prompt.clone());
    Ok(args)
}

/// Turns one line of a driver's JSON stream into zero or more events.
#[must_use]
pub fn parse_line(kind: DriverKind, line: &str) -> Vec<Event> {
    let Ok(v) = serde_json::from_str::<Value>(line) else { return Vec::new() };
    let s = |v: &Value| v.as_str().map(str::to_owned);
    match kind {
        DriverKind::Claude => match v["type"].as_str() {
            Some("system") if v["subtype"] == "init" => {
                s(&v["session_id"]).map(|session| Event::Started { session }).into_iter().collect()
            }
            Some("assistant") => v["message"]["content"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|part| match part["type"].as_str() {
                    Some("text") => s(&part["text"]).map(|text| Event::Text { text }),
                    Some("tool_use") => s(&part["name"]).map(|name| Event::Tool { name }),
                    _ => None,
                })
                .collect(),
            Some("result") => vec![Event::Done {
                session: s(&v["session_id"]),
                ok: v["is_error"] == false,
                result: s(&v["result"]),
            }],
            _ => Vec::new(),
        },
        DriverKind::Codex => match v["type"].as_str() {
            Some("thread.started") => s(&v["thread_id"]).map(|session| Event::Started { session }).into_iter().collect(),
            Some("item.completed") => match v["item"]["type"].as_str() {
                Some("agent_message") => s(&v["item"]["text"]).map(|text| Event::Text { text }).into_iter().collect(),
                Some("command_execution") => vec![Event::Tool { name: "shell".into() }],
                Some(other) => vec![Event::Tool { name: other.to_owned() }],
                None => Vec::new(),
            },
            Some("turn.completed") => vec![Event::Done { session: None, ok: true, result: None }],
            Some("error") => s(&v["message"]).map(|message| Event::Error { message }).into_iter().collect(),
            _ => Vec::new(),
        },
        DriverKind::Opencode => match v["type"].as_str() {
            Some("error") => {
                let message = s(&v["error"]["data"]["message"]).or_else(|| s(&v["error"]["name"])).unwrap_or_default();
                vec![Event::Error { message }]
            }
            Some("text") => s(&v["part"]["text"]).map(|text| Event::Text { text }).into_iter().collect(),
            Some("tool_use") => s(&v["part"]["tool"]).map(|name| Event::Tool { name }).into_iter().collect(),
            _ => Vec::new(),
        },
    }
}

/// Runs a job to completion, calling `emit` for every event. Never panics on bad output.
///
/// # Errors
/// When the driver is missing, the job is invalid, the process cannot start, or it times out.
pub async fn run(job: &Job, mut emit: impl FnMut(Event) + Send) -> Result<(), DriverError> {
    let bin = find_binary(job.driver.binary(), &search_dirs()).ok_or(DriverError::NotInstalled(job.driver.binary()))?;
    let args = args_for(job)?;
    if !Path::new(&job.cwd).is_dir() {
        return Err(DriverError::Invalid("cwd is not a folder"));
    }
    let mut child = Command::new(bin)
        .args(&args)
        .current_dir(&job.cwd)
        .envs(job.env.iter().map(|(k, v)| (k, v)))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| DriverError::Spawn(job.driver.binary(), e))?;

    let stdout = child.stdout.take().ok_or(DriverError::Invalid("no stdout"))?;
    let mut lines = BufReader::new(stdout).lines();
    let secs = job.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);
    let mut finished = false;
    let read = async {
        while let Ok(Some(line)) = lines.next_line().await {
            for event in parse_line(job.driver, &line) {
                finished |= matches!(event, Event::Done { .. } | Event::Error { .. });
                emit(event);
            }
        }
        let status = child.wait().await;
        if !finished {
            let ok = status.is_ok_and(|s| s.success());
            emit(Event::Done { session: None, ok, result: None });
        }
    };
    tokio::time::timeout(Duration::from_secs(u64::from(secs)), read)
        .await
        .map_err(|_| DriverError::Timeout(secs))
}

/// `drivers` — which agent CLIs this machine has.
#[tauri::command]
fn drivers() -> Vec<DriverStatus> {
    detect()
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("driver").invoke_handler(tauri::generate_handler![drivers]).build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
