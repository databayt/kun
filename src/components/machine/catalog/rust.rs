//! catalog — browse, install and uninstall kun's skills, agents, rules, hooks and department packs.
//!
//! The registry (`public/r/kun/index.json`, built by `pnpm kun:registry`) lists items and the
//! sha256 of every file. Install never takes content from the webview: it copies from the local
//! kun checkout, verifies each file against the registry hash, and writes atomically into
//! `~/.claude`. What was installed is recorded in `~/.kun/machine/installed.json` so uninstall
//! removes exactly those files and nothing the teammate made themselves.

use std::{
    collections::{BTreeMap, BTreeSet},
    fmt::Write as _,
    fs,
    io::Write as _,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};
use ts_rs::TS;

use crate::profile::{CatalogAccess, MachineProfile};

/// Where an item stands on this computer.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "catalog/types.ts")]
pub enum ItemStatus {
    Installed,
    #[default]
    Available,
    Outdated,
}

/// One file of an item: its place in the kun repo, its place under `~/.claude`, its hash.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "catalog/types.ts")]
pub struct CatalogFile {
    pub path: String,
    pub target: String,
    pub sha256: String,
}

/// A registry item plus its status here. `id` is `<type>:<name>`, e.g. `skill:funnel`.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "catalog/types.ts")]
pub struct CatalogItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    /// Arabic title and description, when the source carries them (department packs do).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title_ar: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description_ar: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub files: Vec<CatalogFile>,
    pub version: String,
    #[serde(default)]
    pub status: ItemStatus,
    #[serde(default)]
    pub installed_version: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Registry {
    items: Vec<CatalogItem>,
}

/// One lockfile entry: what this item put on disk.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Installed {
    version: String,
    files: Vec<String>,
    #[serde(default)]
    dependencies: Vec<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Lock {
    #[serde(default)]
    items: BTreeMap<String, Installed>,
}

#[derive(Debug, thiserror::Error)]
pub enum CatalogError {
    #[error("invalid item name: use lowercase letters, digits, - and :")]
    InvalidName,
    #[error("no such item: {0}")]
    UnknownItem(String),
    #[error("registry not found at {0} — run `pnpm kun:registry` in the kun checkout")]
    NoRegistry(String),
    #[error("registry is stale for {0} — run `pnpm kun:registry`")]
    Stale(String),
    #[error("refused: {0} would leave ~/.claude")]
    Unsafe(String),
    #[error("{0} is required by installed {1}")]
    InUse(String, String),
    #[error("{0} is not part of this machine's profile")]
    OutsideProfile(String),
    #[error("profile: {0}")]
    Profile(String),
    #[error("{0}")]
    Io(String),
}

impl Serialize for CatalogError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for CatalogError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

type Res<T> = std::result::Result<T, CatalogError>;

/// The three folders everything happens in. Tests point them at tempdirs.
#[derive(Debug, Clone)]
pub struct Env {
    pub kun_dir: PathBuf,
    pub claude_dir: PathBuf,
    pub kun_home: PathBuf,
}

impl Env {
    /// `KUN_DIR` (default `~/kun`), `CLAUDE_DIR` (default `~/.claude`), `KUN_HOME` (default `~/.kun`).
    #[must_use]
    pub fn from_process() -> Self {
        let home = dirs::home_dir().unwrap_or_default();
        let pick = |var: &str, default: &str| {
            std::env::var_os(var).map_or_else(|| home.join(default), PathBuf::from)
        };
        Self {
            kun_dir: pick("KUN_DIR", "kun"),
            claude_dir: pick("CLAUDE_DIR", ".claude"),
            kun_home: pick("KUN_HOME", ".kun"),
        }
    }

    fn registry_path(&self) -> PathBuf {
        self.kun_dir.join("public/r/kun/index.json")
    }

    fn lock_path(&self) -> PathBuf {
        self.kun_home.join("machine/installed.json")
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .fold(String::new(), |mut s, b| {
            let _ = write!(s, "{b:02x}");
            s
        })
}

/// Item names are ids in IPC and the lockfile: `[a-z0-9-:]`, never empty.
fn validate_name(name: &str) -> Res<()> {
    let ok = !name.is_empty()
        && name.len() <= 80
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == ':');
    if ok {
        Ok(())
    } else {
        Err(CatalogError::InvalidName)
    }
}

