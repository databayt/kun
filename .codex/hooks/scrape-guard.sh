#!/usr/bin/env bash
# scrape-guard.sh — PreToolUse(Bash) guard for the lead-acquisition scrape lane.
#
# WHY THIS EXISTS
#
# TWO vectors reach a logged-in social session, and they look nothing alike:
#
#   1. The bespoke scraper drives Chrome over CDP on port 9222. On this machine
#      that port is the **session vault** — `~/.claude/bin/chrome-debug.sh`
#      launches ONE persistent Chrome at `~/.claude/chrome-debug-profile` which
#      is both the browser Abdout logs into by hand and the browser agents
#      attach to. Pointing a scraper at it means scraping as **Abdout
#      personally**. This vector IS inspectable — see WHAT IT CAN SEE below.
#   2. agent-reach's facebook/instagram channels are thin OpenCLI subclasses,
#      and OpenCLI drives the **real desktop Chrome** through a browser
#      extension talking to a local daemon on **127.0.0.1:19825**. No CDP port,
#      no --user-data-dir, nothing to read. This vector is NOT inspectable, and
#      what catches it is the FB_SCRAPE_PROFILE declaration rule.
#
# Do not "fix" the port checks to cover vector 2 — they structurally cannot.
# The declaration rule is the coverage, and it is the better rule anyway: a
# dedicated identity is the real requirement; the port was only ever a proxy.
#
# The cost of losing that account is not "re-log in later": it also loses the
# Page access tokens the entire social pipeline (draft → approve → publish)
# depends on. The approved plan says it plainly — "use a dedicated Facebook
# account, throttled — not Abdout's, whose loss would also cost the Page tokens
# the social pipeline depends on."
#
# WHAT IT CAN AND CANNOT SEE
#
# A shell hook cannot ask Chrome which Facebook user is signed in — CDP's
# /json/version exposes the browser build, never the profile or the account. So
# it checks the thing that IS checkable and is the actual failure mode: which
# **profile directory** backs the debugging port the run will attach to, read
# off the live Chrome process's own --user-data-dir. Session vault → block.
#
# Set these to run a scrape:
#   FB_SCRAPE_PORT=9333                                   # a port that is NOT the vault
#   FB_SCRAPE_PROFILE="$HOME/.claude/chrome-fbscrape-profile"
#   FB_SCRAPE_DELAY_MS=4000                               # throttle (warn if absent)
# Launch that profile once and log in as the dedicated account:
#   bash ~/.claude/bin/chrome-debug.sh 9333   # after pointing PROFILE at the above
#
# Exit 2 BLOCKS the call and returns stderr to Claude. Exit 0 allows (warnings
# still print). Deliberately narrow: only scrape entrypoints are matched, so
# ordinary `npx tsx scripts/crm/contact-gap.ts` (read-only) runs untouched.
#
# Canonical source: .claude/hooks/. Wired via ${CLAUDE_PROJECT_DIR} in project
# settings.json and bundled into the kun-company plugin.

set -uo pipefail

json="$(cat)"
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // .toolCall.args.CommandLine // empty' 2>/dev/null)"
[ -z "$cmd" ] && cmd="$json" # jq unavailable → scan the raw payload

