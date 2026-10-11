#!/usr/bin/env bash
# The textbook loop: every night, move the next curriculum textbook one step closer to a
# verified Markdown twin, and publish it the moment it passes the twin gate.
#
#   bash scripts/textbook/loop.sh --tick [--force] [--pages N] [--subject S]   one step (what launchd calls)
#   bash scripts/textbook/loop.sh --next          print the subject the next tick would work on
#   bash scripts/textbook/loop.sh --weekly        run the Sunday presets-proposal step now
#   bash scripts/textbook/loop.sh --install       arm launchd com.databayt.textbook-loop (daily 01:30)
#   bash scripts/textbook/loop.sh --uninstall
#   bash scripts/textbook/loop.sh --status        armed? the grade's twin table, the last log lines
#   bash scripts/textbook/loop.sh --pause         kill switch on  (touch ~/catalog/.work/.textbook-off)
#   bash scripts/textbook/loop.sh --resume        kill switch off
#
# Policy lives in .claude/engine.json → textbook.loop (curriculum, grade order, priority,
# pages per tick, window, model, tracking issue). A tick:
#   1. senses — `pnpm twins <cur> --grade <g> --json --cdn` in the catalog (0 tokens)
#   2. picks  — a book already in progress in .work, else the first unverified book in
#               priority order; when every subject in the grade passes the twin gate, the next grade
#   3. stages — catalog/<cur>/<g>/<s> → catalog/.work/<cur>/<g>/<s> (clones: cp -c)
#   4. works  — `claude -p` runs the textbook workflow, capped at pages_per_tick NEW pages; a book
#               whose pages are all on disk is verified + adjudicated + persisted in the same call
#   5. lands  — scripts/textbook/land.sh: publish when the twin gate passes (0 tokens)
#   6. tells  — one comment on the tracking issue: the subject, pages done, agreement, published?
# Sundays it also distils the contracts' observed cases into presets proposals (textbook-contract.py
# --promote), so what one book taught the adjudicator reaches the next book's contract.
set -u
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
CATALOG="${CATALOG:-$HOME/catalog}"
SCRIPTS="$HOME/.claude/skills/textbook/scripts"
LOG_DIR="$HOME/.claude/logs"
LOCK="$HOME/.claude/.textbook-loop.lock"
KILL="$CATALOG/.work/.textbook-off"
STATE="$CATALOG/.work/.textbook-loop"
PLIST_LABEL="com.databayt.textbook-loop"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
mkdir -p "$LOG_DIR" "$STATE"
LOG_FILE="$LOG_DIR/textbook-loop-$(date +%F).log"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

MODE="${1:---tick}"; shift || true
FORCE=0; PAGES_OVERRIDE=""; SUBJECT_OVERRIDE=""
while [ $# -gt 0 ]; do
    case "$1" in
        --force) FORCE=1 ;;
        --pages) PAGES_OVERRIDE="$2"; shift ;;
        --subject) SUBJECT_OVERRIDE="$2"; shift ;;
    esac
    shift
done

# engine.json → textbook.loop, one value per call
cfg() { python3 -c "import json,sys;c=json.load(open('$REPO/.claude/engine.json'))['textbook']['loop'];v=c$1;print(' '.join(v) if isinstance(v,list) else v)"; }
CUR="$(cfg "['curriculum']")"
GRADES="$(cfg "['grades']")"
PAGES_PER_TICK="${PAGES_OVERRIDE:-$(cfg "['pages_per_tick']")}"
SAMPLE="$(cfg "['sample_pages']")"
MODEL="$(cfg "['model']")"; AUDIT_MODEL="$(cfg "['audit_model']")"; ADJ_MODEL="$(cfg "['adjudicate_model']")"
WIN_START="$(cfg "['window'][0]")"; WIN_END="$(cfg "['window'][1]")"
ISSUE_REPO="$(cfg "['issue']['repo']")"; ISSUE_TITLE="$(cfg "['issue']['title']")"

