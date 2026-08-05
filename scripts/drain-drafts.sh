#!/usr/bin/env bash
# The scheduled half of the Hub's agent window.
#
# A contributor's ask lands in SocialDraftRequest as `pending`; nothing used to
# answer it until a human happened to run a Claude Code session. This script IS
# that session, on a timer: every tick it lists the queue (which stamps the
# `draft-drain` heartbeat the Hub reads), and only when rows are pending does it
# invoke `claude -p` — so an idle tick costs one Neon query and zero tokens.
#
# Drafting spends the Max subscription, never an API key — same posture as the
# window itself (.claude/memory/decisions/2026-07-30-in-app-draft-spend.md).
#
# Usage: bash scripts/drain-drafts.sh [--run|--install|--uninstall|--status]
#
#   --run        one tick: heartbeat + drain if pending (what launchd calls)
#   --install    arm the schedule (macOS launchd, every 5 minutes), idempotent
#   --uninstall  disarm
#   --status     is it armed, when did it last beat
#
# Failure modes, accepted and visible rather than papered over:
#   Mac asleep        → ticks skip; heartbeat goes stale; the Hub says so.
#   claude logged out → claude -p exits non-zero; heartbeat keeps beating with
#                       an unchanging "pending N" — the visible signature of
#                       "beating but not draining". Check the day's log.
#   stuck run         → the lock dir holds; later ticks skip; same signature.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
LOCK_DIR="$CLAUDE_DIR/.draft-drain.lock"
LOG_DIR="$CLAUDE_DIR/logs"
PLIST_LABEL="com.databayt.social-drafts"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

MODE="--run"
for arg in "$@"; do
    case "$arg" in
        --run|--install|--uninstall|--status) MODE="$arg" ;;
        *) echo "Unknown flag: $arg (use --run|--install|--uninstall|--status)" >&2; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/draft-drain-$(date +%F).log"
log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE"; }

# ── Scheduler ────────────────────────────────────────────────────

render_plist() {
    cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$PLIST_LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>$REPO/scripts/drain-drafts.sh</string>
		<string>--run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartInterval</key>
	<integer>300</integer>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string>
		<key>DISABLE_AUTOUPDATER</key>
		<string>1</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/draft-drain-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/draft-drain-launchd.err</string>
</dict>
</plist>
PLIST
}

do_install() {
    mkdir -p "$HOME/Library/LaunchAgents"
    render_plist > "$PLIST_PATH"
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "armed: $PLIST_LABEL every 5 min (plist: $PLIST_PATH)"
}

do_uninstall() {
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "disarmed: $PLIST_LABEL"
}

do_status() {
    if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then
        echo "armed ($PLIST_LABEL, every 300s)"
    else
        echo "NOT armed — run: bash scripts/drain-drafts.sh --install"
    fi
    tail -n 3 "$LOG_FILE" 2>/dev/null || echo "(no ticks logged today)"
}

case "$MODE" in
    --install)   do_install;   exit 0 ;;
    --uninstall) do_uninstall; exit 0 ;;
    --status)    do_status;    exit 0 ;;
esac

# ── One tick ─────────────────────────────────────────────────────

# No overlap: a drain can outlive the 5-minute tick while Claude writes.
mkdir "$LOCK_DIR" 2>/dev/null || { log "skip: lock held"; exit 0; }
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

cd "$REPO" || exit 0

if ! command -v claude >/dev/null 2>&1; then
    log "claude not on PATH — heartbeat only"
fi

# The list beats the heartbeat even when empty — that write is the whole
# "somebody is watching the queue" signal.
PENDING="$(node scripts/social-drafts.mjs list --json 2>>"$LOG_FILE")" || {
    log "list failed — check DATABASE_URL / network"; exit 0;
}
[ "$PENDING" = "[]" ] && exit 0

COUNT="$(printf '%s' "$PENDING" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).length))' 2>/dev/null || echo "?")"
log "drain start: $COUNT pending"

# Tools are allow-listed to exactly what queue mode needs: the queue script,
# brand-doc reads, and answer files. --max-turns caps a runaway session.
claude -p "Run the /draft skill in queue mode: drain every pending ask via 'node scripts/social-drafts.mjs'. Write each answer's Arabic and English to temp files and pass them with 'answer <id> --ar <file> --en <file>'. A full draft is copy AND/OR media: when the brief suggests a visual, pick a matching asset from content/media/library.json — by the (library: <id>) hint if the brief names one, else by brand + assetType — and pass its cdnUrl via '--media <url>'. Never invent or guess a URL; if the ask already carries mediaUrls, keep them unless the brief says otherwise; if nothing in the library matches, answer text-only (generation is a full-session job, not this lane's). Every ask must end answered or failed — never left pending." \
    --allowedTools "Bash(node scripts/social-drafts.mjs*)" "Read" "Write" "Glob" "Grep" \
    --max-turns 40 >> "$LOG_FILE" 2>&1
CLAUDE_EXIT=$?

# Post-drain list refreshes the heartbeat detail to the fresh count.
LEFT="$(node scripts/social-drafts.mjs list --json 2>/dev/null || echo '?')"
log "drain end: exit $CLAUDE_EXIT, left $([ "$LEFT" = "[]" ] && echo 0 || echo "$LEFT" | head -c 40)"
exit 0
