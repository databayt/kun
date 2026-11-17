//! voice — push-to-talk speech-to-text that stays on the computer, plus spoken replies.
//!
//! The webview captures the microphone (`getUserMedia` + `AudioWorklet`) and sends raw f32 mono
//! PCM; Rust resamples to 16 kHz and runs whisper.cpp (`whisper-rs`, cargo feature `voice`)
//! on the multilingual `ggml-small.bin`. Replies are spoken with the OS voices.

#[path = "audio.rs"]
pub mod audio;
#[path = "model.rs"]
pub mod model;
#[path = "tts.rs"]
pub mod tts;

use std::time::Instant;

use serde::Serialize;
use tauri::{
    Runtime,
    ipc::{Channel, InvokeBody, Request},
    plugin::{Builder, TauriPlugin},
};
use ts_rs::TS;

pub use model::ModelEvent;

#[derive(Debug, thiserror::Error)]
pub enum VoiceError {
    #[error("{0}")]
    Invalid(&'static str),
    #[error("التسجيل قصير جدًا · the recording is too short")]
    TooShort,
    #[error("لم نسمع صوتًا · no speech was heard")]
    Silence,
    #[error("الصوت غير مفعّل في هذا الإصدار · voice is not built into this version (build with the `voice` feature)")]
    NotBuilt,
    #[error("نموذج الصوت غير محمّل بعد · the speech model is not downloaded yet")]
    NoModel,
    #[error("model: {0}")]
    Model(String),
    #[error("download: {0}")]
    Download(String),
    #[error("whisper: {0}")]
    Whisper(String),
    #[error("speech: {0}")]
    Speak(String),
    #[error("تنزيل النموذج جارٍ بالفعل · the model is already downloading")]
    Busy,
}

impl Serialize for VoiceError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// What the UI needs to decide which controls to show.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "voice/types.ts")]
pub struct VoiceStatus {
    /// Whisper is compiled in.
    pub built: bool,
    pub model_ready: bool,
    pub model_mb: u32,
    pub models_dir: String,
    /// The OS can speak replies.
    pub tts: bool,
    /// The Arabic voice that will be used, when the OS reports one.
    pub arabic_voice: Option<String>,
}

/// One transcription.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "voice/types.ts")]
pub struct Transcript {
    pub text: String,
    /// ISO code whisper settled on (`ar`, `en`, ...).
    pub language: String,
    pub millis: u32,
}

/// The hint the page passes: `ar`, `en`, or `auto`.
#[must_use]
pub fn parse_hint(raw: Option<&str>) -> Option<&'static str> {
    match raw.map(str::trim) {
        Some("ar") => Some("ar"),
        Some("en") => Some("en"),
        _ => None,
    }
}

/// Languages we accept as-is from auto-detection; anything else is re-run with the page's
/// hint (short Arabic is often mis-detected as Persian or Urdu).
#[must_use]
pub fn needs_rerun(detected: &str, hint: Option<&str>) -> bool {
    hint.is_some_and(|h| detected != h && detected != "ar" && detected != "en")
}

