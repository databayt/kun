#!/usr/bin/env bash
# Land a finished textbook twin from the catalog's staging area into the catalog,
# and publish it when the twin gate passes. Zero tokens: copy, lock, gate, publish.
#
#   bash scripts/textbook/land.sh <curriculum> <grade> <subject>            land + publish + commit
#   bash scripts/textbook/land.sh <curriculum> <grade> <subject> --dry-run  check only, change nothing
#
# Reads   ~/catalog/.work/<cur>/<grade>/<subject>/{pages-md/,textbook.md,pages-md-verify/run.json}
# Writes  ~/catalog/<cur>/<grade>/<subject>/{pages-md/,textbook.md} + index.json, then the CDN.
#
# The publish rule (engine.json → textbook.loop.publish_rule): the new twin must pass the
# catalog's twin gate — vision extraction, agreement ≥ the B floor, ≥ 12 sampled pages, every
# page transcribed, sourceMd5 present. It does NOT compare with the live twin's agreement: two
# random 12-page samples of the SAME chemistry twin scored 0.946 and 0.893 (2026-10-09), so
# "new ≥ live" would be a coin flip. A twin that fails the gate is reverted, never published.
#
# Exit 0 landed (or would land) · 2 usage · 3 not ready · 4 gate failed (reverted) · 5 publish failed
set -u
CATALOG="${CATALOG:-$HOME/catalog}"
CUR="${1:-}"; GRADE="${2:-}"; SUBJ="${3:-}"; DRY=0
[ "${4:-}" = "--dry-run" ] && DRY=1
if [ -z "$CUR" ] || [ -z "$GRADE" ] || [ -z "$SUBJ" ]; then
    echo "usage: land.sh <curriculum> <grade> <subject> [--dry-run]" >&2; exit 2
fi
W="$CATALOG/.work/$CUR/$GRADE/$SUBJ"
C="$CATALOG/$CUR/$GRADE/$SUBJ"
ID="$CUR-$GRADE-$SUBJ"
say() { echo "[land $ID] $*"; }

# ── ready? ────────────────────────────────────────────────────────────────────
[ -d "$C" ] || { say "no catalog dir $C"; exit 2; }
[ -f "$W/pages-md-verify/run.json" ] || { say "not persisted yet (no run.json) — finish the textbook run first"; exit 3; }
[ -f "$W/textbook.md" ] || { say "no assembled textbook.md in staging"; exit 3; }
PAGES=$(python3 -c "import json;print(json.load(open('$C/structure.json'))['verification']['pages'])")
HAVE=$(find "$W/pages-md" -maxdepth 1 -name '[0-9]*.md' -size +0 | wc -l | tr -d ' ')
[ "$HAVE" = "$PAGES" ] || { say "$HAVE of $PAGES pages transcribed — not complete"; exit 3; }
PARTIAL=$(python3 -c "import json;print(json.load(open('$W/pages-md-verify/run.json')).get('partial',False))")
[ "$PARTIAL" = "False" ] || { say "last run was partial"; exit 3; }
SRC=$(sed -n 's/^sourceMd5: *"\{0,1\}\([a-f0-9]*\)"\{0,1\}$/\1/p' "$W/textbook.md" | head -1)
PDF=$(md5 -q "$C/textbook.pdf" 2>/dev/null || true)
[ -n "$PDF" ] && [ "$SRC" != "$PDF" ] && { say "staged twin was made from a different PDF ($SRC vs $PDF)"; exit 3; }
AGR=$(sed -n 's/^agreement: *//p' "$W/textbook.md" | head -1)
say "ready: $HAVE pages, agreement $AGR"
if [ "$DRY" = 1 ]; then say "dry run — nothing changed"; exit 0; fi

cd "$CATALOG" || exit 2
[ "$(git branch --show-current)" = "main" ] || { say "catalog is not on main"; exit 2; }

# ── land ──────────────────────────────────────────────────────────────────────
mkdir -p "$C/pages-md"
rsync -a --delete --include='[0-9]*.md' --include='_CONTRACT.md' --exclude='*' "$W/pages-md/" "$C/pages-md/"
cp "$W/textbook.md" "$C/textbook.md"
pnpm -s assets lock >/dev/null && pnpm -s validate >/dev/null && pnpm -s index >/dev/null || {
    say "validate/index failed — reverting"
    git checkout -q -- "$CUR/$GRADE/$SUBJ" index.json; git clean -qfd -- "$C/pages-md"; exit 4; }

GATE=$(pnpm -s twins "$CUR" --grade "$GRADE" --json | python3 -c "
import json,sys;d=json.load(sys.stdin)
t=[x for x in d['twins'] if x['id']=='$ID'][0]
print('pass' if t['twinGate'] else 'fail: '+t['twinReason'])")
if [ "$GATE" != "pass" ]; then
    say "twin gate $GATE — reverting, nothing published"
    git checkout -q -- "$CUR/$GRADE/$SUBJ" index.json; git clean -qfd -- "$C/pages-md"; exit 4
fi
say "twin gate passes"

# ── publish + commit ──────────────────────────────────────────────────────────
# Pre-catalog keys are never overwritten here (no --overwrite): the loop only replaces what
# the catalog itself published.
pnpm -s publish:cdn "$CUR" --apply | tail -2 || { say "publish failed — landed locally, not on the CDN"; exit 5; }
git add -- "$C/pages-md"
git commit -q -m "feat($ID): vision twin, agreement $AGR (textbook loop)

Transcribed by vision, verified by a blind re-read sample and adjudicated
against the scan; landed and published by kun scripts/textbook/land.sh
because the twin gate passes.

Co-Authored-By: Claude <noreply@anthropic.com>" -- "$CUR/$GRADE/$SUBJ" index.json
git pull -q --rebase origin main && git push -q origin main || say "push failed — commit is local"
say "landed + published: $(git log --oneline -1)"
