//! network — this machine's link to kun.databayt.org: health check, self-heal, heartbeat.
//!
//! Machines never talk to each other; every machine talks to kun and GitHub. Every 10 minutes
//! (and at launch) the machine checks itself, fixes what is safe to fix (see `health.rs`), tells
//! kun in a heartbeat, and emits two events to the page: `network:health` (the report) and
//! `network:unread` (how many messages wait). No OS notification yet: that needs the notification
//! plugin registered in the shell, so for now the page decides what to show.
//!
//! The token is one bearer secret per kun login in the OS credential store; it never reaches JS.

use std::{
    sync::{Arc, LazyLock, Mutex, OnceLock, PoisonError},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{
    Emitter, Runtime,
    plugin::{Builder, TauriPlugin},
};

#[path = "api.rs"]
pub mod api;
#[path = "health.rs"]
pub mod health;
#[path = "host.rs"]
pub mod host;
#[path = "model.rs"]
pub mod model;
#[path = "token.rs"]
pub mod token;

use api::{Api, ApiError, HttpApi};
use host::{Host, RealHost};
use model::{
    HealthReport, Heartbeat, HeartbeatResponse, MessageBody, MessageKind, MessagesResponse,
    OutgoingMessage, TeamResponse,
};

/// How often the machine checks itself while the app runs.
const INTERVAL: Duration = Duration::from_secs(600);

#[derive(Debug, thiserror::Error)]
pub enum NetError {
    #[error(transparent)]
    Api(#[from] ApiError),
    #[error("{0}")]
    Invalid(&'static str),
    #[error("credential store: {0}")]
    Store(String),
    #[error("the check did not finish")]
    Join,
}

impl Serialize for NetError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// `databayt/<repo>#<number>`.
#[must_use]
pub fn valid_task_id(id: &str) -> bool {
    let Some((repo, number)) = id.strip_prefix("databayt/").and_then(|r| r.split_once('#')) else {
        return false;
    };
    !repo.is_empty()
        && repo.len() <= 100
        && repo
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '_' | '-'))
        && !number.is_empty()
        && number.len() <= 9
        && number.chars().all(|c| c.is_ascii_digit())
}

/// A kun login: lowercase letters, digits and `-`, 1 to 32 characters.
fn valid_to(s: &str) -> bool {
    crate::profile::valid_login(s)
}

/// RFC 3339 UTC time for a unix second (Howard Hinnant's civil-from-days).
#[must_use]
pub fn iso_from_unix(secs: u64) -> String {
    let days = i64::try_from(secs / 86_400).unwrap_or(0);
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let era_day = z.rem_euclid(146_097);
    let yoe = (era_day - era_day / 1460 + era_day / 36_524 - era_day / 146_096) / 365;
    let year_day = era_day - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * year_day + 2) / 153;
    let day = year_day - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

fn now_iso() -> String {
    iso_from_unix(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_secs()),
    )
}

/// What one pass produced: the report, and what the heartbeat answered.
#[derive(Debug)]
pub struct Cycle {
    pub report: HealthReport,
    pub unread: Result<u32, ApiError>,
}

/// One full pass: check and heal (blocking work on a thread), then the heartbeat.
///
/// # Errors
/// `Err(NetError::Join)` when the check thread panicked. A failed heartbeat is in `Cycle::unread`.
pub async fn sync_once<H: Host + 'static>(
    host: &Arc<H>,
    api: &impl Api,
    now: &str,
) -> Result<Cycle, NetError> {
    let (h, now_owned) = (Arc::clone(host), now.to_owned());
    let report = tokio::task::spawn_blocking(move || health::run_cycle(&*h, &now_owned))
        .await
        .map_err(|_| NetError::Join)?;
    let (h, repos_report) = (Arc::clone(host), report.clone());
    let (repos, current_task, os) =
        tokio::task::spawn_blocking(move || (h.repos(), h.current_task(), std::env::consts::OS))
            .await
            .map_err(|_| NetError::Join)?;
    let beat = Heartbeat {
        app_version: env!("CARGO_PKG_VERSION").to_owned(),
        os: os.to_owned(),
        health: repos_report,
        repos,
        current_task,
    };
    let unread = api::post_json::<HeartbeatResponse>(api, "/api/machine/heartbeat", &beat)
        .await
        .map(|r| r.unread);
    Ok(Cycle { report, unread })
}

type Emit = Box<dyn Fn(&str, serde_json::Value) + Send + Sync>;

static EMIT: OnceLock<Emit> = OnceLock::new();
static LAST: LazyLock<Mutex<Option<HealthReport>>> = LazyLock::new(|| Mutex::new(None));
/// One check at a time: the timer and `check_now` never overlap.
static RUNNING: LazyLock<tokio::sync::Mutex<()>> = LazyLock::new(|| tokio::sync::Mutex::new(()));

