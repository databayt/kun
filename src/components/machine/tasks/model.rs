//! The wire shapes of the task API in `src/lib/machine/contract.ts`, mirrored with serde in
//! camelCase, plus the gate's verdict. Keep them in step with the contract.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "tasks/types.ts")]
pub enum TaskStatus {
    #[serde(rename = "todo")]
    Todo,
    #[serde(rename = "in-progress")]
    InProgress,
    #[serde(rename = "review")]
    Review,
    #[serde(rename = "done")]
    Done,
}

/// The parsed `<!-- kun: repos=…; items=…; after=… -->` block of an issue.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "tasks/types.ts")]
pub struct KunBlock {
    pub repos: Vec<String>,
    pub items: Vec<String>,
    pub after: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "tasks/types.ts")]
pub struct Task {
    /// `databayt/<repo>#<number>`
    pub id: String,
    pub repo: String,
    pub number: u32,
    pub title: String,
    pub url: String,
    pub department: String,
    pub status: TaskStatus,
    /// The kun login holding it, from the `holder:<login>` label.
    pub holder: Option<String>,
    pub priority: Option<u8>,
    pub sprint: Option<String>,
    pub order: u32,
    #[serde(default)]
    pub kun: KunBlock,
    /// The `after` ids still open: non-empty means blocked.
    #[serde(default)]
    pub after_open: Vec<String>,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "tasks/types.ts")]
pub struct Sprint {
    pub title: String,
    pub goal: Option<String>,
    pub ends_at: Option<String>,
}

/// GET `/api/machine/tasks?department=<d>`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "tasks/types.ts")]
pub struct TasksResponse {
    pub sprint: Option<Sprint>,
    /// Held by or queued for this login, in queue order.
    pub mine: Vec<Task>,
    /// Every open task of the department, in queue order.
    pub board: Vec<Task>,
    /// Tasks this login holds in progress across all departments.
    pub in_progress: u32,
    pub wip_limit: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "tasks/types.ts")]
pub enum ReadyState {
    /// Start it.
    Ready,
    /// Something to fetch first: a repo to clone or pull, an item to install.
    Missing,
    /// Not yours to start yet: waiting on another task, held, WIP full, or outside the profile.
    Blocked,
}

/// What the gate says about one task.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "tasks/types.ts")]
pub struct Readiness {
    pub state: ReadyState,
    /// Why, as `repo:<name>`, `behind:<name>`, `item:<id>`, `after:<id>`, `held:<login>`,
    /// `wip`, `profile:<name>`.
    pub missing: Vec<String>,
}

/// The answer of `tasks(department)`: the server's response plus a verdict per task id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TasksView {
    #[serde(flatten)]
    pub tasks: TasksResponse,
    pub readiness: std::collections::BTreeMap<String, Readiness>,
}
