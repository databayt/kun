//! settings — who the teammate is, their machine login, department and agent CLI.
//! Stored in `~/.kun/machine/settings.json` (`KUN_HOME` overrides the base for tests).

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use ts_rs::TS;

use crate::driver::{self, DriverKind, DriverStatus};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "settings/types.ts")]
pub struct Settings {
    pub person: String,
    pub department: String,
    pub driver: DriverKind,
    /// The machine profile to load (`machines/<login>.json`); empty means full access.
    pub login: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            person: String::new(),
            department: "sales".into(),
            driver: DriverKind::Claude,
            login: String::new(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("name must be at most 80 characters, without control characters")]
    BadPerson,
    #[error("department name is invalid")]
    BadDepartment,
    #[error("login must be lowercase letters, digits and -")]
    BadLogin,
    #[error("could not find the home folder")]
    NoHome,
    #[error("settings.json is damaged ({0}); fix or delete it")]
    Corrupt(String),
    #[error("{0}")]
    Io(#[from] io::Error),
}

impl Serialize for SettingsError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl Settings {
    /// Trims the name and checks every field.
    ///
    /// # Errors
    /// When the name is too long or has control characters, or the department or login is unsafe.
    pub fn validated(mut self) -> Result<Self, SettingsError> {
        self.person = self.person.trim().to_owned();
        if self.person.chars().count() > 80 || self.person.chars().any(char::is_control) {
            return Err(SettingsError::BadPerson);
        }
        if !crate::pack::valid_name(&self.department) {
            return Err(SettingsError::BadDepartment);
        }
        self.login = self.login.trim().to_owned();
        if !self.login.is_empty() && !crate::profile::valid_login(&self.login) {
            return Err(SettingsError::BadLogin);
        }
        Ok(self)
    }
}

fn machine_dir() -> Result<PathBuf, SettingsError> {
    match std::env::var_os("KUN_HOME") {
        Some(p) if !p.is_empty() => Ok(PathBuf::from(p).join("machine")),
        _ => dirs::home_dir()
            .map(|h| h.join(".kun/machine"))
            .ok_or(SettingsError::NoHome),
    }
}

/// Defaults when the file does not exist yet.
///
/// # Errors
/// When the file cannot be read or is damaged.
pub fn load_in(dir: &Path) -> Result<Settings, SettingsError> {
    match fs::read_to_string(dir.join("settings.json")) {
        Ok(s) => serde_json::from_str(&s).map_err(|e| SettingsError::Corrupt(e.to_string())),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(e) => Err(e.into()),
    }
}

/// Validates, then writes atomically.
///
/// # Errors
/// On invalid fields or a file failure.
pub fn save_in(dir: &Path, settings: Settings) -> Result<Settings, SettingsError> {
    let settings = settings.validated()?;
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| SettingsError::Corrupt(e.to_string()))?;
    let tmp = dir.join("settings.json.tmp");
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join("settings.json"))?;
    Ok(settings)
}

/// The saved settings. Chat reads the default driver and department from here.
///
/// # Errors
/// See [`load_in`].
pub fn load() -> Result<Settings, SettingsError> {
    load_in(&machine_dir()?)
}

/// `load` — the saved settings, or defaults.
#[tauri::command]
fn load_settings() -> Result<Settings, SettingsError> {
    load()
}

/// `save` — validate and store.
#[tauri::command]
fn save(settings: Settings) -> Result<Settings, SettingsError> {
    save_in(&machine_dir()?, settings)
}

/// `detect` — which agent CLIs are installed here.
#[tauri::command]
fn detect() -> Vec<DriverStatus> {
    driver::detect()
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("settings")
        .invoke_handler(tauri::generate_handler![load_settings, save, detect])
        .build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