# ── pick ──────────────────────────────────────────────────────────────────────
# Prints "<grade> <subject> <reason>" or nothing when every configured grade is done.
pick() {
    for g in $GRADES; do
        ( cd "$CATALOG" && pnpm -s twins "$CUR" --grade "$g" --json --cdn >/dev/null 2>&1 ) || true
        local f="$CATALOG/.work/twins/$CUR-$g.json"
        [ -f "$f" ] || continue
        local p
        p=$(SUBJ="$SUBJECT_OVERRIDE" python3 - "$f" "$REPO/.claude/engine.json" "$CATALOG/.work/$CUR/$g" <<'PY'
import json, os, sys
twins = json.load(open(sys.argv[1]))["twins"]
loop = json.load(open(sys.argv[2]))["textbook"]["loop"]
work = sys.argv[3]
only = os.environ.get("SUBJ") or ""
open_ = [t for t in twins if not t["twinGate"] and t["pdf"]["locked"] and (not only or t["subject"] == only)]
if not open_:
    sys.exit(0)
def on_disk(s):
    d = os.path.join(work, s, "pages-md")
    return len([f for f in os.listdir(d) if f[:1].isdigit() and f.endswith(".md")]) if os.path.isdir(d) else 0
# 1. a book already in progress — finish what was started before opening another
started = sorted(((on_disk(t["subject"]), t) for t in open_ if on_disk(t["subject"])), key=lambda x: -x[0])
if started:
    n, t = started[0]
    print(t["grade"], t["subject"], f"in-progress {n}/{t['pages']}")
    sys.exit(0)
# 2. priority: extraction kinds in engine order (worst text first), then fewer pages first
rank = {k: i for i, k in enumerate(loop["priority"])}
open_.sort(key=lambda t: (rank.get(t["extraction"], len(rank)), t["pages"] or 9999, t["subject"]))
t = open_[0]
print(t["grade"], t["subject"], f"next ({t['extraction']}, {t['pages']} pages)")
PY
)
        [ -n "$p" ] && { echo "$p"; return; }
    done
}

# ── stage ─────────────────────────────────────────────────────────────────────
stage() {  # stage <grade> <subject> — the inputs only; a book in progress keeps its pages-md
    local C="$CATALOG/$CUR/$1/$2" W="$CATALOG/.work/$CUR/$1/$2"
    mkdir -p "$W"
    [ -f "$C/textbook.pdf" ] || ( cd "$CATALOG" && pnpm -s assets pull "$CUR/$1/$2" >/dev/null )
    for f in textbook.pdf structure.json; do [ -f "$W/$f" ] || cp -c "$C/$f" "$W/$f"; done
    if [ ! -d "$W/pages" ] && [ -d "$C/pages" ]; then cp -Rc "$C/pages" "$W/pages"; fi
}

# ── report ────────────────────────────────────────────────────────────────────
report() {  # report <markdown body> — one comment on the tracking issue (created on first use)
    local n
    n=$(gh issue list --repo "$ISSUE_REPO" --state open --search "\"$ISSUE_TITLE\" in:title" --json number -q '.[0].number' 2>/dev/null)
    if [ -z "$n" ]; then
        n=$(gh issue create --repo "$ISSUE_REPO" --title "$ISSUE_TITLE" \
            --body "Tracking issue for kun's textbook loop (\`scripts/textbook/loop.sh\`, launchd \`$PLIST_LABEL\`). One comment per tick. Policy: kun \`.claude/engine.json → textbook.loop\`. Kill switch: \`bash scripts/textbook/loop.sh --pause\`." 2>/dev/null | grep -o '[0-9]*$')
    fi
    [ -n "$n" ] && gh issue comment "$n" --repo "$ISSUE_REPO" --body "$1" >/dev/null 2>&1 && log "reported on $ISSUE_REPO#$n"
}

# ── weekly: contracts teach the presets ───────────────────────────────────────
weekly() {
    local week; week="$(date +%G-W%V)"
    [ "$(cat "$STATE/weekly" 2>/dev/null)" = "$week" ] && return
    [ "$(date +%u)" = 7 ] || [ "$FORCE" = 1 ] || return
    # Outside .claude/: a headless session may not write there (protected config path) — the
    # first Sunday run, 2026-10-11, did all the work and could not save it.
    local cand="$STATE/promote-candidates-$week.json" prop="$STATE/promote-proposals-$week.md"
    log "▶ weekly promote"
    python3 "$SCRIPTS/textbook-contract.py" --promote "$CATALOG" --presets "$SCRIPTS/presets.json" --out "$cand" >> "$LOG_FILE" 2>&1
    claude -p "You maintain kun's textbook transcription presets. Read $cand (observed cases from every catalog book's contract that no preset clause cites yet, grouped by book with its subject kinds) and $SCRIPTS/presets.json. Write $prop in Markdown: a table of proposed NEW clauses (id, kind, rule <= 60 words, evidence book:page refs from >= 2 DIFFERENT books) — a case seen in one book stays per-book and is not proposed; then 'Contested across books' (books disagree — needs a decision) and 'Contradictions inside one contract'. Do not edit presets.json. Reply DONE." \
        --model opus --allowedTools Read Write Glob --max-turns 30 >> "$LOG_FILE" 2>&1
    echo "$week" > "$STATE/weekly"
    if [ -s "$prop" ]; then
        report "**Weekly presets proposals ($week)** — adopt a clause into \`skills/textbook/scripts/presets.json\` only after a \`textbook bench\` run shows no drop.

$(head -c 60000 "$prop")"
    else
        log "weekly: no proposals file written"
    fi
}

