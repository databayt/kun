#!/usr/bin/env bash
# The calendar half of Loop B — weekly draft seeding, billing-compliant.
#
# Monday 07:00 local, this files the week's briefs (content/social/pillars.json,
# ISO-week rotation) into SocialDraftRequest via `social-drafts.mjs seed --auto`,
# for EVERY brand with briefs, then nudges the drain so the copy exists minutes
# later instead of at the next tick. The existing drain answers on the Max pool; the Hub shows the
# drafts; a human stages and approves. Nothing here publishes.
#
# Why not the Vercel cron (/api/social/cron)? It has no billing-compliant draft
# source — Hermes is down and API spend is off by decision (D-20260730) — and
# it drafts one text for all channels. This lane feeds the queue that already
# drafts properly. See content/docs/social/status.mdx (Loop B).
#
# Usage: bash scripts/seed-drafts.sh [--run|--install|--uninstall|--status]
#
#   --run        seed this week's briefs, then one drain tick
#   --install    arm the schedule (launchd, Mondays 07:00), idempotent
#   --uninstall  disarm
#   --status     is it armed, when did it last seed
#
# Failure modes, visible rather than papered over:
#   Mac asleep Monday 07:00 → launchd fires the job on next wake.
#   Repo pulled with new pillars → next Monday uses them; no state to migrate.
#   Double run (manual + scheduled) → the 14-day dedup in `seed` collapses it.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="$HOME/.claude"
LOG_DIR="$CLAUDE_DIR/logs"
PLIST_LABEL="com.databayt.social-seed"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

# Empty means every brand with briefs in content/social/pillars.json — which is
# what the weekly timer wants. This used to default to "hogwarts", so the Monday
# job filed for one brand and every other brand's briefs arrived only when
# somebody ran the seeder by hand. Measured 2026-08-26, seeded asks per brand:
# hogwarts 7, balqalam 3, mkan 3, databayt 1.
#
# Set SEED_BRAND=<name> to file for exactly one brand instead.
SEED_BRAND="${SEED_BRAND:-}"
SEED_COUNT="${SEED_COUNT:-2}"

MODE="--run"
for arg in "$@"; do
    case "$arg" in
        --run|--install|--uninstall|--status) MODE="$arg" ;;
        *) echo "Unknown flag: $arg (use --run|--install|--uninstall|--status)" >&2; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/draft-seed-$(date +%F).log"
log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG_FILE"; }

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
		<string>$REPO/scripts/seed-drafts.sh</string>
		<string>--run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Weekday</key>
		<integer>1</integer>
		<key>Hour</key>
		<integer>7</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string>
		<key>DISABLE_AUTOUPDATER</key>
		<string>1</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/draft-seed-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/draft-seed-launchd.err</string>
</dict>
</plist>
PLIST
}

do_install() {
    mkdir -p "$HOME/Library/LaunchAgents"
    render_plist > "$PLIST_PATH"
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH" 2>/dev/null || true
    echo "armed: $PLIST_LABEL Mondays 07:00 (plist: $PLIST_PATH)"
}

do_uninstall() {
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "disarmed: $PLIST_LABEL"
}

do_status() {
    if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then
        echo "armed ($PLIST_LABEL, Mondays 07:00, ${SEED_BRAND:-all brands} × $SEED_COUNT)"
    else
        echo "NOT armed — run: bash scripts/seed-drafts.sh --install"
    fi
    tail -n 3 "$LOG_FILE" 2>/dev/null || echo "(no seeds logged today)"
}

case "$MODE" in
    --install)   do_install;   exit 0 ;;
    --uninstall) do_uninstall; exit 0 ;;
    --status)    do_status;    exit 0 ;;
esac

# ── One weekly run ───────────────────────────────────────────────

cd "$REPO" || exit 0

log "seed start: ${SEED_BRAND:-all brands} × $SEED_COUNT"
if [ -n "$SEED_BRAND" ]; then
    SEED_SCOPE=(--brand "$SEED_BRAND")
else
    SEED_SCOPE=(--all-brands)
fi
node scripts/social-drafts.mjs seed --auto "${SEED_SCOPE[@]}" --count "$SEED_COUNT" >> "$LOG_FILE" 2>&1 || {
    log "seed failed — check DATABASE_URL / network"; exit 0;
}

# Nudge the drain so Monday's copy exists in minutes. If a drain is already
# mid-run its lock wins and the next 5-minute tick picks these up — fine.
bash scripts/drain-drafts.sh --run >> "$LOG_FILE" 2>&1 || true
log "seed end"
exit 0
