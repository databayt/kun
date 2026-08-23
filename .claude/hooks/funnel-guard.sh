#!/usr/bin/env bash
# funnel-guard.sh — PreToolUse(Bash) guard for the conversion lane's send path.
#
# WHY THIS EXISTS
#
# Every other stage of this lane reads. The drain puts text in front of a real
# school principal, and the two ways it goes wrong are both silent:
#
#   1. An UNSEGMENTED apply sends one message to every band at once. The whole
#      design exists so that the guide a 60-student village school receives is
#      not the guide a 1,200-student Abu Dhabi school receives. An apply with no
#      --segment is precisely the "random" the funnel was drawn backwards to
#      prevent, and it looks like success while it burns the list.
#   2. A drafted touch sent WITHOUT a recorded human yes. Templated touches
#      (1-2) are reviewed once at template-time; drafted touches (3+) are
#      written per-cohort by a model and have never been read by a person. The
#      approve queue is the whole safety story for the copy this lane sends.
#
# WHAT IT CANNOT SEE
#
# It cannot verify an approval row — that lives in hogwarts' Postgres and a
# PreToolUse hook must not make a network round-trip on every command. So it
# checks what IS checkable from the command line: that a send-shaped apply
# carries a segment, and that an explicit drain names its approval source. The
# database-side check is the sender's job; this is the cheap outer fence.
#
# WHY IT IS NARROWER THAN IT LOOKS
#
# The first version matched the whole command text for an entrypoint and the
# apply flag anywhere in it. That blocked its own author three times inside one
# hour — a heredoc writing a refusal message, a patch script quoting the flag, a
# test fixture listing commands. All three were AUTHORING, not sending. A guard
# that cries wolf while you work on the thing it guards is one people learn to
# route around, which is strictly worse than no guard at all. So it now demands
# three things together on ONE line: an entrypoint, the flag, and a runner —
# and it stands down entirely for commands that write files.
#
# Exit 2 BLOCKS and returns stderr to Claude. Exit 0 allows (warnings print).
#
# Smoke-tested, not just syntax-checked: see the case table in the session
# scratchpad. It runs on every Bash call in every kun session, so "bash -n
# passes" was never a sufficient bar.
#
# Canonical source: .claude/hooks/. Wired via ${CLAUDE_PROJECT_DIR} in project
# settings.json and bundled into the kun-company plugin.

set -uo pipefail

json="$(cat)"
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // .toolCall.args.CommandLine // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

# ── A heredoc body is data, not a command ─────────────────────────────────────
# Strip every heredoc body before matching. This is the precise fix for the
# false positives: a script being WRITTEN — a refusal message quoting the flag,
# a patch, a fixture listing commands — lives inside a heredoc, and matching it
# blocked this guard's own author repeatedly. The opener line survives (it is a
# real command), only the body is dropped, so nothing real is weakened.
cmd="$(printf '%s\n' "$cmd" | awk '
  !inhd && match($0, /<<-?[[:space:]]*"?'"'"'?[A-Za-z_][A-Za-z0-9_]*/) {
    tag = substr($0, RSTART, RLENGTH)
    sub(/^<<-?[[:space:]]*"?'"'"'?/, "", tag)
    inhd = 1; hdtag = tag; print; next
  }
  inhd { if ($0 ~ "^[[:space:]]*" hdtag "[[:space:]]*$") inhd = 0; next }
  { print }
')"

# Only the funnel lane's write/send entrypoints. A plain read never matches.
FUNNEL_SEND='(funnel-(tick|drain)|drain-funnel|sendFunnelTouch|outreach-cadence|crm:(nudge|drain|funnel)|scripts/(crm|funnel)/(tick|drain|nudge))'

# A send is an INVOCATION: an entrypoint, the apply flag, and a runner, together
# in ONE pipeline segment. Judging a whole multi-line command is what produced
# the false positives — text on line 40 is data, not an argument to line 3.
RUNNER='(^|[[:space:]])(npx|pnpm|yarn|bun|node|tsx|bash|sh|\./)'

# Authoring is not sending — but this must NEVER short-circuit the whole command.
# An earlier version bailed globally the moment any segment looked like authoring,
# which meant `echo go && <real unsafe send>` sailed straight through: a one-word
# prefix disabled the guard. So the filter drops only the offending SEGMENT, and
# every other segment stays eligible to block.
AUTHORING_SEG='^[[:space:]]*(python3?|cat|sed|awk|tee|perl|printf|echo)([[:space:]]|$)'

send_lines="$(printf '%s\n' "$cmd" \
  | sed -E 's/(&&|\|\||;|\|)/\n/g' \
  | grep -Ei "$FUNNEL_SEND" \
  | grep -E '(^|[[:space:]])--apply([[:space:]]|$)' \
  | grep -E "$RUNNER" \
  | grep -Ev "$AUTHORING_SEG")"
[ -z "$send_lines" ] && exit 0

# From here on judge only the offending invocation(s), never the whole script.
cmd="$send_lines"

# ── 1. An apply that sends must name a segment ────────────────────────────────
if ! printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--segment[=[:space:]]'; then
  cat >&2 <<'MSG'
BLOCKED: funnel --apply with no --segment.

An unsegmented apply sends the same message to every band, rail and authority at
once. This lane was designed backwards from the sale specifically so that the
asset a 60-student school receives is not the asset a 1,200-student school
receives — sending one blast erases that and looks like success while it does it.

Fix the run, don't route around the guard:
  --segment=owner-mid-sd-now        one cohort
  --segment='owner-*'               a glob, still deliberate
Or drop --apply and read the plan first.
MSG
  exit 2
fi

# ── 2. A drain must name where its human approval came from ───────────────────
if printf '%s' "$cmd" | grep -Eiq '(drain|nudge)' &&
   ! printf '%s' "$cmd" | grep -Eq '(--approved-by[=[:space:]]|--templated-only([[:space:]]|$))'; then
  cat >&2 <<'MSG'
BLOCKED: funnel drain --apply without an approval source.

Touches 1-2 are templated and may send unattended. Touches 3+ are drafted per
cohort on the Max pool and have never been read by a person — the approve queue
is the entire safety story for that copy.

Name which it is:
  --templated-only                  sends only touches 1-2
  --approved-by=<member-id>         drains the approved queue on someone's authority
MSG
  exit 2
fi

# ── Warnings (allow, but say it) ──────────────────────────────────────────────
if ! printf '%s' "$cmd" | grep -Eq 'FUNNEL_SEND=|--limit[=[:space:]]'; then
  printf 'funnel-guard: no --limit and no FUNNEL_SEND kill switch in scope. The warm-up ramp is 10/day week 1 → 20 → 30; an unbounded send is how a number gets banned.\n' >&2
fi

exit 0
