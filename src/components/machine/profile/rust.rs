//! profile — what this machine is allowed to do.
//!
//! `machines/<login>.json` in the kun checkout describes one teammate's machine: departments,
//! repos, access level and the secret names they may store. `current()` loads the file for the
//! login saved in settings. No login or no file means the full-access default, so the
//! founder's own machine behaves as it always did. A file that exists but cannot be read is an
//! error, never silently full access.
//!
//! This is configuration, not a wall: the person administers their own laptop. The boundary is
//! that they only receive what the profile lists. Secrets live in the OS credential store and
//! never travel to JS: `set_secret` takes a value in, nothing returns one.

use std::{fs, io, path::Path};

use serde::{Deserialize, Serialize};
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use ts_rs::TS;

use crate::{
    driver::DriverKind,
    pack::{self, PackError, QuickAction},
    settings::{self, SettingsError},
};

/// Whether a run may change the repos.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum CodeAccess {
    Read,
    Write,
}

/// Whether a run may write in its workspace's `work/` folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceAccess {
    Write,
    None,
}

/// Which catalog items the machine may list and install.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum CatalogAccess {
    All,
    Profile,
}

/// The access level of a machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "profile/types.ts")]
pub struct Access {
    #[ts(inline)]
    pub code: CodeAccess,
    #[ts(inline)]
    pub workspace: WorkspaceAccess,
    #[ts(inline)]
    pub catalog: CatalogAccess,
    pub engine: bool,
}

impl Access {
    /// Everything: the founder's machine, and any machine without a profile.
    pub const FULL: Self = Self { code: CodeAccess::Write, workspace: WorkspaceAccess::Write, catalog: CatalogAccess::All, engine: true };
    /// What a profile that omits `access` gets: the least it can.
    const LEAST: Self = Self { code: CodeAccess::Read, workspace: WorkspaceAccess::Write, catalog: CatalogAccess::Profile, engine: false };
}

/// One skill a department offers, from its SKILL.md frontmatter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "profile/types.ts")]
pub struct SkillRef {
    pub name: String,
    pub title: String,
    pub description: String,
}

/// A department the machine works in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "profile/types.ts")]
pub struct Department {
    pub name: String,
    pub title: String,
    pub title_ar: Option<String>,
    pub quick_actions: Vec<QuickAction>,
    pub skills: Vec<SkillRef>,
}

/// What the UI knows about this machine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "profile/types.ts")]
pub struct MachineProfile {
    pub login: String,
    pub name: String,
    pub os: String,
    pub driver: DriverKind,
    pub departments: Vec<Department>,
    pub repos: Vec<String>,
    pub access: Access,
    /// Catalog ids this machine never sees, even inside its packs (e.g. `skill:edit` on a machine
    /// where that lane is Mac-only). Filtered from the menu, the catalog and the workspace.
    pub hidden: Vec<String>,
}

/// A loaded profile plus what the UI never sees.
#[derive(Debug, Clone)]
pub struct Resolved {
    pub profile: MachineProfile,
    /// Secret names this machine may store.
    pub secrets: Vec<String>,
    /// The profile fixes the driver; the person cannot pick another.
    pub driver_locked: bool,
    /// A `machines/<login>.json` was found (false for the full-access default).
    pub explicit: bool,
}

#[derive(Debug, Deserialize)]
#[serde(default)]
struct RawAccess {
    code: CodeAccess,
    workspace: WorkspaceAccess,
    catalog: CatalogAccess,
    engine: bool,
}

impl Default for RawAccess {
    fn default() -> Self {
        let a = Access::LEAST;
        Self { code: a.code, workspace: a.workspace, catalog: a.catalog, engine: a.engine }
    }
}