fn emit(event: &str, payload: serde_json::Value) {
    if let Some(f) = EMIT.get() {
        f(event, payload);
    }
}

/// Runs a pass against the real machine and publishes the result.
async fn run_real() -> Result<HealthReport, NetError> {
    let _one_at_a_time = RUNNING.lock().await;
    let host = Arc::new(RealHost);
    let api = HttpApi::from_process()?;
    let cycle = sync_once(&host, &api, &now_iso()).await?;
    match &cycle.unread {
        Ok(n) => emit("network:unread", serde_json::json!({ "count": n })),
        Err(ApiError::NoToken) => tracing::debug!("no machine token yet; heartbeat skipped"),
        Err(e) => tracing::warn!("heartbeat failed: {e}"),
    }
    *LAST.lock().unwrap_or_else(PoisonError::into_inner) = Some(cycle.report.clone());
    emit(
        "network:health",
        serde_json::to_value(&cycle.report).unwrap_or_default(),
    );
    Ok(cycle.report)
}

async fn background() {
    // Let the window come up first; the first pass starts a moment after launch.
    tokio::time::sleep(Duration::from_secs(5)).await;
    let mut tick = tokio::time::interval(INTERVAL);
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tick.tick().await;
        if let Err(e) = run_real().await {
            tracing::warn!("health pass failed: {e}");
        }
    }
}

/// `health` — the last report, or nothing before the first pass finishes.
#[tauri::command]
fn health() -> Option<HealthReport> {
    LAST.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

/// `check_now` — runs a pass now and returns its report.
#[tauri::command]
async fn check_now() -> Result<HealthReport, NetError> {
    run_real().await
}

/// `team` — every machine's status in a department.
#[tauri::command]
async fn team(department: String) -> Result<TeamResponse, NetError> {
    if !crate::pack::valid_name(&department) {
        return Err(NetError::Invalid("department name is invalid"));
    }
    let api = HttpApi::from_process()?;
    Ok(api::get_json(&api, &format!("/api/machine/team?department={department}")).await?)
}

/// `messages` — the inbox (unread first). Reading marks them read on the server.
#[tauri::command]
async fn messages() -> Result<MessagesResponse, NetError> {
    let api = HttpApi::from_process()?;
    let got: MessagesResponse = api::get_json(&api, "/api/machine/messages").await?;
    emit("network:unread", serde_json::json!({ "count": 0 }));
    Ok(got)
}

/// Checks and sends a message; pure over the transport, so it is tested with a mock.
///
/// # Errors
/// On a bad recipient, empty or oversized text, a bad task id, or a failed call.
pub async fn send_with(
    api: &impl Api,
    to: &str,
    kind: MessageKind,
    text: &str,
    task_id: Option<String>,
) -> Result<(), NetError> {
    let text = text.trim();
    if !valid_to(to) {
        return Err(NetError::Invalid("recipient must be a kun login"));
    }
    if text.is_empty() || text.chars().count() > 4000 {
        return Err(NetError::Invalid("message must be 1 to 4000 characters"));
    }
    if task_id.as_deref().is_some_and(|id| !valid_task_id(id)) {
        return Err(NetError::Invalid("task id is invalid"));
    }
    let msg = OutgoingMessage {
        to,
        kind,
        body: MessageBody {
            text: text.to_owned(),
            task_id,
        },
    };
    api::post_json::<serde_json::Value>(api, "/api/machine/messages", &msg).await?;
    Ok(())
}

/// `send_message` — a note, job or nudge to another login.
#[tauri::command]
async fn send_message(
    to: String,
    kind: MessageKind,
    text: String,
    task_id: Option<String>,
) -> Result<(), NetError> {
    send_with(&HttpApi::from_process()?, &to, kind, &text, task_id).await
}

/// `set_token` — stores the machine token in the OS credential store. Nothing returns it.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn set_token(token: String) -> Result<(), NetError> {
    token::save(&token).map_err(NetError::Store)
}

/// `has_token` — whether a machine token is stored.
#[tauri::command]
fn has_token() -> Result<bool, NetError> {
    Ok(token::load().map_err(NetError::Store)?.is_some())
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("network")
        .invoke_handler(tauri::generate_handler![
            health,
            check_now,
            team,
            messages,
            send_message,
            set_token,
            has_token
        ])
        .setup(|app, _api| {
            let handle = app.clone();
            let _ = EMIT.set(Box::new(move |event, payload| {
                if let Err(e) = handle.emit(event, payload) {
                    tracing::debug!("could not emit {event}: {e}");
                }
            }));
            tauri::async_runtime::spawn(background());
            Ok(())
        })
        .build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
