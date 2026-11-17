//! Spoken replies through the operating system's own voices — free, offline, no model.

use std::process::Stdio;

use tokio::{io::AsyncWriteExt, process::Command, sync::Notify};

use super::VoiceError;

static STOP: Notify = Notify::const_new();
const MAX_CHARS: usize = 2000;

/// One installed macOS voice, from `say -v ?`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SayVoice {
    pub name: String,
    pub locale: String,
}

/// Parses `say -v ?` lines like `Majed      ar_001    # مرحبا`.
#[must_use]
pub fn parse_say_voices(list: &str) -> Vec<SayVoice> {
    list.lines()
        .filter_map(|line| {
            let left = line.split_once(" # ").map_or(line, |(l, _)| l).trim_end();
            let (name, locale) = left.rsplit_once(char::is_whitespace)?;
            let (name, locale) = (name.trim(), locale.trim());
            (!name.is_empty() && locale.contains('_')).then(|| SayVoice {
                name: name.into(),
                locale: locale.into(),
            })
        })
        .collect()
}

/// The best installed voice for `lang` (`ar` / `en`): a well-known name first, else any
/// voice of that language.
#[must_use]
pub fn pick_say_voice(voices: &[SayVoice], lang: &str) -> Option<String> {
    let prefix = format!("{lang}_");
    let ok = |v: &&SayVoice| v.locale.to_lowercase().starts_with(&prefix);
    let preferred: &[&str] = if lang == "ar" {
        &["Majed", "Laila", "Tarik"]
    } else {
        &["Samantha", "Alex", "Daniel"]
    };
    preferred
        .iter()
        .find_map(|p| voices.iter().filter(ok).find(|v| v.name == *p))
        .or_else(|| voices.iter().find(ok))
        .map(|v| v.name.clone())
}

/// Drops what a voice should not read aloud: code blocks, markdown marks, links.
#[must_use]
pub fn clean_for_speech(text: &str) -> String {
    let mut out = String::new();
    let mut in_fence = false;
    for line in text.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        out.push_str(line);
        out.push(' ');
    }
    let no_links: String = out
        .split_whitespace()
        .filter(|w| !(w.starts_with("http://") || w.starts_with("https://")))
        .collect::<Vec<_>>()
        .join(" ");
    let plain: String = no_links
        .chars()
        .filter(|c| !matches!(c, '`' | '*' | '#' | '_' | '>' | '|'))
        .collect();
    plain
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(MAX_CHARS)
        .collect()
}

/// Whether this OS has a speech command, and the Arabic voice it would use (macOS only).
pub async fn availability() -> (bool, Option<String>) {
    if cfg!(target_os = "macos") {
        let voices = list_voices().await;
        return (true, pick_say_voice(&voices, "ar"));
    }
    (cfg!(windows) || which_espeak().is_some(), None)
}

async fn list_voices() -> Vec<SayVoice> {
    match Command::new("/usr/bin/say")
        .args(["-v", "?"])
        .stdin(Stdio::null())
        .output()
        .await
    {
        Ok(o) => parse_say_voices(&String::from_utf8_lossy(&o.stdout)),
        Err(_) => Vec::new(),
    }
}

fn which_espeak() -> Option<std::path::PathBuf> {
    std::env::var_os("PATH")
        .into_iter()
        .flat_map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .map(|d| d.join("espeak-ng"))
        .find(|p| p.is_file())
}

const WIN_SCRIPT: &str = r"Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name.StartsWith($env:KUN_LANG) } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
$s.Speak($env:KUN_SAY)";

/// Speaks `text` (already validated language) and returns when it finishes or `stop` is called.
///
/// # Errors
/// If the speech command is missing or fails to start.
pub async fn speak(text: &str, lang: &str) -> Result<(), VoiceError> {
    let said = clean_for_speech(text);
    if said.is_empty() {
        return Ok(());
    }
    let mut cmd;
    let mut stdin_text = None;
    if cfg!(target_os = "macos") {
        cmd = Command::new("/usr/bin/say");
        if let Some(voice) = pick_say_voice(&list_voices().await, lang) {
            cmd.args(["-v", &voice]);
        }
        cmd.args(["-f", "-"]);
        stdin_text = Some(said);
    } else if cfg!(windows) {
        cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", WIN_SCRIPT])
            .env("KUN_SAY", said)
            .env("KUN_LANG", lang);
    } else if let Some(bin) = which_espeak() {
        cmd = Command::new(bin);
        cmd.args(["-v", lang, "--"]).arg(said);
    } else {
        return Err(VoiceError::Speak("no speech engine on this system".into()));
    }
    cmd.stdin(if stdin_text.is_some() {
        Stdio::piped()
    } else {
        Stdio::null()
    })
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .kill_on_drop(true);
    let mut child = cmd.spawn().map_err(|e| VoiceError::Speak(e.to_string()))?;
    if let (Some(text), Some(mut stdin)) = (stdin_text, child.stdin.take()) {
        stdin
            .write_all(text.as_bytes())
            .await
            .map_err(|e| VoiceError::Speak(e.to_string()))?;
        drop(stdin);
    }
    tokio::select! {
        status = child.wait() => {
            status.map_err(|e| VoiceError::Speak(e.to_string()))?;
        }
        () = STOP.notified() => {
            let _ = child.kill().await;
        }
    }
    Ok(())
}

/// Interrupts any reply being spoken.
pub fn stop() {
    STOP.notify_waiters();
}
