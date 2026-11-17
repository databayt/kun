//! tasks — the task gate. A task is a GitHub issue; kun's API lists and claims them, this side
//! decides whether *this machine* may start one (`readiness.rs`) and gives the chat everything
//! the work needs: `TASK.md` in the working folder, and the required repos opened with the run.
//!
//! `start` re-checks the gate, claims on the server (atomic there), writes the seed and remembers
//! the held task for the heartbeat. Nothing is skipped silently: only the CEO closes an issue.

use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};

use crate::{
    network::{
        api::{self, Api, ApiError, HttpApi},
        host::{self, Host, RealHost},
        valid_task_id,
    },
    pack, profile, settings,
};

#[path = "model.rs"]
pub mod model;
#[path = "readiness.rs"]
pub mod readiness;

use model::{ReadyState, Task, TasksResponse, TasksView};
use readiness::Facts;

/// The seed's file name, in the working folder.
pub const SEED_FILE: &str = "TASK.md";

#[derive(Debug, thiserror::Error)]
pub enum TaskError {
    #[error(transparent)]
    Api(#[from] ApiError),
    #[error("{0}")]
    Invalid(&'static str),
    #[error("task not found")]
    NotFound,
    #[error("not ready: {}", .0.join(", "))]
    NotReady(Vec<String>),
    #[error("kun refused: {0}")]
    Refused(String),
    #[error("{0}")]
    Local(String),
}

impl Serialize for TaskError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// What the machine looks like right now. Blocking (git, filesystem): call off the async thread.
#[must_use]
pub fn gather_facts(host: &impl Host) -> Facts {
    Facts {
        me: host.login(),
        repos: host.repos(),
        items: host.item_states().unwrap_or_default(),
        allowed_items: host.allowed_items(),
        allowed_repos: host.allowed_repos(),
    }
}

/// The folder a run starts in: the profile's workspace, else the department's pack folder.
fn work_dir() -> Result<PathBuf, TaskError> {
    let local = |e: String| TaskError::Local(e);
    let s = settings::load().map_err(|e| local(e.to_string()))?;
    let resolved = profile::current().map_err(|e| local(e.to_string()))?;
    if resolved.explicit {
        Ok(pack::workspace(&resolved.profile)
            .map_err(|e| local(e.to_string()))?
            .dir)
    } else {
        pack::workdir(&s.department).map_err(|e| local(e.to_string()))
    }
}

fn departments_to_search() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(s) = settings::load() {
        out.push(s.department);
    }
    if let Ok(r) = profile::current() {
        for d in r.profile.departments {
            if !out.contains(&d.name) {
                out.push(d.name);
            }
        }
    }
    out
}

/// The tasks of a department with a verdict for each.
///
/// # Errors
/// When the API call fails.
pub async fn view_with(
    api: &impl Api,
    facts: &Facts,
    department: &str,
) -> Result<TasksView, TaskError> {
    let tasks: TasksResponse =
        api::get_json(api, &format!("/api/machine/tasks?department={department}")).await?;
    Ok(readiness::view(tasks, facts))
}

/// A claim refusal arrives as 409 `{ error, detail? }`.
fn refusal(err: ApiError) -> TaskError {
    if let ApiError::Status { status: 409, body } = &err {
        let parsed: Option<serde_json::Value> = serde_json::from_str(body).ok();
        let word = parsed
            .as_ref()
            .and_then(|v| v.get("error"))
            .and_then(|e| e.as_str());
        let detail = parsed
            .as_ref()
            .and_then(|v| v.get("detail"))
            .and_then(|e| e.as_str());
        return TaskError::Refused(match (word, detail) {
            (Some(w), Some(d)) => format!("{w}: {d}"),
            (Some(w), None) => w.to_owned(),
            _ => body.clone(),
        });
    }
    TaskError::Api(err)
}

/// Finds a task by id across departments.
async fn find_task(
    api: &impl Api,
    facts: &Facts,
    departments: &[String],
    id: &str,
) -> Result<(Task, TasksView), TaskError> {
    for department in departments {
        let view = view_with(api, facts, department).await?;
        let hit = view
            .tasks
            .mine
            .iter()
            .chain(&view.tasks.board)
            .find(|t| t.id == id)
            .cloned();
        if let Some(task) = hit {
            return Ok((task, view));
        }
    }
    Err(TaskError::NotFound)
}

/// Re-checks the gate, claims on the server, writes the seed into `dir`. Returns the task.
///
/// # Errors
/// [`TaskError::NotReady`] when the gate says no, [`TaskError::Refused`] when the server does.
pub async fn start_with(
    api: &impl Api,
    facts: &Facts,
    departments: &[String],
    dir: &Path,
    id: &str,
) -> Result<Task, TaskError> {
    if !valid_task_id(id) {
        return Err(TaskError::Invalid("task id is invalid"));
    }
    let (task, view) = find_task(api, facts, departments, id).await?;
    let verdict = &view.readiness[&task.id];
    if verdict.state != ReadyState::Ready {
        return Err(TaskError::NotReady(verdict.missing.clone()));
    }
    let already_mine = !facts.me.is_empty() && task.holder.as_deref() == Some(facts.me.as_str());
    let task = if already_mine {
        task
    } else {
        let answer: serde_json::Value =
            api::post_json(api, "/api/machine/claim", &serde_json::json!({ "id": id }))
                .await
                .map_err(refusal)?;
        if answer.get("ok").and_then(serde_json::Value::as_bool) == Some(false) {
            let why = answer
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("refused");
            return Err(TaskError::Refused(why.to_owned()));
        }
        answer
            .get("task")
            .and_then(|t| serde_json::from_value(t.clone()).ok())
            .unwrap_or(task)
    };
    fs::write(dir.join(SEED_FILE), readiness::seed_text(&task))
        .map_err(|e| TaskError::Local(e.to_string()))?;
    Ok(task)
}

/// POSTs to `release` or `done` and treats `{ ok: false }` as a refusal.
async fn post_simple(api: &impl Api, path: &str, body: serde_json::Value) -> Result<(), TaskError> {
    let answer: serde_json::Value = api::post_json(api, path, &body).await.map_err(refusal)?;
    if answer.get("ok").and_then(serde_json::Value::as_bool) == Some(false) {
        let why = answer
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("refused");
        return Err(TaskError::Refused(why.to_owned()));
    }
    Ok(())
}

/// Gives the task back.
///
/// # Errors
/// On a bad id or a refused call.
pub async fn release_with(api: &impl Api, id: &str) -> Result<(), TaskError> {
    if !valid_task_id(id) {
        return Err(TaskError::Invalid("task id is invalid"));
    }
    post_simple(api, "/api/machine/release", serde_json::json!({ "id": id })).await
}

/// Hands the task to review with a summary.
///
/// # Errors
/// On a bad id, an empty or oversized summary, or a refused call.
pub async fn finish_with(api: &impl Api, id: &str, summary: &str) -> Result<(), TaskError> {
    if !valid_task_id(id) {
        return Err(TaskError::Invalid("task id is invalid"));
    }
    let summary = summary.trim();
    if summary.is_empty() || summary.chars().count() > 4000 {
        return Err(TaskError::Invalid("summary must be 1 to 4000 characters"));
    }
    post_simple(
        api,
        "/api/machine/done",
        serde_json::json!({ "id": id, "summary": summary }),
    )
    .await
}

/// Forgets the held task and its seed, when they are `id`'s.
fn clear_held(id: &str) {
    if host::held_task().as_deref() == Some(id) {
        if let Err(e) = host::set_held_task(None) {
            tracing::warn!("could not clear the held task: {e}");
        }
        if let Ok(dir) = work_dir() {
            let seed = dir.join(SEED_FILE);
            if fs::read_to_string(&seed).is_ok_and(|t| readiness::seed_repos(&t, id).is_some()) {
                let _ = fs::remove_file(seed);
            }
        }
    }
}

async fn facts_now() -> Result<Facts, TaskError> {
    tokio::task::spawn_blocking(|| gather_facts(&RealHost))
        .await
        .map_err(|e| TaskError::Local(e.to_string()))
}

/// `tasks` — the department's queue and board, each task with its gate verdict.
#[tauri::command]
async fn tasks(department: String) -> Result<TasksView, TaskError> {
    if !pack::valid_name(&department) {
        return Err(TaskError::Invalid("department name is invalid"));
    }
    let facts = facts_now().await?;
    view_with(&HttpApi::from_process()?, &facts, &department).await
}

/// `start` — re-checks the gate, claims, writes `TASK.md`. The chat opens with `?task=<id>`.
#[tauri::command]
async fn start(id: String) -> Result<Task, TaskError> {
    let facts = facts_now().await?;
    let dir = tokio::task::spawn_blocking(work_dir)
        .await
        .map_err(|e| TaskError::Local(e.to_string()))??;
    let task = start_with(
        &HttpApi::from_process()?,
        &facts,
        &departments_to_search(),
        &dir,
        &id,
    )
    .await?;
    host::set_held_task(Some(&task.id)).map_err(TaskError::Local)?;
    Ok(task)
}

/// `release` — gives the task back.
#[tauri::command]
async fn release(id: String) -> Result<(), TaskError> {
    release_with(&HttpApi::from_process()?, &id).await?;
    clear_held(&id);
    Ok(())
}

/// `done` — sends the task to review with a summary; the CEO closes the issue.
#[tauri::command]
async fn done(id: String, summary: String) -> Result<(), TaskError> {
    finish_with(&HttpApi::from_process()?, &id, &summary).await?;
    clear_held(&id);
    Ok(())
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("tasks")
        .invoke_handler(tauri::generate_handler![tasks, start, release, done])
        .build()
}

/// The repo folders a task's run opens, among the clones on this machine: used by chat.
#[must_use]
pub fn task_repo_dirs(host: &impl Host, names: &[String]) -> Vec<PathBuf> {
    host.repo_paths()
        .into_iter()
        .filter(|p| {
            p.file_name()
                .is_some_and(|n| names.iter().any(|r| r.as_str() == n.to_string_lossy()))
        })
        .collect()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
