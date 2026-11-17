//! Pure PCM handling: the webview sends raw little-endian f32 mono samples at whatever
//! rate its `AudioContext` runs (usually 44.1/48 kHz); whisper wants 16 kHz.

use super::VoiceError;

pub const WHISPER_HZ: u32 = 16_000;
/// Shortest clip worth transcribing (a tap, not speech).
pub const MIN_SECS: f32 = 0.3;
/// Longest clip accepted (keeps a stuck mic from filling memory).
pub const MAX_SECS: u32 = 120;
/// whisper.cpp refuses input shorter than one second, so short clips are zero-padded to this.
const PAD_SECS: f32 = 1.1;
/// Below this RMS the clip is treated as silence.
pub const SILENCE_RMS: f32 = 0.002;

/// Decodes little-endian f32 bytes. Non-finite samples become 0, the rest is clamped to ±1.
///
/// # Errors
/// If the byte length is not a multiple of four.
pub fn decode_pcm(bytes: &[u8]) -> Result<Vec<f32>, VoiceError> {
    if !bytes.len().is_multiple_of(4) {
        return Err(VoiceError::Invalid("audio is not whole f32 samples"));
    }
    Ok(bytes
        .chunks_exact(4)
        .map(|c| {
            let v = f32::from_le_bytes([c[0], c[1], c[2], c[3]]);
            if v.is_finite() { v.clamp(-1.0, 1.0) } else { 0.0 }
        })
        .collect())
}

/// Resamples to 16 kHz: a box average over each output step (a cheap low-pass) when
/// downsampling, linear interpolation when upsampling.
///
/// # Errors
/// If the source rate is outside 8–96 kHz.
#[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub fn resample_to_16k(samples: &[f32], from_hz: u32) -> Result<Vec<f32>, VoiceError> {
    if !(8_000..=96_000).contains(&from_hz) {
        return Err(VoiceError::Invalid("sample rate"));
    }
    if from_hz == WHISPER_HZ {
        return Ok(samples.to_vec());
    }
    let ratio = f64::from(from_hz) / f64::from(WHISPER_HZ);
    let out_len = (samples.len() as f64 / ratio).floor() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let start = i as f64 * ratio;
        let end = start + ratio;
        if ratio > 1.0 {
            let (a, b) = (start.floor() as usize, (end.ceil() as usize).min(samples.len()));
            let slice = &samples[a.min(b)..b];
            out.push(if slice.is_empty() { 0.0 } else { slice.iter().sum::<f32>() / slice.len() as f32 });
        } else {
            let a = start.floor() as usize;
            let frac = (start - start.floor()) as f32;
            let x = samples.get(a).copied().unwrap_or(0.0);
            let y = samples.get(a + 1).copied().unwrap_or(x);
            out.push(x + (y - x) * frac);
        }
    }
    Ok(out)
}

/// Root-mean-square level of the clip.
#[must_use]
#[allow(clippy::cast_precision_loss)]
pub fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt()
}

/// Zero-pads a short clip up to just over a second, as whisper.cpp requires.
#[must_use]
#[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub fn pad_for_whisper(mut samples: Vec<f32>) -> Vec<f32> {
    let min = (PAD_SECS * WHISPER_HZ as f32) as usize;
    if samples.len() < min {
        samples.resize(min, 0.0);
    }
    samples
}

/// Bytes from the webview → 16 kHz mono samples ready for whisper, or why not.
///
/// # Errors
/// Malformed bytes, a bad rate, a clip too short/long, or silence.
#[allow(clippy::cast_precision_loss)]
pub fn prepare(bytes: &[u8], from_hz: u32) -> Result<Vec<f32>, VoiceError> {
    let raw = decode_pcm(bytes)?;
    let secs = raw.len() as f32 / from_hz.max(1) as f32;
    if secs < MIN_SECS {
        return Err(VoiceError::TooShort);
    }
    if secs > MAX_SECS as f32 {
        return Err(VoiceError::Invalid("clip longer than two minutes"));
    }
    if rms(&raw) < SILENCE_RMS {
        return Err(VoiceError::Silence);
    }
    Ok(pad_for_whisper(resample_to_16k(&raw, from_hz)?))
}
