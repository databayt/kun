//! pack — builds the working folder a department's agent runs in.
//!
//! `~/.kun/machine/<dept>/` holds a `CLAUDE.md` and `AGENTS.md` generated from the
//! department's `prompt.md` (plus a pointer to kun's own rules), and the pack's skills
//! symlinked in, so every run starts with the right context and nothing else. The folder
//! is rebuilt from kun's checkout on every call, so it is idempotent and never drifts.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use ts_rs::TS;

use crate::driver::DriverKind;

#[derive(Debug, thiserror::Error)]
pub enum PackError {
    #[error("department name is invalid")]
    BadName,
    #[error("could not find the home folder")]
    NoHome,
    #[error("no pack for `{0}` (expected {1})")]
    Missing(String, String),
    #[error("{0}: {1}")]
    Io(String, io::Error),
}

impl Serialize for PackError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

fn io_err(path: &Path) -> impl FnOnce(io::Error) -> PackError + '_ {
    move |e| PackError::Io(path.display().to_string(), e)
}

/// A one-tap prompt shown under the greeting.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "pack/types.ts")]
pub struct QuickAction {
    pub label_ar: String,
    pub label_en: String,
    pub prompt: String,
}

/// What the UI shows about a department's pack.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "pack/types.ts")]
pub struct PackInfo {
    pub department: String,
    pub title_ar: String,
    pub title_en: String,
    pub default_driver: Option<DriverKind>,
    pub quick_actions: Vec<QuickAction>,
}

#[derive(Debug, Default, Deserialize)]
struct RawQuick {
    #[serde(default)]
    label_ar: String,
    #[serde(default)]
    label_en: String,
    #[serde(default)]
    prompt: String,
}

#[derive(Debug, Default, Deserialize)]
struct RawPack {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    title: Value,
    #[serde(default)]
    items: Vec<Value>,
    #[serde(default, rename = "defaultDriver")]
    default_driver: Option<DriverKind>,
    #[serde(default, rename = "quickActions")]
    quick_actions: Vec<RawQuick>,
}

/// A department or skill name: lowercase-ish, no separators, no dots at the start.
#[must_use]
pub fn valid_name(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && !s.starts_with(['.', '-'])
        && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        && !s.contains("..")
}

/// kun's checkout: `KUN_DIR`, else `~/kun`.
///
/// # Errors
/// When there is no home folder and no override.
pub fn kun_dir() -> Result<PathBuf, PackError> {
    match std::env::var_os("KUN_DIR") {
        Some(p) if !p.is_empty() => Ok(PathBuf::from(p)),
        _ => dirs::home_dir().map(|h| h.join("kun")).ok_or(PackError::NoHome),
    }
}

/// machine's own folder: `KUN_HOME` (else `~/.kun`) + `/machine`.
///
/// # Errors
/// When there is no home folder and no override.
pub fn machine_dir() -> Result<PathBuf, PackError> {
    match std::env::var_os("KUN_HOME") {
        Some(p) if !p.is_empty() => Ok(PathBuf::from(p).join("machine")),
        _ => dirs::home_dir().map(|h| h.join(".kun/machine")).ok_or(PackError::NoHome),
    }
}

