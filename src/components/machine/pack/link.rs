//! Skill links: a pack's skills appear in the working folder as links into kun's checkout.
//!
//! Unix uses a symlink. Windows tries a symlink (needs Developer Mode or admin), then a
//! directory junction (no admin needed), then a plain copy marked with [`COPY_MARKER`] so the
//! next run can refresh it. Real folders the person made are never touched.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use super::{PackError, io_err};

/// Dropped inside a copied skill folder (the Windows last resort) so it can be refreshed.
pub(super) const COPY_MARKER: &str = ".kun-copy";

#[cfg(unix)]
pub(super) fn symlink(target: &Path, link: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}

/// Windows: symlink, then junction, then copy.
#[cfg(windows)]
pub(super) fn symlink(target: &Path, link: &Path) -> io::Result<()> {
    std::os::windows::fs::symlink_dir(target, link)
        .or_else(|_| junction::create(target, link))
        .or_else(|_| copy_dir(target, link))
}

/// Copies a folder tree and marks it as ours.
#[cfg_attr(not(windows), allow(dead_code))]
pub(super) fn copy_dir(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), to)?;
        }
    }
    fs::write(dst.join(COPY_MARKER), "copied by machine; refreshed on every run\n")
}

/// A symlink or junction we can remove with `remove_file` / `remove_dir`.
fn remove_link(path: &Path) -> io::Result<()> {
    fs::remove_file(path).or_else(|_| fs::remove_dir(path))
}

/// Makes `dest/<name>` point at `src/<name>` for every wanted name that exists, and removes
/// our own stale links (links into `src` that are no longer wanted). Real files are never touched.
pub(super) fn link_skills(src: &Path, dest: &Path, wanted: &[String]) -> Result<(), PackError> {
    fs::create_dir_all(dest).map_err(io_err(dest))?;
    for name in wanted {
        let target: PathBuf = src.join(name);
        if !target.exists() {
            continue;
        }
        let link = dest.join(name);
        match fs::symlink_metadata(&link) {
            // A symlink or a junction reads back through `read_link`; a real folder does not.
            Ok(_) => match fs::read_link(&link) {
                Ok(t) if t == target => continue,
                Ok(_) => remove_link(&link).map_err(io_err(&link))?,
                Err(_) if link.join(COPY_MARKER).is_file() => fs::remove_dir_all(&link).map_err(io_err(&link))?,
                Err(_) => continue,
            },
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(io_err(&link)(e)),
        }
        symlink(&target, &link).map_err(io_err(&link))?;
    }
    for entry in fs::read_dir(dest).map_err(io_err(dest))?.flatten() {
        let path = entry.path();
        let keep = wanted.iter().any(|w| path.file_name().is_some_and(|n| n == w.as_str()));
        if keep {
            continue;
        }
        if fs::read_link(&path).is_ok_and(|t| t.starts_with(src)) {
            remove_link(&path).map_err(io_err(&path))?;
        } else if path.join(COPY_MARKER).is_file() {
            fs::remove_dir_all(&path).map_err(io_err(&path))?;
        }
    }
    Ok(())
}
