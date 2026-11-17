//! repos — the types: what the UI lists, what the state file keeps, and why a removal is refused.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// How long a clone stays on this computer.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "repos/types.ts")]
pub enum RepoMode {
    /// Stays until the person removes it.
    #[default]
    Keep,
    /// Removed once its sprint has ended, but only when nothing would be lost.
    Sprint,
}

/// One repo's line in `~/Kun/repos/.kun-repos.json`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "repos/types.ts")]
pub struct RepoEntry {
    pub mode: RepoMode,
    /// The sprint the clone belongs to; only meaningful in `sprint` mode.
    pub sprint: Option<String>,
    /// Unix seconds.
    #[ts(type = "number")]
    pub added_at: u64,
}

/// A clone on this computer, as read from git. Mirrors `LocalRepo` in `src/lib/machine/contract.ts`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "repos/types.ts")]
pub struct LocalRepo {
    pub name: String,
    pub mode: RepoMode,
    pub sprint: Option<String>,
    pub branch: String,
    pub behind: u32,
    pub ahead: u32,
    pub dirty: bool,
}

/// What the TS side passes in from kun's API (`OrgRepo` in the contract); extra fields are ignored.
#[derive(Debug, Clone, Default, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "repos/types.ts")]
pub struct OrgRepoArg {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub private: bool,
}

/// One row of the repos page: an org (or profile) repo merged with what is on disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "repos/types.ts")]
pub struct RepoRow {
    pub name: String,
    pub description: Option<String>,
    pub private: bool,
    pub local: bool,
    /// `None` while the repo is not cloned.
    pub mode: Option<RepoMode>,
    pub sprint: Option<String>,
    pub branch: String,
    pub behind: u32,
    pub ahead: u32,
    pub dirty: bool,
}

/// Something removing the clone would throw away.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "repos/types.ts")]
pub enum LossKind {
    /// Tracked files with uncommitted changes.
    Dirty,
    /// Files git does not track yet.
    Untracked,
    /// Commits on a local branch that no remote has.
    Unpushed,
    /// Entries in `git stash`.
    Stash,
}

/// A kind of loss and how many things it covers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "repos/types.ts")]
pub struct Loss {
    pub kind: LossKind,
    pub count: u32,
}

/// What `sweep_sprint` did.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "repos/types.ts")]
pub struct SweepReport {
    pub removed: Vec<String>,
    /// Ended-sprint repos left in place because removing them would lose work.
    pub kept: Vec<String>,
}

/// What a command rejects with. Serializes as `{ code, message, losses }` so the page can list
/// exactly what a refused removal would have lost.
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("repo name is invalid: {0}")]
    BadName(String),
    #[error("not a databayt https URL: {0}")]
    BadRemote(String),
    #[error("{0} is not cloned")]
    NotCloned(String),
    #[error("{0} is already cloned")]
    AlreadyCloned(String),
    #[error("could not find the home folder")]
    NoHome,
    #[error("remove refused: it would lose work in {name}")]
    Refused { name: String, losses: Vec<Loss> },
    #[error("git: {0}")]
    Git(String),
    #[error("{0}: {1}")]
    Io(String, std::io::Error),
    #[error("{0}")]
    Profile(String),
}

/// The serialized form of a [`RepoError`].
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "repos/types.ts")]
pub struct RepoFailure {
    pub code: String,
    pub message: String,
    pub losses: Vec<Loss>,
}

impl RepoError {
    fn code(&self) -> &'static str {
        match self {
            Self::BadName(_) => "bad_name",
            Self::BadRemote(_) => "bad_remote",
            Self::NotCloned(_) => "not_cloned",
            Self::AlreadyCloned(_) => "already_cloned",
            Self::NoHome => "no_home",
            Self::Refused { .. } => "refused",
            Self::Git(_) => "git",
            Self::Io(..) => "io",
            Self::Profile(_) => "profile",
        }
    }

    /// The wire form.
    #[must_use]
    pub fn failure(&self) -> RepoFailure {
        RepoFailure {
            code: self.code().to_owned(),
            message: self.to_string(),
            losses: match self {
                Self::Refused { losses, .. } => losses.clone(),
                _ => Vec::new(),
            },
        }
    }
}

impl Serialize for RepoError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        self.failure().serialize(s)
    }
}

/// The io error mapper: `.map_err(io_err(path))`.
pub(crate) fn io_err(path: &std::path::Path) -> impl FnOnce(std::io::Error) -> RepoError + '_ {
    move |e| RepoError::Io(path.display().to_string(), e)
}
