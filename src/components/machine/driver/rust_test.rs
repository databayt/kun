use super::*;

fn events(kind: DriverKind, fixture: &str) -> Vec<Event> {
    fixture.lines().flat_map(|l| parse_line(kind, l)).collect()
}

fn job(driver: DriverKind, prompt: &str, session: Option<&str>) -> Job {
    Job {
        job_id: "j1".into(),
        driver,
        prompt: prompt.into(),
        cwd: ".".into(),
        session: session.map(str::to_owned),
        timeout_secs: None,
        extra_args: Vec::new(),
        env: Vec::new(),
    }
}

#[test]
fn claude_stream_normalizes() {
    let got = events(DriverKind::Claude, include_str!("fixtures/claude.jsonl"));
    let session = "11111111-2222-3333-4444-555555555555".to_string();
    assert_eq!(
        got,
        vec![
            Event::Started {
                session: session.clone()
            },
            Event::Text {
                text: "Drafting the proposal.".into()
            },
            Event::Tool {
                name: "Read".into()
            },
            Event::Text {
                text: "عرض السعر جاهز.".into()
            },
            Event::Done {
                session: Some(session),
                ok: true,
                result: Some("عرض السعر جاهز.".into())
            },
        ]
    );
}

#[test]
fn codex_stream_normalizes() {
    let got = events(DriverKind::Codex, include_str!("fixtures/codex.jsonl"));
    assert_eq!(
        got,
        vec![
            Event::Started {
                session: "thr_fixture".into()
            },
            Event::Tool {
                name: "shell".into()
            },
            Event::Text {
                text: "Done.".into()
            },
            Event::Done {
                session: None,
                ok: true,
                result: None
            },
        ]
    );
}

#[test]
fn opencode_error_surfaces_message() {
    let got = events(
        DriverKind::Opencode,
        include_str!("fixtures/opencode-error.jsonl"),
    );
    assert_eq!(
        got,
        vec![Event::Error {
            message: "This API key has expired.".into()
        }]
    );
}

#[test]
fn garbage_lines_are_ignored() {
    for kind in DriverKind::ALL {
        assert!(parse_line(kind, "not json").is_empty());
        assert!(parse_line(kind, "{}").is_empty());
    }
}

#[test]
fn claude_args_end_options_before_prompt() {
    let args = args_for(&job(DriverKind::Claude, "--dangerous", Some("abc-123"))).unwrap();
    let dashdash = args.iter().position(|a| a == "--").unwrap();
    assert_eq!(args[dashdash + 1], "--dangerous");
    assert!(args.windows(2).any(|w| w == ["--resume", "abc-123"]));
    assert!(args.windows(2).any(|w| w == ["--permission-mode", "auto"]));
}

#[test]
fn codex_resume_uses_subcommand() {
    let args = args_for(&job(DriverKind::Codex, "hi", Some("thr_1"))).unwrap();
    assert_eq!(
        &args[..4],
        ["exec", "--json", "--sandbox", "workspace-write"]
    );
    assert!(args.windows(2).any(|w| w == ["resume", "thr_1"]));
}

#[test]
fn invalid_jobs_are_refused() {
    assert!(args_for(&job(DriverKind::Claude, "   ", None)).is_err());
    assert!(args_for(&job(DriverKind::Claude, "hi", Some("x; rm -rf /"))).is_err());
    assert!(
        args_for(&job(
            DriverKind::Claude,
            &"a".repeat(MAX_PROMPT_BYTES + 1),
            None
        ))
        .is_err()
    );
}

#[test]
fn detect_lists_every_driver() {
    let got = detect();
    assert_eq!(got.len(), DriverKind::ALL.len());
}

fn with_extras(extra: &[&str], env: &[(&str, &str)]) -> Job {
    Job {
        extra_args: extra.iter().map(|s| (*s).to_owned()).collect(),
        env: env
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect(),
        ..job(DriverKind::Claude, "hi", Some("s-1"))
    }
}

#[test]
fn claude_extras_sit_before_resume_and_the_prompt() {
    let j = with_extras(
        &[
            "--add-dir",
            "/r/kun",
            "--add-dir",
            "/r/mkan",
            "--settings",
            "/w/.claude-settings.json",
        ],
        &[],
    );
    let args = args_for(&j).unwrap();
    let pos = |needle: &str| args.iter().position(|a| a == needle).unwrap();
    assert!(args.windows(2).any(|w| w == ["--add-dir", "/r/kun"]));
    assert!(
        args.windows(2)
            .any(|w| w == ["--settings", "/w/.claude-settings.json"])
    );
    assert!(pos("--settings") < pos("--resume") && pos("--resume") < pos("--"));
    assert_eq!(args.last().map(String::as_str), Some("hi"));
}

#[test]
fn extras_are_validated() {
    for bad in [
        &["--dangerously-skip-permissions", "x"][..],
        &["--add-dir"],
        &["--add-dir", "--settings"],
        &["--add-dir", ""],
        &["--", " x"],
    ] {
        assert!(args_for(&with_extras(bad, &[])).is_err(), "{bad:?}");
    }
    let mut codex = with_extras(&["--add-dir", "/r"], &[]);
    codex.driver = DriverKind::Codex;
    assert!(args_for(&codex).is_err());
}

#[test]
fn env_is_validated() {
    assert!(args_for(&with_extras(&[], &[("TWENTY_API_KEY", "k")])).is_ok());
    for bad in [
        "PATH",
        "lower",
        "",
        "LD_PRELOAD",
        "DYLD_INSERT_LIBRARIES",
        "A-B",
    ] {
        assert!(args_for(&with_extras(&[], &[(bad, "v")])).is_err(), "{bad}");
    }
}

#[test]
fn windows_search_paths() {
    let dirs = windows_dirs(
        Some("C:/L".into()),
        Some("C:/U".into()),
        Some("C:/A".into()),
    );
    assert_eq!(
        dirs,
        vec![
            PathBuf::from("C:/L/Programs/claude"),
            PathBuf::from("C:/U/.local/bin"),
            PathBuf::from("C:/A/npm"),
        ]
    );
    assert!(windows_dirs(None, None, None).is_empty());
}
