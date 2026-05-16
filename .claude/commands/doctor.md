# Doctor — Health, Updates, Self-repair

Audit the local Kun engine config. One command answers three questions: *is it healthy, is it up to date, what's fixable?*

## Usage
- `/doctor` — full audit, exit 0/1/2/3 based on findings
- `/doctor fix` — repair fixable issues (missing `c` function, `~/.claude/bin` on PATH)
- `/doctor update` — pull `~/.claude` and `~/codebase`, surface new claude CLI version
- `/doctor report` — post snapshot to `databayt/kun#config-health`
- `/doctor json` — machine-readable output for piping
- `/doctor quiet` — suppress passes, show only warn/fail/update
- `/doctor deep` — slow checks (MCP connectivity, per-repo `git fetch`)

## Argument: $ARGUMENTS

## Instructions

1. Detect OS — Windows uses `~/.claude/scripts/doctor.ps1`, macOS/Linux uses `~/.claude/scripts/doctor.sh`.
2. Translate `$ARGUMENTS` to the appropriate flag form:
   - PowerShell: `-Fix`, `-Update`, `-Report`, `-Json`, `-Quiet`, `-Deep`
   - Bash: `--fix`, `--update`, `--report`, `--json`, `--quiet`, `--deep`
3. Invoke the script and surface the output verbatim.
4. If the script exits non-zero, summarize the issues:
   - **Exit 1** (errors): list each `❌` row, recommend `c "/doctor fix"` or manual remediation
   - **Exit 2** (warnings): list each `⚠️` row, note nothing is broken
   - **Exit 3** (updates): list each `🔄` row, offer `c "/doctor update"`
5. If `~/.claude/scripts/doctor.ps1` / `doctor.sh` is missing, print: *"Run `/bootstrap` to install the Kun engine."*

## Notes

- The script is read-only by default. `fix`, `update`, and `report` change state — confirm with the user before invoking those variants.
- Exit codes follow precedence: errors > warnings > updates. Exit 0 = fully green.
- `~/.claude/memory/repositories.json` is the source of truth for which repos to check.

## Reference

- Spec: https://github.com/databayt/kun/issues/26
- Source: `.claude/scripts/doctor.ps1` (Windows) / `.claude/scripts/doctor.sh` (macOS/Linux)
