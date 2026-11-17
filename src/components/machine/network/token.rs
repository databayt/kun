//! The machine token: one bearer secret per kun login, kept in the OS credential store beside
//! the profile's secrets (same service) under its own account, so it is valid for every profile
//! and never reaches JS or a run's environment.

use crate::profile::{OsStore, SecretStore};

/// The account name the token lives under.
pub const SECRET_NAME: &str = "KUN_MACHINE_TOKEN";

fn login() -> String {
    crate::settings::load().map(|s| s.login).unwrap_or_default()
}

/// `<login>/KUN_MACHINE_TOKEN`; `_` stands in for a machine with no login.
fn account(login: &str) -> String {
    format!(
        "{}/{SECRET_NAME}",
        if login.is_empty() { "_" } else { login }
    )
}

/// A token is a single printable token with no spaces.
fn clean(token: &str) -> Result<String, String> {
    let t = token.trim();
    if t.is_empty() || t.len() > 512 || t.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("token is empty, too long or has spaces".to_owned());
    }
    Ok(t.to_owned())
}

/// Stores `token` for `login`.
///
/// # Errors
/// When the token is malformed or the store refuses it.
pub fn store(store: &impl SecretStore, login: &str, token: &str) -> Result<(), String> {
    store.set(&account(login), &clean(token)?)
}

/// Reads the token for `login`.
///
/// # Errors
/// When the store cannot be read.
pub fn read(store: &impl SecretStore, login: &str) -> Result<Option<String>, String> {
    store.get(&account(login))
}

/// The token of the login saved in settings; `KUN_MACHINE_TOKEN` in the environment wins (dev).
///
/// # Errors
/// When the store cannot be read.
pub fn load() -> Result<Option<String>, String> {
    if let Some(t) = std::env::var("KUN_MACHINE_TOKEN")
        .ok()
        .and_then(|t| clean(&t).ok())
    {
        return Ok(Some(t));
    }
    read(&OsStore, &login())
}

/// Stores the token for the login saved in settings.
///
/// # Errors
/// See [`store`].
pub fn save(token: &str) -> Result<(), String> {
    store(&OsStore, &login(), token)
}