/// Tidies whisper output: trims, collapses whitespace, drops the bracketed non-speech tags
/// whisper emits for silence and noise (`[BLANK_AUDIO]`, `(music)`).
#[must_use]
pub fn clean_transcript(raw: &str) -> String {
    let mut out = String::new();
    let mut depth = 0u32;
    for c in raw.chars() {
        match c {
            '[' | '(' => depth += 1,
            ']' | ')' if depth > 0 => depth -= 1,
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(feature = "voice")]
mod engine {
    use std::{
        path::Path,
        sync::{Arc, Mutex},
    };

    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    use super::{VoiceError, clean_transcript, needs_rerun};

    static CTX: Mutex<Option<Arc<WhisperContext>>> = Mutex::new(None);

    fn context(path: &Path) -> Result<Arc<WhisperContext>, VoiceError> {
        let mut guard = CTX.lock().map_err(|_| VoiceError::Whisper("lock poisoned".into()))?;
        if let Some(c) = guard.as_ref() {
            return Ok(Arc::clone(c));
        }
        let path = path.to_str().ok_or(VoiceError::Invalid("model path"))?;
        let ctx = WhisperContext::new_with_params(path, WhisperContextParameters::default())
            .map_err(|e| VoiceError::Whisper(e.to_string()))?;
        let ctx = Arc::new(ctx);
        *guard = Some(Arc::clone(&ctx));
        Ok(ctx)
    }

    fn run(ctx: &WhisperContext, pcm: &[f32], language: Option<&str>) -> Result<(String, String), VoiceError> {
        let mut state = ctx.create_state().map_err(|e| VoiceError::Whisper(e.to_string()))?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        let threads = std::thread::available_parallelism().map_or(4, std::num::NonZero::get).min(8);
        params.set_n_threads(i32::try_from(threads).unwrap_or(4));
        params.set_language(language);
        params.set_translate(false);
        params.set_no_context(true);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);
        state.full(params, pcm).map_err(|e| VoiceError::Whisper(e.to_string()))?;
        let mut text = String::new();
        for i in 0..state.full_n_segments() {
            if let Some(seg) = state.get_segment(i) {
                text.push_str(&seg.to_str_lossy().map_err(|e| VoiceError::Whisper(e.to_string()))?);
            }
        }
        let lang = whisper_rs::get_lang_str(state.full_lang_id_from_state()).unwrap_or("auto").to_string();
        Ok((clean_transcript(&text), lang))
    }

    /// Blocking: transcribe `pcm` (16 kHz mono). With a hint, a wrong-language detection is re-run forced.
    pub(super) fn transcribe(path: &Path, pcm: &[f32], hint: Option<&str>) -> Result<(String, String), VoiceError> {
        let ctx = context(path)?;
        let (text, lang) = run(&ctx, pcm, None)?;
        if needs_rerun(&lang, hint) {
            return run(&ctx, pcm, hint);
        }
        Ok((text, lang))
    }
}

#[cfg(not(feature = "voice"))]
mod engine {
    use std::path::Path;

    use super::VoiceError;

    pub(super) fn transcribe(_: &Path, _: &[f32], _: Option<&str>) -> Result<(String, String), VoiceError> {
        Err(VoiceError::NotBuilt)
    }
}

fn header<'a>(request: &'a Request<'_>, name: &str) -> Option<&'a str> {
    request.headers().get(name).and_then(|v| v.to_str().ok())
}

/// `voice_status` — what is ready on this machine.
#[tauri::command]
async fn voice_status() -> VoiceStatus {
    let (tts, arabic_voice) = tts::availability().await;
    VoiceStatus {
        built: cfg!(feature = "voice"),
        model_ready: model::is_ready(&model::model_path()),
        model_mb: u32::try_from(model::SIZE / 1_048_576).unwrap_or(0),
        models_dir: model::models_dir().display().to_string(),
        tts,
        arabic_voice,
    }
}

/// `download_model` — fetch the speech model once, streaming progress to the UI.
#[tauri::command]
async fn download_model(on_progress: Channel<ModelEvent>) -> Result<(), VoiceError> {
    #[cfg(feature = "voice")]
    {
        use std::sync::atomic::{AtomicBool, Ordering};
        static BUSY: AtomicBool = AtomicBool::new(false);
        if BUSY.swap(true, Ordering::AcqRel) {
            return Err(VoiceError::Busy);
        }
        let result = model::ensure(|e| {
            let _ = on_progress.send(e);
        })
        .await;
        BUSY.store(false, Ordering::Release);
        result.map(|_| ())
    }
    #[cfg(not(feature = "voice"))]
    {
        let _ = on_progress;
        Err(VoiceError::NotBuilt)
    }
}

/// `transcribe` — raw body: little-endian f32 mono samples. Headers: `x-rate` (Hz of the
/// samples) and `x-lang` (`ar` / `en` / `auto`).
#[tauri::command]
async fn transcribe(request: Request<'_>) -> Result<Transcript, VoiceError> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(VoiceError::Invalid("send raw PCM bytes"));
    };
    let rate: u32 = header(&request, "x-rate").and_then(|v| v.parse().ok()).ok_or(VoiceError::Invalid("x-rate header"))?;
    let hint = parse_hint(header(&request, "x-lang"));
    let pcm = audio::prepare(bytes, rate)?;
    let path = model::model_path();
    if !cfg!(feature = "voice") {
        return Err(VoiceError::NotBuilt);
    }
    if !model::is_ready(&path) {
        return Err(VoiceError::NoModel);
    }
    let started = Instant::now();
    let (text, language) = tokio::task::spawn_blocking(move || engine::transcribe(&path, &pcm, hint))
        .await
        .map_err(|e| VoiceError::Whisper(e.to_string()))??;
    Ok(Transcript { text, language, millis: u32::try_from(started.elapsed().as_millis()).unwrap_or(u32::MAX) })
}

/// `speak` — read `text` aloud in `lang` (`ar` or `en`) with the OS voice.
#[tauri::command]
async fn speak(text: String, lang: String) -> Result<(), VoiceError> {
    let lang = parse_hint(Some(&lang)).ok_or(VoiceError::Invalid("lang must be ar or en"))?;
    tts::speak(&text, lang).await
}

/// `stop_speaking` — cut off a reply being read.
#[tauri::command]
fn stop_speaking() {
    tts::stop();
}

#[must_use]
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("voice")
        .invoke_handler(tauri::generate_handler![voice_status, download_model, transcribe, speak, stop_speaking])
        .build()
}

#[cfg(test)]
#[path = "rust_test.rs"]
mod tests;