#[derive(Debug, Deserialize)]
struct RawProfile {
    login: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    os: String,
    #[serde(default)]
    driver: Option<DriverKind>,
    #[serde(default)]
    departments: Vec<String>,
    #[serde(default)]
    repos: Vec<String>,
    #[serde(default)]
    access: RawAccess,
    #[serde(default)]
    secrets: Vec<String>,
    #[serde(default)]
    hidden: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ProfileError {
    #[error("login must be lowercase letters, digits and -")]
    BadLogin,
    #[error("profile `{0}` is damaged: {1}")]
    Corrupt(String, String),
    #[error("`{0}` is not a secret this machine may store")]
    NotAllowed(String),
    #[error("secret value is empty, too long or has control characters")]
    BadValue,
    #[error("credential store: {0}")]
    Store(String),
    #[error(transparent)]
    Settings(#[from] SettingsError),
    #[error(transparent)]
    Pack(#[from] PackError),
}

impl Serialize for ProfileError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// A login: lowercase letters, digits and `-`, 1 to 32 characters.
#[must_use]
pub fn valid_login(s: &str) -> bool {
    !s.is_empty() && s.len() <= 32 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn valid_secret_name(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
}

/// A SKILL.md's `name` and `description`; the folder name stands in for a missing `name`.
fn skill_ref(kun: &Path, name: &str) -> Option<SkillRef> {
    let text = fs::read_to_string(kun.join(".claude/skills").join(name).join("SKILL.md")).ok()?;
    let block = text.strip_prefix("---")?;
    let block = &block[..block.find("\n---")?];
    let get = |key: &str| {
        block.lines().find_map(|l| {
            let (k, v) = l.split_once(':')?;
            (k.trim() == key).then(|| v.trim().trim_matches(['"', '\'']).to_owned())
        })
    };
    Some(SkillRef { name: name.to_owned(), title: get("name").unwrap_or_else(|| name.to_owned()), description: get("description").unwrap_or_default() })
}

/// A catalog id: `<type>:<name>`, lowercase.
fn valid_id(s: &str) -> bool {
    s.split_once(':').is_some_and(|(t, n)| {
        !t.is_empty() && t.chars().all(|c| c.is_ascii_lowercase()) && pack::valid_name(n)
    })
}

fn department(kun: &Path, name: &str, hidden: &[String]) -> Result<Department, PackError> {
    let meta = pack::meta_in(kun, name)?;
    Ok(Department {
        name: name.to_owned(),
        title: meta.title_en.unwrap_or_else(|| name.to_owned()),
        title_ar: meta.title_ar,
        quick_actions: meta.quick_actions,
        skills: meta
            .skills
            .iter()
            .filter(|s| !hidden.contains(&format!("skill:{s}")))
            .filter_map(|s| skill_ref(kun, s))
            .collect(),
    })
}

fn default_os() -> String {
    std::env::consts::OS.to_owned()
}

/// Loads the profile for `login` from `<kun>/machines/`. No login or no file gives the full-access
/// default over every department that ships a pack.
///
/// # Errors
/// On an invalid login, or a profile file that exists but is damaged or names unsafe values.
pub fn resolve_in(kun: &Path, login: &str, fallback_driver: DriverKind) -> Result<Resolved, ProfileError> {
    let default = || -> Result<Resolved, ProfileError> {
        let departments = pack::departments_in(kun).iter().map(|d| department(kun, d, &[])).collect::<Result<Vec<_>, _>>()?;
        Ok(Resolved {
            profile: MachineProfile {
                login: login.to_owned(),
                name: String::new(),
                os: default_os(),
                driver: fallback_driver,
                departments,
                repos: Vec::new(),
                access: Access::FULL,
                hidden: Vec::new(),
            },
            secrets: Vec::new(),
            driver_locked: false,
            explicit: false,
        })
    };
    if login.is_empty() {
        return default();
    }
    if !valid_login(login) {
        return Err(ProfileError::BadLogin);
    }
    let corrupt = |why: String| ProfileError::Corrupt(login.to_owned(), why);
    let text = match fs::read_to_string(kun.join("machines").join(format!("{login}.json"))) {
        Ok(t) => t,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return default(),
        Err(e) => return Err(corrupt(e.to_string())),
    };
    let raw: RawProfile = serde_json::from_str(&text).map_err(|e| corrupt(e.to_string()))?;
    if raw.login != login {
        return Err(corrupt(format!("login field is `{}`", raw.login)));
    }
    if let Some(bad) = raw.departments.iter().chain(&raw.repos).find(|n| !pack::valid_name(n)) {
        return Err(corrupt(format!("unsafe name `{bad}`")));
    }
    if let Some(bad) = raw.secrets.iter().find(|n| !valid_secret_name(n)) {
        return Err(corrupt(format!("bad secret name `{bad}`")));
    }
    if let Some(bad) = raw.hidden.iter().find(|n| !valid_id(n)) {
        return Err(corrupt(format!("bad hidden id `{bad}`")));
    }
    let departments = raw.departments.iter().map(|d| department(kun, d, &raw.hidden)).collect::<Result<Vec<_>, _>>()?;
    let a = raw.access;
    Ok(Resolved {
        profile: MachineProfile {
            login: raw.login,
            name: raw.name,
            os: if raw.os.is_empty() { default_os() } else { raw.os },
            driver: raw.driver.unwrap_or(fallback_driver),
            departments,
            repos: raw.repos,
            access: Access { code: a.code, workspace: a.workspace, catalog: a.catalog, engine: a.engine },
            hidden: raw.hidden,
        },
        secrets: raw.secrets,
        driver_locked: raw.driver.is_some(),
        explicit: true,
    })
}

/// The profile of the login saved in settings, from the local kun checkout.
///
/// # Errors
/// See [`resolve_in`]; also when settings cannot be read.
pub fn current() -> Result<Resolved, ProfileError> {
    let s = settings::load()?;
    resolve_in(&pack::kun_dir()?, &s.login, s.driver)
}

/// Where secrets live. The real one is the OS credential store; tests use memory.
pub trait SecretStore {
    /// # Errors
    /// When the store refuses the write.
    fn set(&self, account: &str, value: &str) -> Result<(), String>;
    /// # Errors
    /// When the store cannot be read (a missing entry is `Ok(None)`).
    fn get(&self, account: &str) -> Result<Option<String>, String>;
}

/// macOS Keychain, Windows Credential Manager.
pub struct OsStore;

const SERVICE: &str = "org.databayt.kun.machine";

impl SecretStore for OsStore {
    fn set(&self, account: &str, value: &str) -> Result<(), String> {
        keyring::Entry::new(SERVICE, account).and_then(|e| e.set_password(value)).map_err(|e| e.to_string())
    }

    fn get(&self, account: &str) -> Result<Option<String>, String> {
        match keyring::Entry::new(SERVICE, account).and_then(|e| e.get_password()) {
            Ok(v) => Ok(Some(v)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}

fn account(resolved: &Resolved, name: &str) -> String {
    format!("{}/{name}", resolved.profile.login)
}

fn allowed(resolved: &Resolved, name: &str) -> Result<(), ProfileError> {
    if resolved.secrets.iter().any(|s| s == name) { Ok(()) } else { Err(ProfileError::NotAllowed(name.to_owned())) }
}

/// Stores a secret the profile lists. The value is trimmed (a pasted trailing newline breaks keys).
///
/// # Errors
/// When the name is not in the profile, the value is empty, too long or has control characters, or the store fails.
pub fn store_secret(store: &impl SecretStore, resolved: &Resolved, name: &str, value: &str) -> Result<(), ProfileError> {
    allowed(resolved, name)?;
    let value = value.trim();
    if value.is_empty() || value.len() > 8192 || value.chars().any(char::is_control) {
        return Err(ProfileError::BadValue);
    }
    store.set(&account(resolved, name), value).map_err(ProfileError::Store)
}

/// Whether a secret the profile lists is stored. Never returns the value.
///
/// # Errors
/// When the name is not in the profile or the store cannot be read.
pub fn secret_present(store: &impl SecretStore, resolved: &Resolved, name: &str) -> Result<bool, ProfileError> {
    allowed(resolved, name)?;
    Ok(store.get(&account(resolved, name)).map_err(ProfileError::Store)?.is_some())
}

/// Every stored secret of the profile as `(NAME, value)`, for the environment of one run.
///
/// # Errors
/// When the store cannot be read.
pub fn secret_env(store: &impl SecretStore, resolved: &Resolved) -> Result<Vec<(String, String)>, ProfileError> {
    let mut env = Vec::new();
    for name in &resolved.secrets {
        if let Some(v) = store.get(&account(resolved, name)).map_err(ProfileError::Store)? {
            env.push((name.clone(), v));
        }
    }
    Ok(env)
}

/// `profile` — this machine's profile (the full-access default when there is none).
#[tauri::command]
fn profile() -> Result<MachineProfile, ProfileError> {
    current().map(|r| r.profile)
}

/// `set_secret` — stores a secret the profile lists in the OS credential store.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn set_secret(name: String, value: String) -> Result<(), ProfileError> {
    store_secret(&OsStore, &current()?, &name, &value)
}

/// `has_secret` — whether a listed secret is stored. The value never leaves Rust.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn has_secret(name: String) -> Result<bool, ProfileError> {
    secret_present(&OsStore, &current()?, &name)
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("profile").invoke_handler(tauri::generate_handler![profile, set_secret, has_secret]).build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
