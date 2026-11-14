---
name: MCP Doctor
description: Diagnose and recover the browser/Playwright MCP server
when_to_use: "Use when the browser/Playwright MCP is broken — tools missing, server disconnected, or a launch failure. Triggers on: browser mcp is not working, tool not found, playwright mcp is disconnected, browser tools missing."
allowed-tools: Bash(pgrep *), Bash(pkill *), Bash(ls *), Bash(du *), Bash(rm *), Bash(grep *), Bash(find *), Bash(cat *), Bash(tail *), Bash(xargs *), Bash(npx *), Bash(node *), Bash(python3 *), Bash(test *), Bash(echo *), Bash(printf *), Read, Edit, Write
lane: build
effort: medium
---

# MCP Doctor — Browser/Playwright Recovery

When the user says `mcp__browser__*` is disconnected, returns "tool not found", or you see "Playwright MCP is still disconnected", run this skill.

## Step 0 — LEARN FROM HISTORY FIRST (do this before anything else)

Every Playwright error is debugged **once**, then guarded forever. The catalog of known errors and their permanent fixes is `~/.claude/skills/mcp-doctor/ERRORS.md`. **Always consult it before improvising.**

1. **Read the ledger:** `Read ~/.claude/skills/mcp-doctor/ERRORS.md`.

2. **Pull the real error from the logs** (don't rely on the user's paraphrase — Claude Code logs every browser MCP failure):

   ```bash
   # newest browser log, current project + all projects
   latest=$(find ~/Library/Caches/claude-cli-nodejs -path "*mcp-logs-browser*" -name "*.txt" -exec ls -t {} + 2>/dev/null | head -1)
   echo "LATEST: $latest"; tail -50 "$latest"
   echo "=== recurring errors across ALL projects ==="
   find ~/Library/Caches/claude-cli-nodejs -path "*mcp-logs-browser*" -name "*.txt" 2>/dev/null -print0 \
     | xargs -0 grep -hiE "error|failed|404|token|executable|Singleton|disconnected|Timeout" 2>/dev/null \
     | sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.Z-]+//g; s/[0-9]+/N/g' \
     | sort | uniq -c | sort -rn | head -20
   ```

3. **Match** the error string against each ledger entry's **Match pattern**. If it matches `E<n>`, apply that entry's **Permanent fix** and confirm with its **Verify**. Done — don't re-diagnose a solved problem.

4. **If nothing matches**, fall through to the Diagnostic + Recovery sections below. Once solved, **append a new `E<n>` entry to ERRORS.md** using the template at the bottom of that file — capture the exact log signature, root cause, and the fix that worked. This is the "tackle it once and for good" step; skipping it means the next occurrence starts from zero.

5. **If you applied a config change that should prevent recurrence**, flip the entry's **Status** to `guarded` and note the date.

## Canonical doctrine (do not deviate)

- **Package**: `@playwright/mcp` (Anthropic's official). NEVER `@executeautomation/playwright-mcp-server` or `@anthropic-ai/mcp-server-playwright` (the latter doesn't exist on npm).
- **Version pin**: exact, never `@latest`. Current pin: `0.0.75`. Update only by re-registering the server (`claude mcp add-json -s user`, which writes `~/.claude.json`) AND editing `~/.claude/skills/mcp-doctor/SKILL.md` in lock-step.
- **Config home**: the user-scope registration in `~/.claude.json` is authoritative — Claude Code never reads `~/.claude/mcp.json`. Project-level `.mcp.json` files **must not** define `browser` (or bring back `browser-headed`) — they shadow user-level by name.
- **Profile dirs**: headless `browser` runs `--isolated` (in-memory profile, **no** `--user-data-dir`) so every concurrent session gets its own ephemeral Chromium — this is the permanent fix for **E8** (multi-session "Browser is already in use"). There is **no second logged-in browser**: `browser-headed` and its `~/.playwright-auth` profile were removed on 2026-11-14 (a duplicate of the session-vault Chrome, and a visible one). Anything that needs a login goes through `chrome-devtools` on the vault (`new_page` with `background: true`).
- **CLI flag owns `--user-data-dir`.** The config file at `~/.claude/playwright-mcp.config.json` must NOT contain a `userDataDir` key.
- **Runtime config is the tuning surface.** `~/.claude/playwright-mcp.config.json` carries the schema-validated `Config` (nested `browser.launchOptions` / `browser.contextOptions`, `timeouts.{action,navigation,expect}`, `outputDir`, `snapshot.mode`, `console.level`, `testIdAttribute`). It is enriched for deterministic QA — `reducedMotion: reduce`, `serviceWorkers: block`, fixed `colorScheme` / `locale` / `timezoneId`. Per-server differences (headless on/off, profile dir, isolation) stay on the CLI, and `--caps vision,pdf` stays on the CLI (the config-file `capabilities` enum may _replace_ rather than _augment_ the core toolset). RTL is exercised per-call via `/ar/` routes, not a hardcoded context locale. Still **no `userDataDir`**.

