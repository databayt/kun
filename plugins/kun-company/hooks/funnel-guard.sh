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
# Exit 2 BLOCKS and returns stderr to Claude. Exit 0 allows (warnings print).
# Deliberately narrow: read-only funnel commands run untouched.
#
# Canonical source: .claude/hooks/. Wired via ${CLAUDE_PROJECT_DIR} in project
# settings.json and bundled into the kun-company plugin.

set -uo pipefail

json="$(cat)"
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

# Only the funnel lane's write/send entrypoints. A plain read never matches.
FUNNEL_SEND='(funnel-(tick|drain)|drain-funnel|sendFunnelTouch|outreach-cadence|crm:(nudge|drain|funnel)|scripts/(crm|funnel)/(tick|drain|nudge))'
printf '%s' "$cmd" | grep -Eiq "$FUNNEL_SEND" || exit 0

# A dry run is always safe — this lane's default, and the guard stays out of its way.
printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--apply([[:space:]]|$)' || exit 0

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
