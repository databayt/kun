use super::*;

#[test]
fn strips_colors_and_cursor_codes() {
    let raw = "\u{1b}[32m✓ ok\u{1b}[0m \u{1b}[1;31mfail\u{1b}[0m\u{1b}[2K";
    assert_eq!(strip_ansi(raw), "✓ ok fail");
}

#[test]
fn strips_osc_titles_and_keeps_arabic() {
    let raw = "\u{1b}]0;title\u{7}صحة المحرك\u{1b}]8;;http://x\u{1b}\\link";
    assert_eq!(strip_ansi(raw), "صحة المحركlink");
}

#[test]
fn carriage_returns() {
    assert_eq!(strip_ansi("a\r\nb"), "a\nb");
    assert_eq!(strip_ansi("10%\r50%\r100%"), "100%");
    assert_eq!(strip_ansi("line1\n10%\r100%"), "line1\n100%");
}

#[test]
fn trailing_escape_is_safe() {
    assert_eq!(strip_ansi("x\u{1b}"), "x");
}

#[test]
fn behind_count() {
    assert_eq!(parse_behind("3\n"), Some(3));
    assert_eq!(parse_behind("0"), Some(0));
    assert_eq!(parse_behind("fatal: no upstream"), None);
}

#[test]
fn pull_summary() {
    assert!(summarize_pull("Already up to date.\n"));
    assert!(!summarize_pull("Updating a..b\nFast-forward\n 1 file changed"));
}

#[test]
fn head_line() {
    assert_eq!(parse_head("cd3342e\tfeat(machine): the shell\n"), Some(("cd3342e".into(), "feat(machine): the shell".into())));
    assert_eq!(parse_head(""), None);
    assert_eq!(parse_head("nosubject"), None);
}

#[test]
fn clip_keeps_tail_on_char_boundary() {
    let s = "ع".repeat(100);
    let c = clip_tail(&s, 11);
    assert!(c.starts_with('…'));
    assert!(c.ends_with('ع'));
    assert_eq!(clip_tail("short", 100), "short");
}

#[tokio::test]
async fn missing_checkout_is_reported_not_fatal() {
    let dir = tempfile::tempdir().unwrap();
    let st = read_status(dir.path()).await.unwrap();
    assert!(!st.exists);
    assert!(st.note.is_some());
    assert!(matches!(pull(dir.path()).await, Err(EngineError::NoCheckout(_))));
}

#[tokio::test]
async fn state_file_missing_and_present() {
    let dir = tempfile::tempdir().unwrap();
    assert!(!read_state(dir.path()).await.unwrap().exists);
    std::fs::create_dir_all(dir.path().join("state")).unwrap();
    std::fs::write(dir.path().join("state/aware.md"), "# kun\n").unwrap();
    let s = read_state(dir.path()).await.unwrap();
    assert!(s.exists);
    assert_eq!(s.text, "# kun\n");
}

#[tokio::test]
async fn real_repo_status_and_ff_only_pull() {
    // A scratch repo with an upstream, one commit behind.
    let root = tempfile::tempdir().unwrap();
    let sh = |dir: &Path, args: &[&str]| {
        let ok = std::process::Command::new("git")
            .arg("-C").arg(dir).args(args)
            .env("GIT_AUTHOR_NAME", "t").env("GIT_AUTHOR_EMAIL", "t@t")
            .env("GIT_COMMITTER_NAME", "t").env("GIT_COMMITTER_EMAIL", "t@t")
            .output().unwrap().status.success();
        assert!(ok, "git {args:?}");
    };
    let up = root.path().join("up");
    std::fs::create_dir(&up).unwrap();
    sh(&up, &["init", "-q", "-b", "main"]);
    std::fs::write(up.join("a"), "1").unwrap();
    sh(&up, &["add", "a"]);
    sh(&up, &["commit", "-q", "-m", "first"]);
    let me = root.path().join("me");
    sh(root.path(), &["clone", "-q", up.to_str().unwrap(), me.to_str().unwrap()]);
    std::fs::write(up.join("a"), "2").unwrap();
    sh(&up, &["commit", "-q", "-am", "second"]);

    let st = read_status(&me).await.unwrap();
    assert_eq!(st.behind, Some(1));
    assert_eq!(st.branch.as_deref(), Some("main"));
    assert_eq!(st.subject.as_deref(), Some("first"));
    let rep = pull(&me).await.unwrap();
    assert!(rep.ok && !rep.up_to_date);
    assert_ne!(rep.before, rep.after);
    assert!(pull(&me).await.unwrap().up_to_date);
}
