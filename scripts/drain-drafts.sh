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
#   --install    arm the schedule (macOS launchd, every minute), idempotent
#   --uninstall  disarm
#   --status     is it armed, when did it last beat
#
# ── Why a minute, and why more than one pass ─────────────────────────────────
#
# The tick used to be 5 minutes, which was right when every ask was a cold
# brief nobody was waiting on. Refinement turns changed the shape of the work:
# a reviewer reading an answer and typing "sharper hook" IS waiting, and a
# five-minute round trip is not a conversation. Two changes carry that:
#
#   StartInterval 60  — an idle tick is one Neon query and an immediate exit,
#                       so the floor on a reply is ~60s instead of ~300s. The
#                       cost is 5× the idle queries, all trivial; what it does
#                       NOT change is whether the Neon compute stays awake,
#                       since a 5-minute tick already sat on the auto-suspend
#                       boundary. If the compute bill ever argues otherwise,
#                       this integer is the knob.
#   PASSES            — after answering, re-list once. A reply typed WHILE the
#                       writer was working is already pending by the time it
#                       finishes, and catching it in the same run saves a whole
#                       tick. Bounded, because a two-person conversation could
#                       otherwise keep one run alive indefinitely.
#
# ── Why one claude call per model ────────────────────────────────────────────
#
# `--model` is a property of the SESSION, not of a message, so a single call
# cannot honour a queue whose asks chose different models. The run therefore
# groups the pending set by model and makes one call per group, each told to
# answer only its own ids. Before the `model` column existed the Hub's select
# changed nothing at all; honouring it halfway — by taking the first ask's
# choice for everyone — would have been the same lie with more steps.
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
	<integer>60</integer>
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
    echo "armed: $PLIST_LABEL every 60s (plist: $PLIST_PATH)"
}

do_uninstall() {
    launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "disarmed: $PLIST_LABEL"
}