fn write_if_changed(path: &Path, content: &str) -> Result<(), PackError> {
    if fs::read_to_string(path).is_ok_and(|old| old == content) {
        return Ok(());
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(io_err(&tmp))?;
    fs::rename(&tmp, path).map_err(io_err(path))
}

#[cfg(unix)]
fn symlink(target: &Path, link: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}
#[cfg(windows)]
fn symlink(target: &Path, link: &Path) -> io::Result<()> {
    std::os::windows::fs::symlink_dir(target, link)
}

/// Makes `dest/<name>` point at `src/<name>` for every wanted name that exists, and removes
/// our own stale links (symlinks into `src` that are no longer wanted). Real files are never touched.
fn link_skills(src: &Path, dest: &Path, wanted: &[String]) -> Result<(), PackError> {
    fs::create_dir_all(dest).map_err(io_err(dest))?;
    for name in wanted {
        let target = src.join(name);
        if !target.exists() {
            continue;
        }
        let link = dest.join(name);
        match fs::symlink_metadata(&link) {
            Ok(m) if m.file_type().is_symlink() => {
                if fs::read_link(&link).is_ok_and(|t| t == target) {
                    continue;
                }
                fs::remove_file(&link).map_err(io_err(&link))?;
            }
            Ok(_) => continue,
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(io_err(&link)(e)),
        }
        symlink(&target, &link).map_err(io_err(&link))?;
    }
    for entry in fs::read_dir(dest).map_err(io_err(dest))?.flatten() {
        let path = entry.path();
        let ours = fs::read_link(&path).is_ok_and(|t| t.starts_with(src));
        let keep = wanted.iter().any(|w| path.file_name().is_some_and(|n| n == w.as_str()));
        if ours && !keep {
            fs::remove_file(&path).map_err(io_err(&path))?;
        }
    }
    Ok(())
}

/// Skill names an `items` list asks for: the catalog id `"skill:edit"`, `"skills/edit"`,
/// `"edit"` or `{"name": "edit"}`. Other catalog types (`"agent:lead"`) are not skills.
fn item_names(items: &[Value]) -> Vec<String> {
    items
        .iter()
        .filter_map(|v| match v {
            Value::String(s) => match s.split_once(':') {
                Some(("skill", name)) => Some(name.to_owned()),
                Some(_) => None,
                None => s.rsplit('/').next().map(str::to_owned),
            },
            Value::Object(o) => o.get("name").and_then(Value::as_str).map(str::to_owned),
            _ => None,
        })
        .filter(|n| valid_name(n))
        .collect()
}

fn read_pack(kun: &Path, dept: &str) -> RawPack {
    fs::read_to_string(kun.join("departments").join(dept).join("pack.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Builds (or refreshes) `<machine>/<dept>/` from `<kun>/departments/<dept>/`.
///
/// # Errors
/// On a bad name, a department without a `prompt.md`, or a filesystem failure.
pub fn ensure_in(kun: &Path, machine: &Path, dept: &str) -> Result<PathBuf, PackError> {
    if !valid_name(dept) {
        return Err(PackError::BadName);
    }
    let prompt_path = kun.join("departments").join(dept).join("prompt.md");
    let prompt = fs::read_to_string(&prompt_path)
        .map_err(|_| PackError::Missing(dept.to_owned(), prompt_path.display().to_string()))?;
    let dir = machine.join(dept);
    fs::create_dir_all(&dir).map_err(io_err(&dir))?;

    let rules = kun.join("CLAUDE.md");
    let body = prompt.trim_end();
    write_if_changed(&dir.join("CLAUDE.md"), &format!("{body}\n\n---\n\n@{}\n", rules.display()))?;
    write_if_changed(
        &dir.join("AGENTS.md"),
        &format!("{body}\n\n---\n\nCompany rules: read {} before you start.\n", rules.display()),
    )?;

    let wanted = item_names(&read_pack(kun, dept).items);
    link_skills(&kun.join(".claude/skills"), &dir.join(".claude/skills"), &wanted)?;
    let agents = kun.join(".agents/skills");
    if agents.is_dir() {
        link_skills(&agents, &dir.join(".agents/skills"), &wanted)?;
    }
    Ok(dir)
}

/// The department's working folder, built on demand. Chat runs every job in it.
///
/// # Errors
/// See [`ensure_in`].
pub fn workdir(dept: &str) -> Result<PathBuf, PackError> {
    ensure_in(&kun_dir()?, &machine_dir()?, dept)
}

/// A department's pack as the UI needs it. A missing `pack.json` gives an empty pack.
///
/// # Errors
/// On a bad name.
pub fn info_in(kun: &Path, dept: &str) -> Result<PackInfo, PackError> {
    if !valid_name(dept) {
        return Err(PackError::BadName);
    }
    let raw = read_pack(kun, dept);
    let pick = |key: &str| match &raw.title {
        Value::String(s) => Some(s.clone()),
        Value::Object(o) => o.get(key).and_then(Value::as_str).map(str::to_owned),
        _ => None,
    };
    let fallback = raw.name.clone().unwrap_or_else(|| dept.to_owned());
    Ok(PackInfo {
        department: dept.to_owned(),
        title_ar: pick("ar").unwrap_or_else(|| fallback.clone()),
        title_en: pick("en").unwrap_or(fallback),
        default_driver: raw.default_driver,
        quick_actions: raw
            .quick_actions
            .into_iter()
            .filter(|q| !q.prompt.trim().is_empty())
            .map(|q| QuickAction { label_ar: q.label_ar, label_en: q.label_en, prompt: q.prompt })
            .collect(),
    })
}

/// Departments that ship a pack in this kun checkout, sorted. A missing `departments/` is empty.
#[must_use]
pub fn departments_in(kun: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(kun.join("departments"))
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().join("prompt.md").is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| valid_name(n))
        .collect();
    names.sort();
    names
}

/// `departments` — which department packs exist.
#[tauri::command]
fn departments() -> Result<Vec<String>, PackError> {
    Ok(departments_in(&kun_dir()?))
}

/// `info` — one department's title and quick actions.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn info(department: String) -> Result<PackInfo, PackError> {
    info_in(&kun_dir()?, &department)
}

/// `prepare` — builds the working folder and returns its path.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn prepare(department: String) -> Result<String, PackError> {
    workdir(&department).map(|p| p.display().to_string())
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("pack").invoke_handler(tauri::generate_handler![departments, info, prepare]).build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