# ── 1. Is this a scrape run at all? ──────────────────────────────
# Matched against BOTH the current fork path and the hogwarts path the plan
# relocates it to, so the guard survives the move. contact-gap / normalize-contacts
# are read-only and are NOT scrape entrypoints — they must never be blocked.
#
# Agent Reach (github.com/Panniantong/Agent-Reach) is covered here too, and it was
# added BEFORE the tool was installed rather than after. Its OpenCLI backend states
# plainly that it never logs in for you — it drives "the user's existing, explicitly
# controlled Chrome session." On this machine that session IS the vault on :9222.
# So `opencli facebook …` carries exactly the risk this guard was written for, while
# matching none of the bespoke entrypoints above. Adopting a new backend without
# extending the guard would silently reopen the hole it exists to close.
#
# MAINTENANCE: Agent Reach's whole design is that backends get swapped underneath
# you ("接入方式会换代"). When `agent-reach doctor --json` reports a NEW
# active_backend for facebook or instagram, add that binary here — the guard cannot
# discover it on its own. Scoped to the session-driving channels on purpose:
# `agent-reach doctor` / `install` / `check-update` are read-only or administrative
# and must stay unblocked, because a guard that cries wolf gets routed around.
# Scrapling (github.com/D4Vinci/Scrapling) is deliberately NOT matched wholesale.
# Its normal use is the opposite of risky: anonymous fetching of school websites
# and government registers with its own Playwright Chromium, no login, no account
# to lose. Blocking that would block the lane we actually want. Two shapes ARE
# matched, because they re-introduce the account risk:
#   • pointed at facebook/instagram — stealth fetching a platform we hold an
#     irreplaceable logged-in account on is the worst pairing available: evasion
#     raises the stakes of detection on exactly the account we cannot re-buy.
#   • attaching to an existing CDP endpoint (`cdp`/`9222`) — DynamicFetcher can
#     connect to a remote browser, and the remote browser here is the vault.
SCRAPE_ENTRYPOINTS='(sudan-schools-scraper|tier[0-9]+-[a-z]+|cdp-client|fb-matrix|dorker|enricher|scripts/crm/(scrape|discover|enrich|contact-hunt)|crm:(scrape|discover|enrich|matrix|dork|fb)|opencli[[:space:]]+(facebook|instagram)|agent-reach[[:space:]]+[a-z-]*[[:space:]]*(facebook|instagram)|scrapling[^;&|]*(facebook|instagram|cdp|9222))'
printf '%s' "$cmd" | grep -Eiq "$SCRAPE_ENTRYPOINTS" || exit 0

# ...and is it RUNNING one, rather than merely naming one?
#
# The entrypoint pattern matches command TEXT, so it also fired on `ls`, on
# `grep`, on `git add scripts/crm/enrich-fb-about.ts`, and even on a `git commit`
# whose message described the work. Blocking version control on a file is not
# what this guard is for, and a guard that cries wolf on `git add` is a guard
# people start routing around — which costs exactly the protection it exists to
# provide.
#
# A real scrape run always *executes* something. Requiring an execution verb
# keeps every genuine run matched (they are all `npx tsx …` / `node …` /
# `pnpm crm:…`) while letting inspection and version control through untouched.
#
# `opencli` and `agent-reach` are in this list because they are invoked as bare
# binaries — `opencli facebook profile …`, not `npx opencli …`. Without them the
# entrypoint patterns added above would match the text and then be discarded here,
# so the new coverage would silently never fire. A guard that looks present and
# does nothing is worse than no guard, so this pairing is tested, not assumed.
EXEC_VERBS='(^|[;&|]|[[:space:]])(npx|node|tsx|pnpm|npm|yarn|bun|deno|bash|sh|zsh|python3?(\.[0-9]+)?|uv|uvx|opencli|agent-reach|scrapling)([[:space:]]|$)'
printf '%s' "$cmd" | grep -Eq "$EXEC_VERBS" || exit 0

# ── 2. Which profile backs the port this run will attach to? ─────
port="${FB_SCRAPE_PORT:-9222}"
# An inline env assignment in the command itself wins over the ambient one.
inline_port="$(printf '%s' "$cmd" | grep -Eo 'FB_SCRAPE_PORT=[0-9]+' | tail -1 | cut -d= -f2)"
[ -n "$inline_port" ] && port="$inline_port"

VAULT_PROFILE="$HOME/.claude/chrome-debug-profile"

# Read --user-data-dir straight off the live Chrome process serving that port.
# This is ground truth: it is the profile the scraper WILL get, not the profile
# someone intended it to get.
live_profile="$(ps -axo command= 2>/dev/null \
  | grep -F -- "--remote-debugging-port=${port}" \
  | grep -v grep \
  | grep -Eo -- '--user-data-dir=[^ ]+' \
  | head -1 | cut -d= -f2-)"

