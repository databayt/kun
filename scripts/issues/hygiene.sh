#!/bin/bash
# Queue hygiene — one priority scheme, and a list of what has gone quiet.
#
#   bash scripts/issues/hygiene.sh [owner/repo] [--apply] [--stale-days N]
#
# Default is a dry run: it prints what it WOULD relabel and what is stale.
#   --apply  relabels only (legacy P0-critical..P3-low → priority/p0..p3). It never
#            closes or comments — closing stale issues is Abdout's call (reject = close
#            as not planned with a one-line reason, per the report rule).
# Canonical priority scheme: priority/p0..p3 — the one the automated writers
# (domains probe, report pipeline) already use. Orchestration plan item 3, 2026-11-01.
set -u
REPO="databayt/kun"; APPLY=0; STALE_DAYS=30
while [ $# -gt 0 ]; do
    case "$1" in
        --apply) APPLY=1 ;;
        --stale-days) STALE_DAYS="$2"; shift ;;
        */*) REPO="$1" ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
    shift
done
command -v gh >/dev/null 2>&1 || { echo "gh not installed" >&2; exit 1; }

JSON=$(gh issue list --repo "$REPO" --state open --limit 500 --json number,title,updatedAt,labels) || exit 1

PLAN=$(ISSUES_JSON="$JSON" python3 - "$STALE_DAYS" <<'PY'
import json, os, sys, time, calendar
issues = json.loads(os.environ["ISSUES_JSON"]); stale_days = int(sys.argv[1]); now = time.time()
legacy = {"P0-critical": "priority/p0", "P1-high": "priority/p1", "P2-medium": "priority/p2", "P3-low": "priority/p3"}
relabel, nopri, stale = [], [], []
for i in issues:
    names = {l["name"] for l in i["labels"]}
    for old, new in legacy.items():
        if old in names:
            relabel.append((i["number"], old, new, new in names))
    if not any(n.startswith("priority/") or n in legacy for n in names):
        nopri.append(i)
    upd = calendar.timegm(time.strptime(i["updatedAt"], "%Y-%m-%dT%H:%M:%SZ"))
    age = int((now - upd) / 86400)
    if age >= stale_days:
        stale.append((age, i))
for n, old, new, has in relabel:
    print(f"RELABEL\t{n}\t{old}\t{new}\t{int(has)}")
for i in nopri:
    print(f"NOPRI\t{i['number']}\t{i['title'][:90]}")
for age, i in sorted(stale, key=lambda t: -t[0]):
    print(f"STALE\t{i['number']}\t{age}\t{i['title'][:90]}")
PY
)

echo "== $REPO — $( [ $APPLY = 1 ] && echo apply || echo dry run ) =="
echo; echo "Relabel to priority/pN:"
echo "$PLAN" | awk -F'\t' '$1=="RELABEL"{printf "  #%s  %s → %s%s\n",$2,$3,$4,($5=="1"?" (already has it; drop old)":"")}'
echo; echo "No priority label (Abdout to triage):"
echo "$PLAN" | awk -F'\t' '$1=="NOPRI"{printf "  #%s  %s\n",$2,$3}'
echo; echo "Untouched ${STALE_DAYS}+ days (close as not planned, or bump):"
echo "$PLAN" | awk -F'\t' '$1=="STALE"{printf "  #%s  %sd  %s\n",$2,$3,$4}'

if [ "$APPLY" = 1 ]; then
    echo
    echo "$PLAN" | awk -F'\t' '$1=="RELABEL"{print $2"\t"$3"\t"$4}' | while IFS=$'\t' read -r n old new; do
        gh issue edit "$n" --repo "$REPO" --add-label "$new" --remove-label "$old" >/dev/null && echo "  relabelled #$n"
    done
fi
