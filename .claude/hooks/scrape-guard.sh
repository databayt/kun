#!/usr/bin/env bash
# scrape-guard.sh — PreToolUse(Bash) guard for the lead-acquisition scrape lane.
#
# WHY THIS EXISTS
#
# The Facebook scraper drives a logged-in Chrome over CDP on port 9222. On this
# machine that port is the **session vault** — `~/.claude/bin/chrome-debug.sh`
# launches ONE persistent Chrome at `~/.claude/chrome-debug-profile` which is
# both the browser Abdout logs into by hand and the browser agents attach to.
# Pointing the scraper at it means scraping Facebook as **Abdout personally**.
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
cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // empty' 2>/dev/null)"
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
SCRAPE_ENTRYPOINTS='(sudan-schools-scraper|tier[0-9]+-[a-z]+|cdp-client|fb-matrix|dorker|enricher|scripts/crm/(scrape|discover|enrich|contact-hunt)|crm:(scrape|discover|enrich|matrix|dork|fb)|opencli[[:space:]]+(facebook|instagram)|agent-reach[[:space:]]+[a-z-]*[[:space:]]*(facebook|instagram))'
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
EXEC_VERBS='(^|[;&|]|[[:space:]])(npx|node|tsx|pnpm|npm|yarn|bun|deno|bash|sh|zsh|python3?|opencli|agent-reach)([[:space:]]|$)'
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
    echo "⛔ kun scrape-guard blocked a Facebook scrape run."
    echo "   Reason : $1"
    echo
    echo "   The CDP session on port ${port} is backed by:"
    echo "     ${live_profile:-<no Chrome listening on that port>}"
    echo "   The session vault (${VAULT_PROFILE}) is ABDOUT'S OWN logged-in Chrome."
    echo "   Scraping Facebook as him risks the account — and with it the Page tokens"
    echo "   the whole social pipeline (draft → approve → publish) depends on."
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
  block "no dedicated scrape profile declared (FB_SCRAPE_PROFILE unset), so this run defaults to the shared session vault"
fi

if [ -n "$live_profile" ] && [ "$live_profile" = "$VAULT_PROFILE" ]; then
  block "port ${port} is the shared session vault — Abdout's personal logged-in Chrome"
fi

if [ "$port" = "9222" ]; then
  block "port 9222 is the session-vault port; a dedicated scrape account needs its own port"
fi

# ── 3. Throttle: warn, do not block ──────────────────────────────
# An unthrottled run is a ban risk, not a data-loss risk, so it is a warning —
# but a loud one, because the account it burns is the dedicated one we just
# spent effort standing up.
if [ -z "${FB_SCRAPE_DELAY_MS:-}" ] \
  && ! printf '%s' "$cmd" | grep -Eq 'FB_SCRAPE_DELAY_MS=|--(delay|throttle|sleep)[= ]'; then
  {
    echo "⚠️  kun scrape-guard: this scrape run declares NO throttle."
    echo "   Facebook rate-limits and then bans on burst patterns; the ban lands on the"
    echo "   account, not the IP. Set FB_SCRAPE_DELAY_MS (4000+) or pass --delay."
    echo "   Allowing the run — this is a warning, not a block."
  } >&2
fi

exit 0