do_status() {
    if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then
        echo "armed ($PLIST_LABEL, every 60s)"
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

# No overlap: a drain can outlive the 60-second tick while Claude writes.
mkdir "$LOCK_DIR" 2>/dev/null || { log "skip: lock held"; exit 0; }
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

cd "$REPO" || exit 0

if ! command -v claude >/dev/null 2>&1; then
    log "claude not on PATH — heartbeat only"
fi

# Answer files land outside the repo — a drain that writes into the working tree
# leaves .tmp-draft-*.txt lying around for the next session to trip over.
# TMPDIR is not in the launchd environment, so name the directory explicitly.
DRAFT_TMP="$CLAUDE_DIR/.draft-tmp"
mkdir -p "$DRAFT_TMP"

# At most two passes per run: the first drains what was queued, the second
# catches a reply typed while the first was writing. Beyond that the next
# 60-second tick is soon enough, and an unbounded loop would let two people
# talking keep one lock held for an hour.
PASSES=2

# The models a run may be asked for. An ask carrying anything else is answered
# on the session default rather than refused — an unknown id here means the
# engine's chain moved on, and a draft is not the place to litigate that.
KNOWN_MODELS="google-free claude-fable-5 claude-opus-4-8 claude-sonnet-5"

# `list` emits an ask's model only when one was chosen, so absent = "session
# default" and the two cases stay distinguishable. `default` is the sentinel for
# the no-model group; it is not passed to --model.
models_in() {
    printf '%s' "$1" | node -e '
        let d = "";
        process.stdin.on("data", (c) => (d += c)).on("end", () => {
            const known = process.argv[1].split(" ");
            const asks = JSON.parse(d);
            const groups = new Set(
                asks.map((a) => (known.includes(a.model) ? a.model : "default")),
            );
            console.log([...groups].join(" "));
        });
    ' "$KNOWN_MODELS" 2>/dev/null
}

ids_for() {
    printf '%s' "$1" | node -e '
        let d = "";
        process.stdin.on("data", (c) => (d += c)).on("end", () => {
            const known = process.argv[1].split(" ");
            const want = process.argv[2];
            const asks = JSON.parse(d).filter(
                (a) => (known.includes(a.model) ? a.model : "default") === want,
            );
            console.log(asks.map((a) => a.id).join(" "));
        });
    ' "$KNOWN_MODELS" "$2" 2>/dev/null
}

# The craft bar, the direction, and the corrections — the three things that make
# this a writer rather than a text generator. Assembled once and reused per
# model group so every group gets the same instructions and only the -p model
# differs.
#
# This prompt is the ONLY instruction the unattended writer gets, so it spends
# its budget on craft — the media rules already live in the skill's queue mode,
# in full, and duplicating them here once crowded the quality bar out entirely.
read -r -d '' PROMPT <<PROMPT_END || true
Run the /draft skill in queue mode. Answer ONLY these ask ids: __IDS__. Read them with 'node scripts/social-drafts.mjs list' and ignore every other row — another session is answering those on a different model.

Before writing the first ask, ONCE for the whole run:
  1. Read content/docs/social/copy.mdx and .claude/skills/draft/references/golden-set.md — the craft bar. Every draft is judged against the seven checks and the Arabic register ladder.
  2. Read content/social/scenes.json (doctrine: .claude/skills/draft/references/scene-bank.md) — concrete reader-week moments per brand and season, check 4's raw material. Ground a post in at most ONE scene it can honestly claim; never summarize docs (docs contain no Thursdays).
  3. Run 'node scripts/social-drafts.mjs lessons' — what reviewers actually rejected in the last 60 days, most common failure first. These are drafts a session already believed were finished. Whatever they have in common is the habit to break in THIS run; treat the top reason as the check you are most likely to fail again.

Then per ask read content/docs/brand.mdx and content/docs/social/<brand>.mdx for voice and audience.

Each ask carries its own direction. Obey it — it is a person's decision, not a hint:
  - "angle": pain | moment | proof — the angle is DECIDED. Still name the three in your log, but write the one asked for and do not substitute a better idea.
  - "register": a rung on copy.mdx's ladder — 2 simplified MSA, 3 pan-Arab colloquial, 4 local dialect. It overrides the rung the brand map prescribes.
  - "referenceAr": a post whose voice this one should echo. Match its rhythm, its sentence length, and its distance from the reader — never its subject, and never reuse its sentences.
  - "refine": this ask is the NEXT TURN of a draft a human just read. "instruction" is what they want changed; "previousAr"/"previousEn" is the exact text they read. Rewrite that text to satisfy the instruction and change NOTHING ELSE — keep the hook if the note is about length, keep the length if the note is about the hook. A refinement that quietly rewrites the whole post takes away the thing the reviewer already approved of, and they will have to find it again. If the instruction cannot be satisfied without breaking a craft check, do it their way and say which check it costs in --note.
  - "craftRefused": the fast Gemini lane already tried this ask and the craft gate refused both of its attempts — the field names the rules it tripped. Write fresh copy that avoids those failures by name; do not start from the refused draft (you never see it, and it was not worth keeping).

Copy that opens by describing the product, the feature, or the category is NOT FINISHED — rewrite the first line as a pain or a promise before answering. A bulleted feature list is two posts, not one. Do not summarize product documentation: docs contain no Thursdays, and a draft sourced from them will fail the scene check no matter how good the sentences are.

Write each answer's Arabic and English to temp files under $DRAFT_TMP and pass them with 'answer <id> --ar <file> --en <file>'; never write answer files into the repo. Media rules are in the skill's queue mode — follow them there, and never invent a URL. Every one of your assigned asks must end answered or failed — never left pending.

'answer' RUNS THE CRAFT GATE and will REFUSE a draft that trips copy.mdx's reject list, printing each failure by name. A refusal is not a failed ask: read the named failures, rewrite, and answer again. Two things it catches that a writer reliably misses — a number, date or price that is not in the brief, and a link without https:// (which would ship untagged). Do NOT pass --craft-override; it exists for a human who has read the findings and judged a rule wrong. If a draft still cannot pass after TWO rewrites, stop rewriting and 'fail <id> --note "craft gate: <the failures>"' — a rule that blocks correct copy is a bug worth a human's attention, and looping on it burns the run for every other ask.

Finally, print for each ask the three angles you considered and which one won: this log is the only record of why the copy went the way it did.
PROMPT_END

for pass in $(seq 1 $PASSES); do
    # Drain any google-free asks first via direct Gemini API
    node scripts/social-drafts.mjs drain-google >> "$LOG_FILE" 2>&1 || true

    # The list beats the heartbeat even when empty — that write is the whole
    # "somebody is watching the queue" signal.
    PENDING="$(node scripts/social-drafts.mjs list --json 2>>"$LOG_FILE")" || {
        log "list failed — check DATABASE_URL / network"; exit 0;
    }
    [ "$PENDING" = "[]" ] && { [ "$pass" -gt 1 ] && log "pass $pass: queue empty"; exit 0; }

    COUNT="$(printf '%s' "$PENDING" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).length))' 2>/dev/null || echo "?")"
    GROUPS="$(models_in "$PENDING")"
    log "pass $pass: $COUNT pending across models [${GROUPS:-default}]"

    for group in ${GROUPS:-default}; do
        IDS="$(ids_for "$PENDING" "$group")"
        [ -z "$IDS" ] && continue

        # Tools are allow-listed to exactly what queue mode needs: the queue
        # script, doc reads, and answer files. --max-turns caps a runaway session.
        ID_COUNT="$(printf '%s' "$IDS" | wc -w | tr -d ' ')"
        if [ "$group" = "default" ] || [ "$group" = "google-free" ]; then
            claude -p "${PROMPT//__IDS__/$IDS}" \
                --allowedTools "Bash(node scripts/social-drafts.mjs*)" "Read" "Write" "Glob" "Grep" \
                --max-turns 50 >> "$LOG_FILE" 2>&1
        else
            claude -p "${PROMPT//__IDS__/$IDS}" --model "$group" \
                --allowedTools "Bash(node scripts/social-drafts.mjs*)" "Read" "Write" "Glob" "Grep" \
                --max-turns 50 >> "$LOG_FILE" 2>&1
        fi
        # Captured on its own line: reading $? from inside a string that also
        # carries a command substitution depends on expansion order to stay true.
        CLAUDE_EXIT=$?
        log "pass $pass: model=$group ids=$ID_COUNT exit $CLAUDE_EXIT"
    done
done

# Post-drain list refreshes the heartbeat detail to the fresh count.
LEFT="$(node scripts/social-drafts.mjs list --json 2>/dev/null || echo '?')"
log "drain end: left $([ "$LEFT" = "[]" ] && echo 0 || echo "$LEFT" | head -c 40)"
exit 0
