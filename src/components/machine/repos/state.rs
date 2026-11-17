//! The state file, `~/Kun/repos/.kun-repos.json`: `{ name → { mode, sprint, addedAt } }`.

use std::{
    collections::BTreeMap,
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use super::model::{RepoEntry, RepoError, RepoMode, io_err};

pub(super) const STATE_FILE: &str = ".kun-repos.json";

pub(super) type State = BTreeMap<String, RepoEntry>;

/// Reads the state; a missing or unreadable file is an empty state, never an error.
pub(super) fn load(root: &Path) -> State {
    fs::read_to_string(root.join(STATE_FILE))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Writes the state atomically (temp file, then rename).
pub(super) fn save(root: &Path, state: &State) -> Result<(), RepoError> {
    fs::create_dir_all(root).map_err(io_err(root))?;
    let tmp = root.join(format!("{STATE_FILE}.tmp"));
    let mut text = serde_json::to_string_pretty(state).unwrap_or_else(|_| "{}".into());
    text.push('\n');
    fs::write(&tmp, text).map_err(io_err(&tmp))?;
    fs::rename(&tmp, root.join(STATE_FILE)).map_err(io_err(root))
}

pub(super) fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// Records a repo as `keep` unless it is already known.
pub(super) fn ensure(root: &Path, name: &str) -> Result<(), RepoError> {
    let mut state = load(root);
    if !state.contains_key(name) {
        state.insert(
            name.to_owned(),
            RepoEntry {
                mode: RepoMode::Keep,
                sprint: None,
                added_at: now(),
            },
        );
        save(root, &state)?;
    }
    Ok(())
}
