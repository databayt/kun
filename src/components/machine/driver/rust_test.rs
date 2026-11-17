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
    }
}

#[test]
fn claude_stream_normalizes() {
    let got = events(DriverKind::Claude, include_str!("fixtures/claude.jsonl"));
    let session = "11111111-2222-3333-4444-555555555555".to_string();
    assert_eq!(
        got,
        vec![
            Event::Started { session: session.clone() },
            Event::Text { text: "Drafting the proposal.".into() },
            Event::Tool { name: "Read".into() },
            Event::Text { text: "عرض السعر جاهز.".into() },
            Event::Done { session: Some(session), ok: true, result: Some("عرض السعر جاهز.".into()) },
        ]
    );
}

#[test]
fn codex_stream_normalizes() {
    let got = events(DriverKind::Codex, include_str!("fixtures/codex.jsonl"));
    assert_eq!(
        got,
        vec![
            Event::Started { session: "thr_fixture".into() },
            Event::Tool { name: "shell".into() },
            Event::Text { text: "Done.".into() },
            Event::Done { session: None, ok: true, result: None },
        ]
    );
}

#[test]
fn opencode_error_surfaces_message() {
    let got = events(DriverKind::Opencode, include_str!("fixtures/opencode-error.jsonl"));
    assert_eq!(got, vec![Event::Error { message: "This API key has expired.".into() }]);
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
    assert_eq!(&args[..4], ["exec", "--json", "--sandbox", "workspace-write"]);
    assert!(args.windows(2).any(|w| w == ["resume", "thr_1"]));
}

#[test]
fn invalid_jobs_are_refused() {
    assert!(args_for(&job(DriverKind::Claude, "   ", None)).is_err());
    assert!(args_for(&job(DriverKind::Claude, "hi", Some("x; rm -rf /"))).is_err());
    assert!(args_for(&job(DriverKind::Claude, &"a".repeat(MAX_PROMPT_BYTES + 1), None)).is_err());
}

#[test]
fn detect_lists_every_driver() {
    let got = detect();
    assert_eq!(got.len(), DriverKind::ALL.len());
}