block() {
  {
    echo "⛔ kun scrape-guard blocked a social scrape run."
    echo "   Reason : $1"
    echo
    # Only assert what was actually observed. There are TWO vectors and only one
    # of them has a CDP port to inspect, so claiming a port reading when none
    # exists is how a guard teaches people the wrong mental model.
    if [ -n "$live_profile" ]; then
      echo "   The CDP session on port ${port} is backed by:"
      echo "     ${live_profile}"
    else
      echo "   No Chrome is listening on port ${port}, so there was no profile to read."
    fi
    echo "   The session vault (${VAULT_PROFILE}) is ABDOUT'S OWN logged-in Chrome."
    echo "   Scraping as him risks the account — and with it the Page tokens the"
    echo "   whole social pipeline (draft → approve → publish) depends on."
    echo
    echo "   NOTE — the OpenCLI vector has no port at all. agent-reach's facebook/"
    echo "   instagram channels are thin OpenCLI subclasses, and OpenCLI drives your"
    echo "   REAL desktop Chrome through a browser extension talking to a local daemon"
    echo "   on 127.0.0.1:19825. There is no --user-data-dir to read and no CDP port"
    echo "   to inspect, so the profile check above cannot see it. What catches that"
    echo "   path is the FB_SCRAPE_PROFILE declaration rule — which is the right"
    echo "   ground to refuse on, because a dedicated identity is the actual"
    echo "   requirement and the port was only ever a proxy for it."
    echo
    echo "   Fix: run the scrape on a dedicated Facebook account, on its own port+profile."
    echo "     export FB_SCRAPE_PORT=9333"
    echo "     export FB_SCRAPE_PROFILE=\"\$HOME/.claude/chrome-fbscrape-profile\""
    echo "     export FB_SCRAPE_DELAY_MS=4000"
    echo "   Launch it once and log in as that account, then re-run."
    echo
    echo "   Before scraping at all: raw discovery is the measured low-yield lane"
    echo "   (the last full scrape run added 15 contactable rows). Read the live"
    echo "   split from contact-gap.json and .claude/agents/lead.md first — counts"
    echo "   are deliberately not hardcoded here, because they move weekly."
  } >&2
  exit 2
}

if [ -z "${FB_SCRAPE_PROFILE:-}" ] && ! printf '%s' "$cmd" | grep -q 'FB_SCRAPE_PROFILE='; then
  block "no dedicated scrape identity declared (FB_SCRAPE_PROFILE unset). For a CDP scraper this defaults to the shared session vault; for the agent-reach/OpenCLI path there is no port to inspect at all — it drives the real desktop Chrome via its extension daemon on 127.0.0.1:19825 — so this declaration is the only checkable signal that a dedicated account is in play"
fi

if [ -n "$live_profile" ] && [ "$live_profile" = "$VAULT_PROFILE" ]; then
  block "port ${port} is the shared session vault — Abdout's personal logged-in Chrome"
fi

if [ "$port" = "9222" ]; then
  block "port 9222 is the session-vault port; a dedicated scrape account needs its own port"
fi

# ── 3. Throttle: escalate to the human, do not block ─────────────
# An unthrottled run is a ban risk, not a data-loss risk, so it is not exit 2.
# But it used to be a stderr warning on exit 0, and that is invisible to the
# permission system: the call proceeds and the warning may reach nobody. The
# documented PreToolUse protocol has an escalation channel for exactly this
# shape of concern — `permissionDecision: "ask"` hands the decision to the human,
# who is the only one who can say "yes, I know, it is three rows".
#
# ACCEPTED COST: "ask" halts an unattended run instead of warning past it. That
# is deliberate — an unattended unthrottled scrape is precisely the case the old
# warning was too weak to stop.
#
# STDOUT PROTOCOL — load-bearing: the JSON below is the ONLY thing this script
# may ever write to stdout. Every other message in this file goes to stderr
# (>&2) and must stay there. One stray echo corrupts the decision object and the
# hook fails open silently, with no visible symptom. scrape-guard.test.sh exists
# to catch exactly that.
if [ -z "${FB_SCRAPE_DELAY_MS:-}" ] \
  && ! printf '%s' "$cmd" | grep -Eq 'FB_SCRAPE_DELAY_MS=|--(delay|throttle|sleep)[= ]'; then
  if [ -n "$(printf '%s' "$json" | jq -r '.toolCall // empty' 2>/dev/null)" ]; then
    printf '%s\n' '{"decision":"ask","reason":"kun scrape-guard: this run declares NO throttle. The platform rate-limits and then bans on burst patterns, and the ban lands on the ACCOUNT, not the IP — including the dedicated account this lane just spent effort standing up. Fix: export FB_SCRAPE_DELAY_MS=4000 (or pass --delay) and re-run. Approve only if you have deliberately chosen an unthrottled run."}'
  else
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"kun scrape-guard: this run declares NO throttle. The platform rate-limits and then bans on burst patterns, and the ban lands on the ACCOUNT, not the IP — including the dedicated account this lane just spent effort standing up. Fix: export FB_SCRAPE_DELAY_MS=4000 (or pass --delay) and re-run. Approve only if you have deliberately chosen an unthrottled run."}}'
  fi
  exit 0
fi

exit 0
