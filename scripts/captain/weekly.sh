#!/usr/bin/env bash
# The Monday routine — kun plans the week and improves itself, on a budget.
#
#   bash scripts/captain/weekly.sh --run        one routine (launchd: Mondays 08:00)
#   bash scripts/captain/weekly.sh --install    arm launchd (owner Mac only — never onboarding)
#   bash scripts/captain/weekly.sh --uninstall
#   bash scripts/captain/weekly.sh --status
#
# Zero tokens first: aware refresh, improve detection + local SAFE fixes, a Claude Code
# release check. Then ONE ledgered Opus run (KUN_JOB=captain:weekly; engine.json →
# jobs.captain-weekly caps it at 1 a day) that:
#   1. /sync self — SAFE repo fixes + the rows Abdout approved with `yes <id>` on #169
#   2. /sync anthropic — only when a newer Claude Code release exists (no 36-day catch-up)
#   3. /weekly plan — from the sensed context, never the ~2.8M-token bench
#   4. writes .claude/memory/weekly/<date>-plan.md
# The script commits that file by pathspec, pushes when nothing is ahead, re-syncs the
# Engine decisions issue, and sends Abdout one message (kun_notify me).
# Follows the loop contract in .claude/templates/loop.sh. Built 2026-11-01.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NAME=captain-weekly
LABEL="com.databayt.$NAME"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$NAME-$(date +%F).log"
LOCK="$HOME/.claude/.$NAME.lock"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
. "$HOME/.claude/scripts/lib/runs.sh" 2>/dev/null || . "$REPO/.claude/scripts/lib/runs.sh" 2>/dev/null || runs_record() { :; }
. "$HOME/.claude/scripts/lib/notify.sh" 2>/dev/null || . "$REPO/.claude/scripts/lib/notify.sh" 2>/dev/null || kun_notify() { :; }
KUN_CLAUDE="$HOME/.claude/bin/kun-claude.sh"; [ -x "$KUN_CLAUDE" ] || KUN_CLAUDE="$REPO/.claude/bin/kun-claude.sh"

