//! The speech models: multilingual whisper.cpp ggml files, downloaded once from the official
//! repo on Hugging Face into `~/.kun/machine/models`, size- and sha256-checked.
//!
//! The default is `base` (~142 MB), not `small` (~465 MB): whisper runs on the CPU, and on a
//! mid-range laptop (an 11th-gen i5, no GPU) `small` takes several times the length of the clip
//! to decode, which is too slow for push-to-talk. `base` is multilingual and good enough for
//! short Arabic and English commands; `small` stays selectable for machines that can afford it.

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use super::VoiceError;

/// A selectable speech model. Sizes and sha256 are the LFS oids published by the repo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Model {
    Base,
    Small,
}

impl Model {
    pub const ALL: [Model; 2] = [Model::Base, Model::Small];
    /// Used when the page names no model.
    pub const DEFAULT: Model = Model::Base;

    #[must_use]
    pub const fn id(self) -> &'static str {
        match self {
            Model::Base => "base",
            Model::Small => "small",
        }
    }

    #[must_use]
    pub const fn file(self) -> &'static str {
        match self {
            Model::Base => "ggml-base.bin",
            Model::Small => "ggml-small.bin",
        }
    }

    #[must_use]
    pub const fn url(self) -> &'static str {
        match self {
            Model::Base => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
            Model::Small => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        }
    }

    #[must_use]
    pub const fn size(self) -> u64 {
        match self {
            Model::Base => 147_951_465,
            Model::Small => 487_601_967,
        }
    }

    #[must_use]
    pub const fn sha256(self) -> &'static str {
        match self {
            Model::Base => "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
            Model::Small => "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
        }
    }

    #[must_use]
    #[allow(clippy::cast_possible_truncation)] // the largest model is under 500 MiB
    pub const fn mb(self) -> u32 {
        // Whole MiB, rounded down (the figure the UI shows).
        (self.size() / 1_048_576) as u32
    }

    /// Parses the page's `model` argument: absent or empty means the default.
    ///
    /// # Errors
    /// For any name that is not a known model.
    pub fn parse(raw: Option<&str>) -> Result<Model, VoiceError> {
        match raw.map(str::trim) {
            None | Some("") => Ok(Model::DEFAULT),
            Some("base") => Ok(Model::Base),
            Some("small") => Ok(Model::Small),
            Some(_) => Err(VoiceError::Invalid("model must be base or small")),
        }
    }
}

/// `KUN_MODELS_DIR` or `~/.kun/machine/models`.
#[must_use]
pub fn models_dir() -> PathBuf {
    match std::env::var_os("KUN_MODELS_DIR") {
        Some(v) if !v.is_empty() => PathBuf::from(v),
        _ => dirs::home_dir().unwrap_or_default().join(".kun/machine/models"),
    }
}

#[must_use]
pub fn model_path(model: Model) -> PathBuf {
    models_dir().join(model.file())
}

/// Cheap readiness check (size only — the sha256 is verified once, at download).
#[must_use]
pub fn is_ready(path: &Path, model: Model) -> bool {
    std::fs::metadata(path).is_ok_and(|m| m.len() == model.size())
}

/// Lowercase hex of a digest.
#[must_use]
pub fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    bytes.iter().fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    })
}

/// sha256 of a file, streamed.
///
/// # Errors
/// If the file cannot be read.
pub fn sha256_file(path: &Path) -> Result<String, VoiceError> {
    use std::io::Read as _;
    let mut file = std::fs::File::open(path).map_err(|e| VoiceError::Model(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file.read(&mut buf).map_err(|e| VoiceError::Model(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex(&hasher.finalize()))
}

/// Progress the UI shows while the model downloads.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, ts_rs::TS)]
#[serde(tag = "kind", rename_all = "lowercase")]
#[ts(export, export_to = "voice/types.ts")]
pub enum ModelEvent {
    Downloading { done_mb: u32, total_mb: u32, percent: u32 },
    Verifying,
    Ready,
}

/// Percent complete, clamped to 100.
#[must_use]
pub fn percent(done: u64, total: u64) -> u32 {
    if total == 0 {
        return 0;
    }
    u32::try_from((done.saturating_mul(100) / total).min(100)).unwrap_or(100)
}

/// Downloads and verifies the model. Idempotent: returns at once if it is already there.
///
/// # Errors
/// Network failure, wrong size or checksum (the partial file is deleted), disk errors.
#[cfg(feature = "voice")]
pub async fn ensure(model: Model, mut on: impl FnMut(ModelEvent) + Send) -> Result<PathBuf, VoiceError> {
    use std::time::Duration;

    use tokio::io::AsyncWriteExt as _;

    let dest = model_path(model);
    if is_ready(&dest, model) {
        on(ModelEvent::Ready);
        return Ok(dest);
    }
    tokio::fs::create_dir_all(models_dir()).await.map_err(|e| VoiceError::Download(e.to_string()))?;
    let part = dest.with_extension("bin.part");
    let fail = |e: String| VoiceError::Download(e);
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| fail(e.to_string()))?;
    let mut resp = client.get(model.url()).send().await.and_then(reqwest::Response::error_for_status).map_err(|e| fail(e.to_string()))?;
    let total = resp.content_length().unwrap_or(model.size());
    let mut file = tokio::fs::File::create(&part).await.map_err(|e| fail(e.to_string()))?;
    let mut hasher = Sha256::new();
    let (mut done, mut last_pct) = (0u64, u32::MAX);
    let to_mb = |b: u64| u32::try_from(b / 1_048_576).unwrap_or(u32::MAX);
    let outcome: Result<(), VoiceError> = async {
        loop {
            let chunk = tokio::time::timeout(Duration::from_secs(60), resp.chunk())
                .await
                .map_err(|_| fail("the download stalled".into()))?
                .map_err(|e| fail(e.to_string()))?;
            let Some(chunk) = chunk else { break };
            hasher.update(&chunk);
            file.write_all(&chunk).await.map_err(|e| fail(e.to_string()))?;
            done += chunk.len() as u64;
            let pct = percent(done, total);
            if pct != last_pct {
                last_pct = pct;
                on(ModelEvent::Downloading { done_mb: to_mb(done), total_mb: to_mb(total), percent: pct });
            }
        }
        file.flush().await.map_err(|e| fail(e.to_string()))
    }
    .await;
    drop(file);
    if let Err(e) = outcome {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(e);
    }
    on(ModelEvent::Verifying);
    if done != model.size() || hex(&hasher.finalize()) != model.sha256() {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(VoiceError::Download("checksum mismatch — the file was discarded".into()));
    }
    tokio::fs::rename(&part, &dest).await.map_err(|e| fail(e.to_string()))?;
    on(ModelEvent::Ready);
    Ok(dest)
}