/// A relative path made only of plain components: no `..`, no root, no prefix.
fn safe_rel(p: &str) -> Res<PathBuf> {
    let path = Path::new(p);
    let plain = path.components().count() > 0
        && path.components().all(|c| matches!(c, Component::Normal(_)));
    if plain {
        Ok(path.to_path_buf())
    } else {
        Err(CatalogError::Unsafe(p.to_string()))
    }
}

/// The destination, after resolving symlinks in its existing ancestors, must stay inside `root`.
fn ensure_within(root: &Path, dest: &Path) -> Res<()> {
    fs::create_dir_all(root)?;
    let root = root.canonicalize()?;
    let mut probe = dest;
    let existing = loop {
        if probe.exists() {
            break probe;
        }
        match probe.parent() {
            Some(p) => probe = p,
            None => return Err(CatalogError::Unsafe(dest.display().to_string())),
        }
    };
    if existing.canonicalize()?.starts_with(&root) {
        Ok(())
    } else {
        Err(CatalogError::Unsafe(dest.display().to_string()))
    }
}

fn read_registry(env: &Env) -> Res<Vec<CatalogItem>> {
    let path = env.registry_path();
    let src = fs::read_to_string(&path)
        .map_err(|_| CatalogError::NoRegistry(path.display().to_string()))?;
    let reg: Registry =
        serde_json::from_str(&src).map_err(|e| CatalogError::Io(format!("registry: {e}")))?;
    Ok(reg.items)
}

