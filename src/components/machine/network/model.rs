//! The wire shapes of `src/lib/machine/contract.ts` (health, heartbeat, messages, team), mirrored
//! with serde in camelCase. Keep them in step with the contract.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// One thing the machine checked.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "network/types.ts")]
pub struct HealthItem {
    /// `driver`, `catalog`, `repo:<name>`, `workspace`, `disk`, `kun`, `sprint`.
    pub key: String,
    pub ok: bool,
    pub detail: String,
    /// True when the machine fixed it itself on this check.
    pub healed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "network/types.ts")]
pub struct HealthReport {
    pub checked_at: String,
    pub items: Vec<HealthItem>,
}

/// Whether a clone is kept or swept when its sprint ends.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "network/types.ts")]
pub enum RepoMode {
    #[default]
    Keep,
    Sprint,
}

/// A clone on this computer, as the heartbeat reports it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "network/types.ts")]
pub struct LocalRepo {
    pub name: String,
    pub mode: RepoMode,
    pub branch: String,
    pub behind: u32,
    pub ahead: u32,
    pub dirty: bool,
}

/// POST `/api/machine/heartbeat`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Heartbeat {
    pub app_version: String,
    pub os: String,
    pub health: HealthReport,
    pub repos: Vec<LocalRepo>,
    pub current_task: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatResponse {
    #[serde(default)]
    pub unread: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "network/types.ts")]
pub enum MessageKind {
    Note,
    Job,
    Nudge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "network/types.ts")]
pub struct MessageBody {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "network/types.ts")]
pub struct MachineMessage {
    pub id: String,
    pub from: String,
    pub to: String,
    pub kind: MessageKind,
    pub body: MessageBody,
    pub created_at: String,
    pub read_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "network/types.ts")]
pub struct MessagesResponse {
    pub messages: Vec<MachineMessage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "network/types.ts")]
pub struct MachineStatus {
    pub login: String,
    pub name: String,
    pub os: String,
    pub departments: Vec<String>,
    pub last_seen_at: Option<String>,
    pub health_ok: Option<bool>,
    pub current_task: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "network/types.ts")]
pub struct TeamResponse {
    pub machines: Vec<MachineStatus>,
}

/// POST `/api/machine/messages`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingMessage<'a> {
    pub to: &'a str,
    pub kind: MessageKind,
    pub body: MessageBody,
}
