//! chat — sends a prompt to the teammate's agent CLI and streams what comes back.
//!
//! `ask` builds a [`driver::Job`] that runs inside the profile's workspace (or the department's
//! pack folder when there is no profile), streams
//! every normalized event down a Tauri `Channel`, and remembers the session so the
//! conversation can be reopened. `stop` cancels a running job; dropping the run kills the
//! child process (`kill_on_drop`), so a stopped job leaves nothing behind.

use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex, PoisonError},
};

use serde::Serialize;
use tauri::{
    Runtime,
    ipc::Channel,
    plugin::{Builder, TauriPlugin},
};
use tokio::sync::oneshot;

use crate::{
    driver::{self, DriverError, DriverKind, Event, Job},
    pack::{self, PackError, Workspace},
    profile::{self, OsStore, ProfileError, Resolved},
    sessions,
    settings::{self, SettingsError},
};

#[derive(Debug, thiserror::Error)]
pub enum ChatError {
    #[error("job id is invalid")]
    BadJobId,
    #[error("a job with this id is already running")]
    Duplicate,
    #[error(transparent)]
    Settings(#[from] SettingsError),
    #[error(transparent)]
    Pack(#[from] PackError),
    #[error(transparent)]
    Profile(#[from] ProfileError),
    #[error(transparent)]
    Driver(#[from] DriverError),
}

impl Serialize for ChatError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

type Cancel = oneshot::Sender<()>;

/// Running jobs, so `stop` can reach them.
static RUNNING: LazyLock<Mutex<HashMap<String, Cancel>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Removes the job from [`RUNNING`] however the run ends.
struct Registration(String);

impl Drop for Registration {
    fn drop(&mut self) {
        RUNNING.lock().unwrap_or_else(PoisonError::into_inner).remove(&self.0);
    }
}

fn register(job_id: &str, cancel: Cancel) -> Result<Registration, ChatError> {
    let mut map = RUNNING.lock().unwrap_or_else(PoisonError::into_inner);
    if map.contains_key(job_id) {
        return Err(ChatError::Duplicate);
    }
    map.insert(job_id.to_owned(), cancel);
    Ok(Registration(job_id.to_owned()))
}

/// Asks a running job to stop. False when no such job is running.
#[must_use]
pub fn cancel(job_id: &str) -> bool {
    let sender = RUNNING.lock().unwrap_or_else(PoisonError::into_inner).remove(job_id);
    sender.is_some_and(|tx| tx.send(()).is_ok())
}

fn valid_job_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// The session title: the first prompt, one line, at most 60 characters.
fn title_from(prompt: &str) -> String {
    let line = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut title: String = line.chars().take(60).collect();
    if line.chars().count() > 60 {
        title.push('…');
    }
    if title.is_empty() { "…".into() } else { title }
}

/// The flags that give a run its world: every repo of the profile that is on disk, then the
/// generated settings file. Only claude takes them.
fn job_extras(kind: DriverKind, repos: &[String], ws: &Workspace) -> Vec<String> {
    if kind != DriverKind::Claude {
        return Vec::new();
    }
    let mut args = Vec::new();
    for name in repos {
        let dir = ws.repos.join(name);
        if dir.is_dir() {
            args.extend(["--add-dir".to_owned(), dir.display().to_string()]);
        }
    }
    args.extend(["--settings".to_owned(), ws.settings_file.display().to_string()]);
    args
}

/// The driver for a run: the profile's when it fixes one, else the request, else the saved default.
fn pick_driver(resolved: &Resolved, requested: Option<DriverKind>, saved: DriverKind) -> DriverKind {
    if resolved.driver_locked { resolved.profile.driver } else { requested.unwrap_or(saved) }
}

fn build_job(
    job_id: &str,
    driver: DriverKind,
    prompt: String,
    cwd: String,
    session: Option<String>,
    extra_args: Vec<String>,
    env: Vec<(String, String)>,
) -> Result<Job, ChatError> {
    if !valid_job_id(job_id) {
        return Err(ChatError::BadJobId);
    }
    Ok(Job { job_id: job_id.to_owned(), driver, prompt, cwd, session, timeout_secs: None, extra_args, env })
}

/// Where and how a run starts: its folder, extra flags and secrets. Blocking (filesystem, keychain).
/// Folder, extra flags and environment of one run.
type RunSetup = (String, Vec<String>, Vec<(String, String)>);

fn prepare_run(resolved: &Resolved, department: &str, kind: DriverKind) -> Result<RunSetup, ChatError> {
    if !resolved.explicit {
        return Ok((pack::workdir(department)?.display().to_string(), Vec::new(), Vec::new()));
    }
    let ws = pack::workspace(&resolved.profile)?;
    let extras = job_extras(kind, &resolved.profile.repos, &ws);
    let env = profile::secret_env(&OsStore, resolved)?;
    Ok((ws.dir.display().to_string(), extras, env))
}

/// `ask` — runs one prompt, streaming events to `channel`. The frontend supplies `job_id`
/// so it can call `stop` before this command returns. Run-time failures arrive as an
/// `error` event; only bad arguments reject the call.
#[tauri::command]
async fn ask(
    prompt: String,
    session: Option<String>,
    driver: Option<DriverKind>,
    job_id: String,
    channel: Channel<Event>,
) -> Result<(), ChatError> {
    let settings = settings::load()?;
    let resolved = profile::current()?;
    let kind = pick_driver(&resolved, driver, settings.driver);
    let department = settings.department.clone();
    let (cwd, extras, env) = tokio::task::spawn_blocking(move || prepare_run(&resolved, &department, kind))
        .await
        .map_err(|e| ChatError::Pack(PackError::Profile(e.to_string())))??;
    let job = build_job(&job_id, kind, prompt, cwd, session, extras, env)?;
    let (tx, rx) = oneshot::channel();
    let _registration = register(&job.job_id, tx)?;

    let title = title_from(&job.prompt);
    let mut seen = job.session.clone();
    let outcome = {
        let emit = |event: Event| {
            let id = match &event {
                Event::Started { session } => Some(session.clone()),
                Event::Done { session: Some(s), .. } => Some(s.clone()),
                _ => None,
            };
            if let Some(id) = id {
                if let Err(e) = sessions::touch(&id, &title, &settings.department, kind) {
                    tracing::warn!("could not record session: {e}");
                }
                seen = Some(id);
            }
            if channel.send(event).is_err() {
                tracing::debug!("chat channel closed");
            }
        };
        tokio::select! {
            r = driver::run(&job, emit) => Some(r),
            _ = rx => None,
        }
    };
    let last = match outcome {
        Some(Ok(())) => None,
        Some(Err(e)) => Some(Event::Error { message: e.to_string() }),
        None => Some(Event::Done { session: seen, ok: false, result: Some("stopped".into()) }),
    };
    if let Some(event) = last {
        let _ = channel.send(event);
    }
    Ok(())
}

/// `stop` — cancels a running job. True when it was running.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn stop(job_id: String) -> bool {
    cancel(&job_id)
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("chat").invoke_handler(tauri::generate_handler![ask, stop]).build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
