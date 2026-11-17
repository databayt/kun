#![allow(
    clippy::cast_precision_loss,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss
)]

use super::{audio::*, model::*, tts::*, *};

fn f32_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|s| s.to_le_bytes()).collect()
}

fn sine(hz: f32, rate: u32, secs: f32) -> Vec<f32> {
    let n = (rate as f32 * secs) as usize;
    (0..n)
        .map(|i| 0.5 * (std::f32::consts::TAU * hz * i as f32 / rate as f32).sin())
        .collect()
}

#[test]
fn decode_roundtrip_and_sanitizes() {
    let got = decode_pcm(&f32_bytes(&[0.25, -0.5, f32::NAN, 7.0, f32::NEG_INFINITY])).unwrap();
    assert_eq!(got, vec![0.25, -0.5, 0.0, 1.0, 0.0]);
    assert!(decode_pcm(&[1, 2, 3]).is_err());
    assert!(decode_pcm(&[]).unwrap().is_empty());
}

#[test]
fn resample_48k_to_16k_keeps_length_and_tone() {
    let src = sine(440.0, 48_000, 1.0);
    let out = resample_to_16k(&src, 48_000).unwrap();
    assert_eq!(out.len(), 16_000);
    assert!(rms(&out) > 0.3, "tone survives: {}", rms(&out));
}

#[test]
fn resample_44k1_and_upsample_and_passthrough() {
    let out = resample_to_16k(&sine(300.0, 44_100, 1.0), 44_100).unwrap();
    assert!((i64::try_from(out.len()).unwrap() - 16_000).abs() <= 1);
    let up = resample_to_16k(&sine(300.0, 8_000, 1.0), 8_000).unwrap();
    assert_eq!(up.len(), 16_000);
    let same = vec![0.1; 10];
    assert_eq!(resample_to_16k(&same, 16_000).unwrap(), same);
    assert!(resample_to_16k(&same, 100).is_err());
    assert!(resample_to_16k(&same, 400_000).is_err());
}

#[test]
fn pad_only_short_clips() {
    assert!(pad_for_whisper(vec![0.1; 100]).len() >= 16_000);
    assert_eq!(pad_for_whisper(vec![0.1; 40_000]).len(), 40_000);
}

#[test]
fn prepare_rejects_short_silent_and_long() {
    let quiet = f32_bytes(&vec![0.0; 48_000]);
    assert!(matches!(prepare(&quiet, 48_000), Err(VoiceError::Silence)));
    let tap = f32_bytes(&sine(300.0, 48_000, 0.1));
    assert!(matches!(prepare(&tap, 48_000), Err(VoiceError::TooShort)));
    let ok = f32_bytes(&sine(300.0, 48_000, 2.0));
    assert_eq!(prepare(&ok, 48_000).unwrap().len(), 32_000);
    let long = f32_bytes(&sine(300.0, 8_000, 121.0));
    assert!(prepare(&long, 8_000).is_err());
    assert!(prepare(&ok[..5], 48_000).is_err());
}

#[test]
fn sha_and_ready_check() {
    let dir = tempfile::tempdir().unwrap();
    let f = dir.path().join("x.bin");
    std::fs::write(&f, b"abc").unwrap();
    assert_eq!(
        sha256_file(&f).unwrap(),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert!(!is_ready(&f, Model::Base));
    assert!(sha256_file(&dir.path().join("none")).is_err());
    for m in Model::ALL {
        assert_eq!(m.sha256().len(), 64);
        assert!(m.sha256().bytes().all(|b| b.is_ascii_hexdigit()));
        assert!(m.url().ends_with(m.file()));
    }
}

#[test]
fn ready_means_the_exact_size_of_that_model() {
    let dir = tempfile::tempdir().unwrap();
    let f = dir.path().join("m.bin");
    let file = std::fs::File::create(&f).unwrap();
    file.set_len(Model::Base.size()).unwrap();
    assert!(is_ready(&f, Model::Base));
    assert!(!is_ready(&f, Model::Small));
}

#[test]
fn model_argument_is_validated() {
    assert_eq!(Model::parse(None).unwrap(), Model::Base);
    assert_eq!(Model::parse(Some("")).unwrap(), Model::Base);
    assert_eq!(Model::parse(Some(" small ")).unwrap(), Model::Small);
    assert!(Model::parse(Some("large")).is_err());
    assert!(Model::parse(Some("../small")).is_err());
    assert_eq!(Model::DEFAULT.file(), "ggml-base.bin");
    assert_eq!(Model::Base.size(), 147_951_465);
}

#[test]
fn percent_is_clamped() {
    assert_eq!(percent(0, 0), 0);
    assert_eq!(percent(50, 200), 25);
    assert_eq!(percent(300, 200), 100);
}

#[test]
fn hints() {
    assert_eq!(parse_hint(Some("ar")), Some("ar"));
    assert_eq!(parse_hint(Some(" en ")), Some("en"));
    assert_eq!(parse_hint(Some("auto")), None);
    assert_eq!(parse_hint(None), None);
    assert!(needs_rerun("fa", Some("ar")));
    assert!(!needs_rerun("en", Some("ar")));
    assert!(!needs_rerun("fa", None));
}

#[test]
fn transcript_cleanup() {
    assert_eq!(clean_transcript(" [BLANK_AUDIO] "), "");
    assert_eq!(
        clean_transcript("  مرحبا   (music) بالعالم "),
        "مرحبا بالعالم"
    );
    assert_eq!(clean_transcript("hello [noise] world"), "hello world");
}

const SAY_LIST: &str = "\
Albert              en_US    # Hello! My name is Albert.
Eddy (English (US)) en_US    # Hello! My name is Eddy.
Laila               ar_001   # مرحبًا! اسمي ليلى.
Majed               ar_001   # مرحبًا! اسمي ماجد.
Samantha            en_US    # Hello! My name is Samantha.
";

#[test]
fn say_voices_parse_and_pick() {
    let v = parse_say_voices(SAY_LIST);
    assert_eq!(v.len(), 5);
    assert_eq!(v[1].name, "Eddy (English (US))");
    assert_eq!(v[1].locale, "en_US");
    assert_eq!(pick_say_voice(&v, "ar").as_deref(), Some("Majed"));
    assert_eq!(pick_say_voice(&v, "en").as_deref(), Some("Samantha"));
    assert_eq!(
        pick_say_voice(&parse_say_voices("Zarvox en_US # x"), "ar"),
        None
    );
    assert!(parse_say_voices("garbage line").is_empty());
}

#[test]
fn speech_text_is_cleaned() {
    let md =
        "# عنوان\n**مهم** انظر https://kun.databayt.org الآن\n```rs\nfn main() {}\n```\nتم `الأمر`";
    assert_eq!(clean_for_speech(md), "عنوان مهم انظر الآن تم الأمر");
    assert!(clean_for_speech(&"ا".repeat(5000)).chars().count() <= 2000);
    assert_eq!(clean_for_speech("```\ncode\n```"), "");
}

#[tokio::test]
async fn status_reports_the_build() {
    let status = voice_status().await;
    assert_eq!(status.built, cfg!(feature = "voice"));
    assert_eq!(status.model_mb, 141);
    assert_eq!(status.models.len(), 2);
    assert!(
        status
            .models
            .iter()
            .any(|m| m.id == "small" && m.mb == 465 && !m.default)
    );
    assert!(status.models_dir.ends_with("models"));
}
