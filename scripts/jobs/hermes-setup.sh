#!/usr/bin/env bash
# ── Wire Hermes to the jobs lane: quick commands from WhatsApp / Slack ───────
#
#   bash scripts/jobs/hermes-setup.sh          install/refresh, restart the gateway
#   bash scripts/jobs/hermes-setup.sh --check  print what is installed, change nothing
#
# Hermes' model login has been dead since 2026-09-13 and the engine is
# subscription-only (no API keys), so nothing here calls a model: these are
# `quick_commands` of type exec — a slash command runs a fixed shell command in
# the gateway and replies with its output (no arguments, 30s limit). Typed in
# Abdout's WhatsApp self-chat or a Slack DM to the bot:
#
#   /jobs          status: last 7 days, today, queued, held (scripts/jobs/brief.ts)
#   /jobsqueue     what goes out next — veto by moving the card to Hold
#   /jobsreplies   real replies in the last 14 days
#   /jobspause     kill switch on (nothing sends)   /jobsresume  kill switch off
#
# The CRM board stays the single source of truth; these only read it or flip
# the loop's kill switch. Idempotent: rewrites only the quick_commands block
# of ~/.hermes/config.yaml (comments elsewhere survive; a dated .bak is kept).

set -euo pipefail
KUN="$(cd "$(dirname "$0")/../.." && pwd)"
PY="$HOME/.hermes/hermes-agent/venv/bin/python"
CFG="$HOME/.hermes/config.yaml"
RUN="cd $KUN && PATH=/opt/homebrew/bin:/usr/local/bin:\$PATH"

[ -x "$PY" ] || { echo "Hermes not installed ($PY missing)"; exit 1; }

"$PY" - "$CFG" "$RUN" "${1:-}" <<'PY'
import sys, yaml
cfg_path, run, mode = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = yaml.safe_load(open(cfg_path)) or {}
want = {
    "jobs":        f"{run} ./node_modules/.bin/tsx scripts/jobs/brief.ts",
    "jobsqueue":   f"{run} ./node_modules/.bin/tsx scripts/jobs/brief.ts queue",
    "jobsreplies": f"{run} ./node_modules/.bin/tsx scripts/jobs/brief.ts replies",
    "jobsweek":    f"{run} ./node_modules/.bin/tsx scripts/jobs/brief.ts week",
    "jobspause":   f"{run} bash scripts/jobs/loop.sh --pause && echo 'Jobs loop paused — nothing sends until /jobsresume.'",
    "jobsresume":  f"{run} bash scripts/jobs/loop.sh --resume && echo 'Jobs loop resumed.'",
}
qc = cfg.get("quick_commands") or {}
if mode == "--check":
    for k in want:
        print(f"/{k}: {'installed' if k in qc else 'missing'}")
    sys.exit(0)
qc.update({k: {"type": "exec", "command": c} for k, c in want.items()})
# Rewrite only the top-level quick_commands block, as text: a YAML dump would
# drop every comment in the hand-kept config (the WhatsApp/Slack notes).
block = yaml.safe_dump({"quick_commands": qc}, sort_keys=False, allow_unicode=True, width=1000)
lines = open(cfg_path).read().split("\n")
out, skip = [], False
for line in lines:
    if line.startswith("# jobs lane — managed by kun"):
        continue
    if line.startswith("quick_commands:"):
        skip = True
        continue
    if skip and (line.startswith(" ") or line == ""):
        continue
    skip = False
    out.append(line)
import shutil, datetime
import os
bak = f"{cfg_path}.bak-jobs-{datetime.date.today()}"
if not os.path.exists(bak):  # keep the first (pre-change) copy of the day
    shutil.copy(cfg_path, bak)
open(cfg_path, "w").write("\n".join(out).rstrip("\n") + "\n\n# jobs lane — managed by kun scripts/jobs/hermes-setup.sh\n" + block)
assert (yaml.safe_load(open(cfg_path)) or {}).get("quick_commands", {}).keys() >= want.keys()
print("quick_commands:", ", ".join("/" + k for k in want))
PY

[ "${1:-}" = "--check" ] && exit 0
launchctl kickstart -k "gui/$(id -u)/ai.hermes.gateway" && echo "gateway restarted"
