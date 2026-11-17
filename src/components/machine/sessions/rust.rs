//! sessions — the list of conversations, kept in `~/.kun/machine/sessions.json`.
//!
//! The agent CLIs own the transcripts; machine only remembers which sessions it started
//! (id, title, department, driver) so a teammate can reopen one. Writes are atomic.

use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use ts_rs::TS;

use crate::driver::DriverKind;

/// One remembered conversation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "sessions/types.ts")]
pub struct Session {
    pub id: String,
    pub title: String,
    pub department: String,
    pub driver: DriverKind,
    #[ts(type = "number")]
    pub created_at: u64,
    #[ts(type = "number")]
    pub updated_at: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum SessionsError {
    #[error("session id is invalid")]
    BadId,
    #[error("title must be 1 to 120 characters")]
    BadTitle,
    #[error("no such session")]
    NotFound,
    #[error("could not find the home folder")]
    NoHome,
    #[error("sessions.json is damaged ({0}); fix or delete it")]
    Corrupt(String),
    #[error("{0}")]
    Io(#[from] io::Error),
}

impl Serialize for SessionsError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct File {
    #[serde(default)]
    sessions: Vec<Session>,
}

/// One writer at a time inside the process; the rename keeps readers safe from half-files.
static LOCK: Mutex<()> = Mutex::new(());

fn machine_dir() -> Result<PathBuf, SessionsError> {
    match std::env::var_os("KUN_HOME") {
        Some(p) if !p.is_empty() => Ok(PathBuf::from(p).join("machine")),
        _ => dirs::home_dir()
            .map(|h| h.join(".kun/machine"))
            .ok_or(SessionsError::NoHome),
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

fn read(dir: &Path) -> Result<Vec<Session>, SessionsError> {
    match fs::read_to_string(dir.join("sessions.json")) {
        Ok(s) => serde_json::from_str::<File>(&s)
            .map(|f| f.sessions)
            .map_err(|e| SessionsError::Corrupt(e.to_string())),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(e.into()),
    }
}

fn write(dir: &Path, sessions: Vec<Session>) -> Result<(), SessionsError> {
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(&File { sessions })
        .map_err(|e| SessionsError::Corrupt(e.to_string()))?;
    let tmp = dir.join("sessions.json.tmp");
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join("sessions.json"))?;
    Ok(())
}

fn locked<T>(f: impl FnOnce() -> Result<T, SessionsError>) -> Result<T, SessionsError> {
    let _guard = LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    f()
}

/// Newest first.
///
/// # Errors
/// When the file cannot be read or is damaged.
pub fn list_in(dir: &Path) -> Result<Vec<Session>, SessionsError> {
    let mut all = locked(|| read(dir))?;
    all.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(all)
}

/// # Errors
/// When the id is unknown or the file cannot be read.
pub fn get_in(dir: &Path, id: &str) -> Result<Session, SessionsError> {
    list_in(dir)?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or(SessionsError::NotFound)
}

/// Adds the session, or bumps `updated_at` on one that exists (its title is kept).
///
/// # Errors
/// On a bad id or title, or a file failure.
pub fn upsert_in(
    dir: &Path,
    id: &str,
    title: &str,
    department: &str,
    driver: DriverKind,
) -> Result<Session, SessionsError> {
    if !valid_id(id) {
        return Err(SessionsError::BadId);
    }
    let title = clean_title(title)?;
    locked(|| {
        let mut all = read(dir)?;
        let at = now();
        let session = if let Some(s) = all.iter_mut().find(|s| s.id == id) {
            s.updated_at = at;
            s.clone()
        } else {
            let s = Session {
                id: id.into(),
                title,
                department: department.into(),
                driver,
                created_at: at,
                updated_at: at,
            };
            all.push(s.clone());
            s
        };
        write(dir, all)?;
        Ok(session)
    })
}

/// # Errors
/// On a bad title, an unknown id, or a file failure.
pub fn rename_in(dir: &Path, id: &str, title: &str) -> Result<Session, SessionsError> {
    let title = clean_title(title)?;
    locked(|| {
        let mut all = read(dir)?;
        let s = all
            .iter_mut()
            .find(|s| s.id == id)
            .ok_or(SessionsError::NotFound)?;
        s.title = title;
        let out = s.clone();
        write(dir, all)?;
        Ok(out)
    })
}

/// # Errors
/// On an unknown id or a file failure.
pub fn delete_in(dir: &Path, id: &str) -> Result<(), SessionsError> {
    locked(|| {
        let mut all = read(dir)?;
        let before = all.len();
        all.retain(|s| s.id != id);
        if all.len() == before {
            return Err(SessionsError::NotFound);
        }
        write(dir, all)
    })
}

fn clean_title(title: &str) -> Result<String, SessionsError> {
    let t = title.split_whitespace().collect::<Vec<_>>().join(" ");
    let n = t.chars().count();
    if n == 0 || t.chars().any(char::is_control) {
        return Err(SessionsError::BadTitle);
    }
    Ok(if n > 120 {
        t.chars().take(120).collect()
    } else {
        t
    })
}

/// Called by chat when a run reports its session id.
///
/// # Errors
/// See [`upsert_in`].
pub fn touch(
    id: &str,
    title: &str,
    department: &str,
    driver: DriverKind,
) -> Result<Session, SessionsError> {
    upsert_in(&machine_dir()?, id, title, department, driver)
}

/// `list` — every session, newest first.
#[tauri::command]
fn list() -> Result<Vec<Session>, SessionsError> {
    list_in(&machine_dir()?)
}

/// `get` — one session.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn get(id: String) -> Result<Session, SessionsError> {
    get_in(&machine_dir()?, &id)
}

/// `rename` — change a session's title.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn rename(id: String, title: String) -> Result<Session, SessionsError> {
    rename_in(&machine_dir()?, &id, &title)
}

/// `remove` — forget a session (the CLI's own transcript is left alone).
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn remove(id: String) -> Result<(), SessionsError> {
    delete_in(&machine_dir()?, &id)
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("sessions")
        .invoke_handler(tauri::generate_handler![list, get, rename, remove])
        .build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
