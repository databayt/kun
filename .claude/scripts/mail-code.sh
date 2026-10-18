#!/usr/bin/env bash
# mail-code.sh — pull ONE verification code or link out of Abdout's inbox.
#
#   mail-code.sh [--from <domain|text>] [--to <address>] [--minutes 15] [--wait 180] [--account <email>]
#
# Reads hotmail through Mail.app (scripts/seek/mail-read.applescript; INBOX +
# Junk). Prints only the newest match — `code: 123456` or `link: https://…` —
# never a whole email. Exit 1 when nothing matched before --wait ran out.
# Used by the `behalf` skill to finish sign-ups without asking Abdout.
set -euo pipefail

ACCOUNT="osmanabdout@hotmail.com"
FROM=""
TO=""
MINUTES=15
WAIT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="$2"; shift 2 ;;
    --to) TO="$2"; shift 2 ;;
    --minutes) MINUTES="$2"; shift 2 ;;
    --wait) WAIT="$2"; shift 2 ;;
    --account) ACCOUNT="$2"; shift 2 ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

KUN_DIR="${KUN_DIR:-$HOME/kun}"
READER="$KUN_DIR/scripts/seek/mail-read.applescript"
[ -f "$READER" ] || { echo "missing $READER" >&2; exit 2; }

HOURS=$(( (MINUTES + 59) / 60 ))
deadline=$(( $(date +%s) + WAIT ))

scan() {
  # Nudge Mail.app to fetch, then read. The reader prints records joined by
  # ASCII 30 with fields joined by ASCII 31: sender, subject, date, body.
  osascript -e 'tell application "Mail" to check for new mail' >/dev/null 2>&1 || true
  osascript "$READER" "$ACCOUNT" "$HOURS" 2>/dev/null | \
    FROM="$FROM" TO="$TO" MINUTES="$MINUTES" python3 -c '
import os, re, sys
from datetime import datetime, timedelta

raw = sys.stdin.read()
want_from = os.environ["FROM"].lower()
want_to = os.environ["TO"].lower()
cutoff = datetime.now() - timedelta(minutes=int(os.environ["MINUTES"]))

def when(s):
    for fmt in ("%Y-%m-%d %I:%M:%S %p", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s.strip().replace(" ", " "), fmt)
        except ValueError:
            pass
    return None

LINK = re.compile(r"https?://[^\s<>\"\x27)]+", re.I)
LINK_HINT = re.compile(r"verif|confirm|activat|validat|token|signup|register|magic|auth", re.I)
CODE_CTX = re.compile(r"(?:code|otp|pin|verification|one[- ]time|رمز)[^\d]{0,40}(\d{4,8})\b|\b(\d{4,8})\b[^\d]{0,40}(?:is your|code)", re.I)

hits = []
for rec in raw.split("\x1e"):
    f = rec.split("\x1f")
    if len(f) < 4:
        continue
    sender, subject, date, body = f[0], f[1], f[2], f[3]
    if want_from and want_from not in (sender + " " + subject).lower():
        continue
    # Mail.app gives the reader no recipient field; a +alias is usually echoed in the body.
    if want_to and want_to not in body.lower():
        continue
    d = when(date)
    if d and d < cutoff:
        continue
    text = subject + "\n" + body
    m = CODE_CTX.search(text)
    if m:
        hits.append((d or datetime.min, "code", m.group(1) or m.group(2)))
        continue
    links = [u.rstrip(".,;") for u in LINK.findall(body) if LINK_HINT.search(u)]
    if links:
        hits.append((d or datetime.min, "link", links[0]))

if hits:
    hits.sort(key=lambda h: h[0])
    _, kind, value = hits[-1]
    print(f"{kind}: {value}")
'
}

while :; do
  out="$(scan || true)"
  if [ -n "$out" ]; then echo "$out"; exit 0; fi
  [ "$(date +%s)" -ge "$deadline" ] && break
  sleep 10
done
echo "no code or link from '${FROM:-anyone}' in the last ${MINUTES} min" >&2
exit 1