## Diagnostic — run all checks, report each as ✅/❌

```bash
# 1. Stale playwright-mcp processes (should be ≤2 at idle)
echo "[1] playwright-mcp processes:"
pgrep -fl playwright-mcp 2>/dev/null || echo "  none"

# 2. Singleton locks on profile dirs (must be absent)
echo "[2] profile locks:"
for d in ~/.playwright-auth ~/.playwright-auth-headless; do
  for f in SingletonLock SingletonCookie SingletonSocket; do
    [ -e "$d/$f" ] && echo "  ❌ $d/$f exists"
  done
done; echo "  ✅ clean (if no ❌ above)"

# 3. Cache size
echo "[3] ms-playwright cache:"
du -sh ~/Library/Caches/ms-playwright 2>/dev/null

# 4. Project-level browser shadows (must be empty)
echo "[4] project-level browser shadows:"
find ~ -maxdepth 5 \( -name "mcp.json" -o -name ".mcp.json" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -not -path "*/.claude/mcp.json*" 2>/dev/null \
  -exec grep -l '"browser"' {} \; | grep -v "^/Users/abdout/.claude/mcp.json$" || echo "  ✅ none"

# 5. User-level config sanity
echo "[5] user-level config:"
python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.claude.json')))['mcpServers']; [print(' ',k,d[k].get('command'),' '.join(d[k].get('args',[]))) for k in ('browser','browser-headed','chrome-devtools') if k in d]"

# 6. Pinned MCP package resolvable
echo "[6] @playwright/mcp@0.0.75 resolvable:"
npx --no-install @playwright/mcp@0.0.75 --version 2>&1 | head -2 || echo "  (not cached, will download on first launch)"

# 7. Node version compatibility
echo "[7] node version:"
node --version
```

## Recovery — when diagnostic shows red

### A. Stale processes holding profile lock

```bash
pkill -f playwright-mcp
pkill -f "@playwright/mcp"
sleep 1
pgrep -fl playwright-mcp || echo "✅ all killed"
```

### B. Singleton lock left after crash

```bash
rm -f ~/.playwright-auth/Singleton{Lock,Cookie,Socket}
rm -f ~/.playwright-auth-headless/Singleton{Lock,Cookie,Socket}
```

### C. Project-level browser shadow (the most common cause)

Open the file printed by diagnostic step [4]. Delete any `"browser"` or `"browser-headed"` entry. The user-scope registration in `~/.claude.json` will now apply.

### D. Cache bloat (optional, recovers disk)

```bash
# Inspect first
du -sh ~/Library/Caches/ms-playwright/*
# Delete old Chromium revisions (keep newest 1 + headless_shell variant)
# Replace 1217 with whatever revision the current playwright pin needs (see step F)
cd ~/Library/Caches/ms-playwright && \
  ls -d chromium-* chromium_headless_shell-* | grep -v "1217" | xargs rm -rf
```

### E. Missing Chromium for the bundled Playwright

```bash
# Force-download the Chromium revision the pinned MCP needs
npx -y @playwright/mcp@0.0.75 --help >/dev/null 2>&1
# Or explicitly via playwright:
npx playwright install chromium
```

### F. Find which Chromium revision the MCP needs

```bash
find ~/.npm/_npx -path "*playwright-core/browsers.json" -newer /tmp 2>/dev/null \
  | head -1 \
  | xargs python3 -c "import json, sys; d=json.load(open(sys.argv[1])); print([b['revision'] for b in d['browsers'] if b['name']=='chromium'][0])"
```

## After recovery

Restart Claude Code (the MCP server only starts once at session start). The first invocation of `mcp__browser__browser_navigate` may take ~30s if Chromium needs to download.

## Source of truth

- **Error history + permanent fixes**: `~/.claude/skills/mcp-doctor/ERRORS.md` (the ledger — read it first, append to it after solving anything new).
- **Doctrine + root-cause writeup**: `/Users/abdout/kun/content/docs/mcp.mdx` (Troubleshooting section).

$ARGUMENTS
