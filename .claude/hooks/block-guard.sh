#!/bin/bash
# Stop — block protocol guard.
# If this session changed 2+ code files inside a registered block (per
# .claude/blocks.json) without touching the block's records (README/ISSUE/
# CLAUDE.md) or its <block>.mdx docs, block the stop ONCE with the exact
# update list. stop_hook_active guards against loops; the touch log is
# cleared after a nudge so later turns aren't re-nagged for the same work.
# Threshold via BLOCK_GUARD_MIN_FILES (default 2) — single-file quick fixes pass.
# Installed at ~/.claude/hooks/block-guard.sh; canonical copy in kun.

export HOOK_INPUT="$(cat)"

python3 - <<'PY'
import json, os, sys

data = json.loads(os.environ.get("HOOK_INPUT") or "{}")
if data.get("stop_hook_active"):
    sys.exit(0)

proj = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd", "")
reg_path = os.path.join(proj, ".claude", "blocks.json")
log_path = "/tmp/claude-block-touch-%s.log" % data.get("session_id", "default")
if not (proj and os.path.isfile(reg_path) and os.path.isfile(log_path)):
    sys.exit(0)

touched = [l.strip() for l in open(log_path) if l.strip()]
if not touched:
    sys.exit(0)

blocks = json.load(open(reg_path)).get("blocks", {})
min_files = int(os.environ.get("BLOCK_GUARD_MIN_FILES", "2"))
RECORDS = ("README.md", "ISSUE.md", "CLAUDE.md")

# Attribute each touched file to the DEEPEST matching block only, so work in
# school-dashboard/timetable/ doesn't also charge the parent school-dashboard.
def owner(path):
    hits = [n for n, b in blocks.items()
            if path.startswith(os.path.join(proj, b["path"]) + os.sep)]
    return max(hits, key=lambda n: len(blocks[n]["path"]), default=None)

by_block = {}
for t in touched:
    n = owner(t)
    if n:
        by_block.setdefault(n, []).append(t)

violations = []
for name, files in by_block.items():
    b = blocks[name]
    code = [t for t in files if os.path.basename(t) not in RECORDS]
    if len(code) < min_files:
        continue
    records_updated = any(os.path.basename(t) in RECORDS for t in files)
    docs_updated = any(os.path.join(proj, d) in touched for d in b.get("docs", []))
    if not (records_updated or docs_updated):
        need = [b["path"] + "/" + f for f in (b.get("context") or ["README.md"])]
        need += b.get("docs", [])
        violations.append((name, len(code), need))

if violations:
    open(log_path, "w").close()  # one nudge per batch of work
    lines = [
        "- '%s' (%d code files changed): update %s; then comment/close the related "
        'GitHub issue (gh issue list --search "%s")' % (name, n, ", ".join(need), name)
        for name, n, need in violations
    ]
    reason = (
        "Block protocol: this session changed code in registered block(s) without "
        "updating their records or docs. Before finishing, do the post-work updates "
        "(or state explicitly why the change is too trivial to document):\n"
        + "\n".join(lines)
    )
    print(json.dumps({"decision": "block", "reason": reason}))
sys.exit(0)
PY