do_run() {
    cd "$REPO" || exit 1
    if ! mkdir "$LOCK" 2>/dev/null; then
        [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ] && { rmdir "$LOCK"; mkdir "$LOCK"; } || { log "another routine is running — skip"; exit 0; }
    fi
    trap 'rmdir "$LOCK" 2>/dev/null' EXIT
    local week today out
    week="$(date +%G-W%V)"; today="$(date +%F)"
    out=".claude/memory/weekly/${today}-plan.md"
    mkdir -p .claude/memory/weekly
    # one plan per planning week: a plan written in the last 3 days already covers it (a
    # Sunday run plans Mon–Sun, so Monday's launchd tick must not pay for the same plan twice)
    local recent; recent="$(find .claude/memory/weekly -name '*-plan.md' -mtime -3 2>/dev/null | head -1)"
    if [ -n "$recent" ] && [ "${1:-}" != "--force" ]; then
        log "a plan from the last 3 days already covers this week ($recent) — skip (--run --force overrides)"
        runs_record "$NAME" ok "skipped — $recent covers the week"
        return 0
    fi
    log "▶ weekly routine $week"

    # ── zero tokens ──
    node .claude/scripts/aware.mjs --refresh --quiet >/dev/null 2>&1 && log "aware refreshed"
    node .claude/scripts/improve.mjs --apply-safe >> "$LOG_FILE" 2>&1 && log "improve: detection + local SAFE fixes"
    local aware findings latest stamp upstream
    aware="$(cat "$HOME/.claude/state/aware.md" 2>/dev/null)"
    findings="$(node .claude/scripts/improve.mjs 2>/dev/null)"
    latest="$(gh api repos/anthropics/claude-code/releases/latest --jq .tag_name 2>/dev/null | sed 's/^v//')"
    stamp="$(jq -r '.sync.claude_code_version // ""' .claude/engine.json 2>/dev/null)"
    if [ -n "$latest" ] && [ "$latest" != "$stamp" ]; then upstream="NEW — Claude Code $latest is out (engine stamp $stamp)"; else upstream="not new (Claude Code ${latest:-?}, engine stamp ${stamp:-?})"; fi
    log "upstream: $upstream"

    # ── one judgment run ──
    local prompt
    prompt="You are kun's captain running the Monday routine headless — nobody can answer a question mid-run, so finish on your own and stay inside these limits.

LIMITS: never run the bench-dispatch workflow or /bench. Never run a /sync tier other than \`self\` and, only if UPSTREAM below says NEW, \`anthropic\`. No deploys, no messages to anyone, no product code. Do not edit a fleet surface (hooks, settings, rules-global, skills, engine policy) unless it is an approved row (status \`approved\` in ~/.claude/state/findings.json). Commit with explicit pathspecs (\`git commit -m … -- <paths>\`), never \`git add -A\`. Do NOT push — the script pushes after you finish. Never run git stash, git reset, git checkout -- <file>, git restore or git clean: other sessions have uncommitted work in this tree and it is not yours. Do NOT commit ${out} — the script commits it.

CONTEXT (already sensed with zero tokens — use it, don't re-derive it):
--- awareness ---
${aware}
--- improvement findings ---
${findings}
--- upstream ---
${upstream}

DO, IN ORDER:
1. /sync self: apply SAFE findings whose fix kind is \`repo\` (verify with \`bash .claude/scripts/health.sh\` and \`node .claude/scripts/lint-contracts.mjs\`), then implement each \`approved\` finding, verify, commit, and set its status to \`applied@<sha>\` in ~/.claude/state/findings.json. Stamp engine.json → sync.self = ${today}.
2. Only if UPSTREAM says NEW: /sync anthropic. Otherwise no outward sync this week. Record each ADOPT-DECIDE with \`node .claude/scripts/improve.mjs --add DECIDE "<title>" "<proposed change>" --source sync:anthropic\` so it joins the one queue Abdout approves from.
3. Plan the week with the /weekly skill in \`plan\` mode, replacing its steps 0 and 0.5 with the context above. The Drive orders everything: revenue > deadlines > infra > engine.
4. Write the plan to ${out} (≤ 60 lines of Markdown): the week's top 5 by the Drive, the allocation per person, risks, and the rows waiting for Abdout on the Engine decisions issue.

FINAL MESSAGE: at most 5 lines — the top priorities, what you applied, what waits for Abdout."
    local answer rc
    answer="$( (KUN_JOB=captain:weekly "$KUN_CLAUDE" -p "$prompt" --model opus --effort high --max-turns 40 --permission-mode auto --permission-prompts none) 2>> "$LOG_FILE")"; rc=$?
    printf '%s\n' "$answer" >> "$LOG_FILE"
    log "claude exit $rc"

    # ── deterministic close ──
    if [ -s "$out" ]; then
        git add -- "$out" && git commit -q -m "docs(captain): weekly plan $week" -- "$out" && log "committed $out"
        git fetch -q origin main 2>/dev/null
        if [ "$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 1)" = 0 ]; then
            git push -q origin main 2>>"$LOG_FILE" && log "pushed"
        else
            log "origin/main moved — plan committed locally, not pushed"
            kun_notify me "kun weekly" "Weekly plan committed locally but not pushed (origin moved) — git pull --rebase && git push in ~/kun"
        fi
        runs_record "$NAME" ok "plan $week written"
    else
        runs_record "$NAME" fail "no plan written (claude exit $rc)" 1
    fi
    node .claude/scripts/improve.mjs --issue >> "$LOG_FILE" 2>&1
    local summary
    summary="$(printf '%s' "$answer" | head -5)"
    kun_notify me "kun · week $week" "${summary:-The weekly routine ran (exit $rc) but returned no summary — see $LOG_FILE}
Plan: ~/kun/${out} · decisions: github.com/databayt/kun/issues?q=label:engine-decision"
    log "◀ done"
}

install() {
    [ "$(uname -s)" = Darwin ] || { echo "launchd is macOS-only"; exit 1; }
    cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
	<key>Label</key><string>$LABEL</string>
	<key>ProgramArguments</key><array><string>/bin/bash</string><string>$REPO/scripts/captain/weekly.sh</string><string>--run</string></array>
	<key>StartCalendarInterval</key><dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
	<key>StandardOutPath</key><string>$LOG_DIR/$NAME-launchd.out</string>
	<key>StandardErrorPath</key><string>$LOG_DIR/$NAME-launchd.err</string>
	<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.claude/bin</string></dict>
</dict></plist>
PL
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
    launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "armed $LABEL (Mondays 08:00)"
}

case "${1:---run}" in
    --run) do_run "${2:-}" ;;
    --install) install ;;
    --uninstall) launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; rm -f "$PLIST"; echo "disarmed $LABEL" ;;
    --status) launchctl list | grep "$LABEL" || echo "not armed"; ls -t "$REPO/.claude/memory/weekly" 2>/dev/null | head -3; tail -5 "$LOG_FILE" 2>/dev/null ;;
    *) echo "usage: $0 --run|--install|--uninstall|--status" >&2; exit 1 ;;
esac