# ── tick ──────────────────────────────────────────────────────────────────────
tick() {
    [ -f "$KILL" ] && { log "paused (kill switch $KILL)"; return 0; }
    local hour; hour=$((10#$(date +%H)))
    if [ "$FORCE" = 0 ] && ! { [ "$hour" -ge "$WIN_START" ] && [ "$hour" -lt "$WIN_END" ]; }; then
        log "outside the window ${WIN_START}:00–${WIN_END}:00 — use --force"; return 0
    fi
    if ! mkdir "$LOCK" 2>/dev/null; then log "another tick holds $LOCK"; return 0; fi
    trap 'rmdir "$LOCK" 2>/dev/null' EXIT

    local pk; pk="$(pick)"
    if [ -z "$pk" ]; then log "nothing to do — every subject in [$GRADES] passes the twin gate"; weekly; return 0; fi
    read -r G S REASON <<<"$pk"
    log "▶ $CUR-$G-$S — $REASON (cap $PAGES_PER_TICK new pages, model $MODEL)"
    stage "$G" "$S"
    local W="$CATALOG/.work/$CUR/$G/$S"
    local before; before=$(find "$W/pages-md" -maxdepth 1 -name '[0-9]*.md' 2>/dev/null | wc -l | tr -d ' ')
    local seed=$(( $(date +%j) % 89 + 11 ))

    # The prompt names the workflow explicitly: that is the multi-agent opt-in for a headless run.
    ( cd "$REPO" && claude -p "Run the textbook workflow now: Workflow({ name: \"textbook\", args: { book: \"$W\", mode: \"full\", maxPages: $PAGES_PER_TICK, sample: $SAMPLE, seed: $seed, model: \"$MODEL\", auditModel: \"$AUDIT_MODEL\", adjudicateModel: \"$ADJ_MODEL\", date: \"$(date +%F)\" } }). This is the nightly textbook loop. Wait for the workflow's completion notification, then reply with ONE line: the result's partial/transcribed/pages/agreement fields. Do not land, upload, commit or publish — the loop script does that." \
        --model "$MODEL" --dangerously-skip-permissions --max-turns 40 ) >> "$LOG_FILE" 2>&1
    local rc=$?
    local after; after=$(find "$W/pages-md" -maxdepth 1 -name '[0-9]*.md' 2>/dev/null | wc -l | tr -d ' ')
    log "◀ claude exit $rc — pages on disk $before → $after"

    local landed="no" agr="—"
    if [ -f "$W/pages-md-verify/run.json" ] && [ "$W/pages-md-verify/run.json" -nt "$LOCK" ]; then
        agr=$(python3 -c "import json;print(json.load(open('$W/pages-md-verify/run.json')).get('agreement'))")
        bash "$REPO/scripts/textbook/land.sh" "$CUR" "$G" "$S" >> "$LOG_FILE" 2>&1
        case $? in 0) landed="yes — published";; 4) landed="no — twin gate failed, reverted";; *) landed="no — see log";; esac
    fi
    log "◀ $CUR-$G-$S: pages $after, agreement $agr, landed: $landed"
    report "**$CUR-$G-$S** · $(date +%F) · $REASON
- pages on disk: $before → $after (cap $PAGES_PER_TICK/tick, model $MODEL, claude exit $rc)
- agreement: $agr · landed: $landed
- URLs: https://cdn.databayt.org/catalog/$CUR/$G/$S/textbook.pdf · …/textbook.md"
    weekly
}

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
		<string>$REPO/scripts/textbook/loop.sh</string>
		<string>--tick</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>$WIN_START</integer>
		<key>Minute</key>
		<integer>30</integer>
	</dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string>
		<key>DISABLE_AUTOUPDATER</key>
		<string>1</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/textbook-loop-launchd.out</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/textbook-loop-launchd.err</string>
</dict>
</plist>
PLIST
}

case "$MODE" in
    --tick) tick ;;
    --next) pick || true ;;
    --weekly) FORCE=1; rm -f "$STATE/weekly"; weekly ;;
    --install)
        mkdir -p "$HOME/Library/LaunchAgents"
        render_plist > "$PLIST_PATH"
        launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
        launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH"
        echo "armed: $PLIST_LABEL daily at $WIN_START:30 (plist: $PLIST_PATH)"
        ;;
    --uninstall)
        launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
        rm -f "$PLIST_PATH"; echo "disarmed: $PLIST_LABEL"
        ;;
    --pause) touch "$KILL"; echo "paused ($KILL)" ;;
    --resume) rm -f "$KILL"; echo "resumed" ;;
    --status)
        if launchctl print "gui/$(id -u)/$PLIST_LABEL" >/dev/null 2>&1; then echo "armed ($PLIST_LABEL, daily $WIN_START:30)"; else echo "not armed"; fi
        [ -f "$KILL" ] && echo "⛔ paused ($KILL)"
        for g in $GRADES; do ( cd "$CATALOG" && pnpm -s twins "$CUR" --grade "$g" | tail -4 | head -1 ); done
        echo "next: $(pick)"
        tail -5 "$LOG_FILE" 2>/dev/null
        ;;
    *) echo "Unknown flag: $MODE (use --tick|--next|--weekly|--install|--uninstall|--status|--pause|--resume)" >&2; exit 1 ;;
esac
