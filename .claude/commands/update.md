Update the machine: pull latest engine config + all org product repos + verify health. One command instead of three.

Arguments: $ARGUMENTS (optional: `--tools` to also re-run the smart-install bootstrap for brew/apt/winget tools; `--dry` to print what would run without executing)

Steps:

1. **Pull latest engine** from `databayt/kun`:
   ```bash
   git -C ~/kun fetch origin main --quiet
   OLD_SHA=$(git -C ~/kun rev-parse --short HEAD)
   BEHIND=$(git -C ~/kun rev-list --count HEAD..origin/main)
   if [[ "$BEHIND" -eq 0 ]]; then
       echo "✓ engine: ~/kun already at origin/main ($OLD_SHA)"
   else
       git -C ~/kun pull --ff-only origin main || {
           echo "❌ ~/kun has local changes that block fast-forward — resolve with: cd ~/kun && git status"
           exit 1
       }
       NEW_SHA=$(git -C ~/kun rev-parse --short HEAD)
       echo "✓ engine: $OLD_SHA → $NEW_SHA ($BEHIND commit(s))"
   fi
   ```

2. **Sync engine config** into `~/.claude/` (setup.sh auto-detects `MODE=update` if `~/.claude/agents/` already exists):
   ```bash
   bash ~/kun/.claude/scripts/setup.sh engineer
   ```
   *Role is a label only post-#113 — every machine gets the full config. `engineer` is the safe default.*

3. **Pull all org product repos** (stash → fetch → pull --rebase across 11 repos):
   ```bash
   bash ~/.claude/scripts/sync-repos.sh all
   ```
   *Reports per-repo `synced` / `up-to-date` / `failed`. Updates `~/.claude/memory/repositories.json:sync.lastFullSync`.*

4. **Verify**:
   ```bash
   bash ~/.claude/scripts/health.sh
   ```

5. **If `$ARGUMENTS` contains `--tools`**, also re-run the smart-install bootstrap to refresh brew/apt/winget/npm tooling (Node, gh CLI, pnpm, vercel, IDEs, Chrome, Claude Desktop). PR #113 helpers (`brew_smart`, `apt_smart`, `Winget-Smart`, `npm_global_smart`) upgrade in place — skip-if-fresh, upgrade-if-outdated:
   ```bash
   case "$(uname)" in
       Darwin)  bash ~/kun/.claude/scripts/onboarding-mac.sh --quiet ;;
       Linux)   bash ~/kun/.claude/scripts/onboarding-linux.sh --quiet ;;
       *)       echo "Windows: re-run irm https://kun.databayt.org/install.ps1 | iex" ;;
   esac
   ```
   *Skip this unless drift warning suggests it, or it's been >1 week. Takes ~5 min.*

6. **If `$ARGUMENTS` is `--dry`**, print steps 1-5 as a checklist without executing.

7. **Summary line** (always print last):
   ```
   engine: <old> → <new> (<N> commits)
   repos:  <synced> synced, <unchanged> unchanged, <failed> failed
   tools:  <skipped|refreshed>
   health: <healthy|warnings|errors>
   ```

## When to run

- After a SessionStart hook prints `⚠️ ~/kun is N commits behind`
- After hearing in Slack/PR review that a new agent/skill/MCP landed
- At least once a week as personal hygiene
- Before starting a new feature so you build against current patterns

## What it does NOT do

- **Does not auto-update MCP versions** — pinned per `mcp.mdx:105` (e.g., `@playwright/mcp@0.0.75`). Bump those manually in lock-step with `mcp-doctor`.
- **Does not touch Claude Code CLI** — auto-updates in background via the native installer (per `code.claude.com/docs/en/setup`).
- **Does not push or commit** — pure read+sync.