fn read_lock(env: &Env) -> Lock {
    fs::read_to_string(env.lock_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Write `bytes` to `dest` by temp file + rename in the same directory, never in place.
fn atomic_write(dest: &Path, bytes: &[u8], mode_from: Option<&Path>) -> Res<()> {
    let dir = dest
        .parent()
        .ok_or_else(|| CatalogError::Unsafe(dest.display().to_string()))?;
    fs::create_dir_all(dir)?;
    let base = dest
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let tmp = dir.join(format!(".{base}.kun-tmp.{}", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        if let Some(src) = mode_from {
            fs::set_permissions(&tmp, fs::metadata(src)?.permissions())?;
        }
        fs::rename(&tmp, dest)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result.map_err(Into::into)
}

fn write_lock(env: &Env, lock: &Lock) -> Res<()> {
    let body = serde_json::to_string_pretty(lock).map_err(|e| CatalogError::Io(e.to_string()))?;
    atomic_write(&env.lock_path(), format!("{body}\n").as_bytes(), None)
}

fn status_of(env: &Env, item: &CatalogItem, lock: &Lock) -> (ItemStatus, Option<String>) {
    let Some(entry) = lock.items.get(&item.id) else {
        return (ItemStatus::Available, None);
    };
    let current = item.files.iter().all(|f| {
        safe_rel(&f.target)
            .ok()
            .and_then(|t| fs::read(env.claude_dir.join(t)).ok())
            .is_some_and(|b| sha256_hex(&b) == f.sha256)
    });
    let status = if current {
        ItemStatus::Installed
    } else {
        ItemStatus::Outdated
    };
    (status, Some(entry.version.clone()))
}

/// The ids a profile-limited machine may touch: its departments' packs and everything they need.
/// `None` means the profile sees the whole catalog.
///
/// # Errors
/// When the registry is missing or unreadable.
pub fn allowed_ids(env: &Env, profile: &MachineProfile) -> Res<Option<BTreeSet<String>>> {
    if profile.access.catalog == CatalogAccess::All {
        return Ok(None);
    }
    let items = read_registry(env)?;
    let mut allowed = BTreeSet::new();
    for dept in &profile.departments {
        let id = format!("pack:{}", dept.name);
        if items.iter().any(|i| i.id == id) {
            allowed.extend(plan(&items, &id)?);
        }
    }
    for id in &profile.hidden {
        allowed.remove(id);
    }
    Ok(Some(allowed))
}

/// Every registry item with its status here.
///
/// # Errors
/// When the registry is missing or unreadable.
pub fn list_items(env: &Env) -> Res<Vec<CatalogItem>> {
    list_items_scoped(env, None)
}

/// [`list_items`], limited to `allowed` when it is `Some`.
///
/// # Errors
/// When the registry is missing or unreadable.
pub fn list_items_scoped(env: &Env, allowed: Option<&BTreeSet<String>>) -> Res<Vec<CatalogItem>> {
    let lock = read_lock(env);
    let mut items = read_registry(env)?;
    if let Some(allowed) = allowed {
        items.retain(|i| allowed.contains(&i.id));
    }
    for item in &mut items {
        let (status, installed_version) = status_of(env, item, &lock);
        item.status = status;
        item.installed_version = installed_version;
    }
    Ok(items)
}

/// `id` and everything it needs, dependencies first.
fn plan(items: &[CatalogItem], id: &str) -> Res<Vec<String>> {
    fn visit(
        items: &[CatalogItem],
        id: &str,
        seen: &mut Vec<String>,
        order: &mut Vec<String>,
    ) -> Res<()> {
        if seen.iter().any(|s| s == id) {
            return Ok(()); // already planned, or a cycle: either way do not recurse again
        }
        seen.push(id.to_string());
        let item = items
            .iter()
            .find(|i| i.id == id)
            .ok_or_else(|| CatalogError::UnknownItem(id.to_string()))?;
        for dep in &item.dependencies {
            visit(items, dep, seen, order)?;
        }
        order.push(id.to_string());
        Ok(())
    }
    let mut order = Vec::new();
    visit(items, id, &mut Vec::new(), &mut order)?;
    Ok(order)
}

/// Is `target` still claimed by an installed item other than `except`?
fn owned_elsewhere(lock: &Lock, except: &str, target: &str) -> bool {
    lock.items
        .iter()
        .any(|(id, e)| id != except && e.files.iter().any(|f| f == target))
}

fn install_one(env: &Env, item: &CatalogItem, lock: &mut Lock) -> Res<()> {
    // Resolve and check everything before writing anything.
    let mut staged: Vec<(PathBuf, Vec<u8>, PathBuf, String)> = Vec::new();
    for f in &item.files {
        let src = env.kun_dir.join(safe_rel(&f.path)?);
        let dest = env.claude_dir.join(safe_rel(&f.target)?);
        ensure_within(&env.claude_dir, &dest)?;
        let bytes = fs::read(&src).map_err(|_| CatalogError::Stale(f.path.clone()))?;
        if sha256_hex(&bytes) != f.sha256 {
            return Err(CatalogError::Stale(f.path.clone()));
        }
        staged.push((src, bytes, dest, f.target.clone()));
    }
    for (src, bytes, dest, _) in &staged {
        atomic_write(dest, bytes, Some(src))?;
    }
    // Files an older version put down that this version no longer has.
    let new_targets: Vec<String> = staged.iter().map(|s| s.3.clone()).collect();
    if let Some(old) = lock.items.get(&item.id).cloned() {
        for t in old.files.iter().filter(|t| !new_targets.contains(t)) {
            if !owned_elsewhere(lock, &item.id, t) {
                remove_target(env, t);
            }
        }
    }
    lock.items.insert(
        item.id.clone(),
        Installed {
            version: item.version.clone(),
            files: new_targets,
            dependencies: item.dependencies.clone(),
        },
    );
    write_lock(env, lock)
}

/// Remove one recorded file, then any now-empty directories above it (never `~/.claude` itself).
fn remove_target(env: &Env, target: &str) {
    let Ok(rel) = safe_rel(target) else { return };
    let path = env.claude_dir.join(rel);
    if fs::remove_file(&path).is_err() {
        return;
    }
    let mut dir = path.parent();
    while let Some(d) = dir {
        if d == env.claude_dir || fs::remove_dir(d).is_err() {
            break; // remove_dir only succeeds on an empty directory
        }
        dir = d.parent();
    }
}

/// Install `name` and its dependencies. Returns the ids written, dependencies first.
///
/// # Errors
/// On an invalid or unknown name, a stale registry, a path that would leave `~/.claude`, or I/O.
pub fn install_item(env: &Env, name: &str) -> Res<Vec<String>> {
    install_item_scoped(env, name, None)
}

/// [`install_item`], refusing `name` when `allowed` is `Some` and does not list it. Dependencies
/// of an allowed item are allowed by construction ([`allowed_ids`]).
///
/// # Errors
/// As [`install_item`], plus [`CatalogError::OutsideProfile`].
pub fn install_item_scoped(
    env: &Env,
    name: &str,
    allowed: Option<&BTreeSet<String>>,
) -> Res<Vec<String>> {
    validate_name(name)?;
    if allowed.is_some_and(|a| !a.contains(name)) {
        return Err(CatalogError::OutsideProfile(name.to_string()));
    }
    let items = list_items(env)?;
    let order = plan(&items, name)?;
    let mut lock = read_lock(env);
    let mut done = Vec::new();
    for id in order {
        // A dependency the profile hides (a pack's Mac-only lane) is skipped, never installed.
        if allowed.is_some_and(|a| !a.contains(&id)) {
            continue;
        }
        let item = items
            .iter()
            .find(|i| i.id == id)
            .ok_or_else(|| CatalogError::UnknownItem(id.clone()))?;
        // The asked-for item is always (re)written; dependencies only when not current.
        if id != name && item.status == ItemStatus::Installed {
            continue;
        }
        install_one(env, item, &mut lock)?;
        done.push(id);
    }
    Ok(done)
}

/// Remove the files the lockfile recorded for `name`, and only those.
///
/// # Errors
/// On an invalid or not-installed name, or when another installed item depends on it.
pub fn uninstall_item(env: &Env, name: &str) -> Res<()> {
    uninstall_item_scoped(env, name, None)
}

/// [`uninstall_item`], refusing `name` when `allowed` is `Some` and does not list it.
///
/// # Errors
/// As [`uninstall_item`], plus [`CatalogError::OutsideProfile`].
pub fn uninstall_item_scoped(env: &Env, name: &str, allowed: Option<&BTreeSet<String>>) -> Res<()> {
    validate_name(name)?;
    if allowed.is_some_and(|a| !a.contains(name)) {
        return Err(CatalogError::OutsideProfile(name.to_string()));
    }
    let mut lock = read_lock(env);
    let entry = lock
        .items
        .get(name)
        .cloned()
        .ok_or_else(|| CatalogError::UnknownItem(name.to_string()))?;
    if let Some((other, _)) = lock
        .items
        .iter()
        .find(|(id, e)| id.as_str() != name && e.dependencies.iter().any(|d| d == name))
    {
        return Err(CatalogError::InUse(name.to_string(), other.clone()));
    }
    lock.items.remove(name);
    for t in &entry.files {
        if !owned_elsewhere(&lock, name, t) {
            remove_target(env, t);
        }
    }
    write_lock(env, &lock)
}

/// Installs and uninstalls rewrite the lockfile: one at a time.
static WRITE: Mutex<()> = Mutex::new(());

async fn blocking<T: Send + 'static>(f: impl FnOnce(&Env) -> Res<T> + Send + 'static) -> Res<T> {
    tokio::task::spawn_blocking(move || {
        let _guard = WRITE
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        f(&Env::from_process())
    })
    .await
    .map_err(|e| CatalogError::Io(e.to_string()))?
}

/// This machine's allowed ids from its profile; `None` when the catalog is unrestricted.
fn scope(env: &Env) -> Res<Option<BTreeSet<String>>> {
    let resolved = crate::profile::current().map_err(|e| CatalogError::Profile(e.to_string()))?;
    allowed_ids(env, &resolved.profile)
}

/// `list` — the registry with each item's status on this computer, limited to the profile.
#[tauri::command]
async fn list() -> Res<Vec<CatalogItem>> {
    blocking(|env| list_items_scoped(env, scope(env)?.as_ref())).await
}

/// `install` — an item and its dependencies; returns the ids written. Refuses anything
/// outside the profile.
#[tauri::command]
async fn install(name: String) -> Res<Vec<String>> {
    blocking(move |env| install_item_scoped(env, &name, scope(env)?.as_ref())).await
}

/// `uninstall` — only the files this catalog installed for the item.
#[tauri::command]
async fn uninstall(name: String) -> Res<()> {
    blocking(move |env| uninstall_item_scoped(env, &name, scope(env)?.as_ref())).await
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("catalog")
        .invoke_handler(tauri::generate_handler![list, install, uninstall])
        .build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
