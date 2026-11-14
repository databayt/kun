# Playwright/Browser MCP — Error Ledger

> Living catalog of every distinct Playwright MCP error and its **permanent** fix.
> The goal: each error class is debugged **once**, then guarded forever.
>
> **`/mcp-doctor` reads this file before improvising.** When a new error appears that
> isn't here, solve it, then append a new `E<n>` entry so it's never re-debugged.
>
> Entries seeded from real history at `~/Library/Caches/claude-cli-nodejs/*/mcp-logs-browser/*.txt`.

## How to use this ledger

1. Get the symptom — either the user's words or, better, the tail of the active log:
   ```bash
   find ~/Library/Caches/claude-cli-nodejs -path "*mcp-logs-browser*" -name "*.txt" \
     -exec ls -t {} + | head -1 | xargs tail -40
   ```
2. Match the error string against the **Match pattern** of each entry below.
3. Apply that entry's **Permanent fix**. Confirm with **Verify**.
4. If nothing matches: diagnose from scratch, fix it, then **append a new entry** (copy the template at the bottom). Bump the count in the header of `SKILL.md` if you track it.

## Status legend

- **guarded** — root cause removed; should not recur given current config. If it does, the guard regressed — investigate that.
- **operational** — depends on the target page/runtime, not our config. Fix is a runbook, not a permanent guard.
- **watch** — known risk, no permanent fix yet; documented so we recognize it fast.

---

## E1 — Wrong / nonexistent MCP package (404)

**Status:** guarded · **First seen:** 2025-12-06 (Downloads/abushalaa2-0)

**Log signature:**

```
npm error 404 Not Found - GET https://registry.npmjs.org/@anthropic-ai%2fmcp-server-puppeteer - Not found
npm error 404  The requested resource '@anthropic-ai/mcp-server-puppeteer@*' could not be found
```

**Match pattern:** `npm error 404.*(mcp-server-puppeteer|mcp-server-playwright|executeautomation)`

**Root cause:** A project-level `.mcp.json` defined `browser` pointing to a package that doesn't exist or isn't the official one. Four wrong packages have been seen in the wild:
`@anthropic-ai/mcp-server-puppeteer`, `@anthropic-ai/mcp-server-playwright` (neither exists on npm), `@executeautomation/playwright-mcp-server` (exists but wrong protocol — exposes `playwright_*` snake*case tools, not `browser*\*`). The project entry shadows the working user-level config by name.

**Permanent fix:**

```bash
# Find the offending project config
find ~ -maxdepth 5 \( -name "mcp.json" -o -name ".mcp.json" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null \
  -exec grep -l '"browser"' {} \; | grep -v "^/Users/abdout/.claude/mcp.json$"
# Remove the "browser"/"browser-headed" entry from each. Only ~/.claude/mcp.json may define them.
```

**Verify:** the find above returns nothing. See [[reference-playwright-mcp]] and `feedback-mcp-config` memory.

---

## E2 — npm access token expired/revoked

**Status:** watch · **First seen:** 2025-12-06 (Downloads/abushalaa2-0)

**Log signature:**

```
npm notice Access token expired or revoked. Please try logging in again.
```

**Match pattern:** `npm notice Access token expired or revoked`

**Root cause:** An `_authToken` in an `.npmrc` (`~/.npmrc` or a project `.npmrc`) expired. npm sends the stale token on every request — including public-registry fetches for `@playwright/mcp` — and once revoked, scoped/private fetches 404 and the MCP server never starts. (As of 2026-05-21 there is no `~/.npmrc`; `acme/.npmrc` and `maid/.npmrc` have no tokens — so this is dormant, not active. It returns the moment a token is added and later expires.)

**Permanent fix:** `@playwright/mcp` is **public** and needs no auth. Ensure no expired token blocks it:

```bash
grep -rl "_authToken" ~/.npmrc ~/*/.npmrc 2>/dev/null   # find offenders
# Either refresh the token (npm login) or remove the stale _authToken line.
# Public packages must remain fetchable without auth.
```

**Verify:** `npx -y @playwright/mcp@0.0.75 --version` succeeds with no "token" notice.

---

## E3 — `MCP error -32000: Connection closed` (umbrella symptom)

**Status:** operational · **First seen:** 2025-12-06

**Log signature:**

```
Connection failed after 1831ms: MCP error -32000: Connection closed
```

**Match pattern:** `MCP error -32000: Connection closed`

**Root cause:** This is the **generic "server died at startup" symptom**, not a root cause. The real cause is in the stderr lines **immediately above it** in the same log file. Almost always E1 (bad package), E2 (token), E6 (missing Chromium), or E7 (profile lock).

**Permanent fix:** Don't fix E3 directly — read the lines above it and route to the matching entry:

```bash
latest=$(find ~/Library/Caches/claude-cli-nodejs -path "*mcp-logs-browser*" -name "*.txt" -exec ls -t {} + | head -1)
grep -B8 "Connection closed" "$latest" | grep -i "stderr\|error\|404\|token\|executable\|Singleton"
```

**Verify:** the upstream error is identified and its own entry's Verify passes.

---

## E4 — `Browser disconnected event triggered`

**Status:** operational · **First seen:** 2025-12-10

**Log signature:**

```
Server stderr: Browser disconnected event triggered
```

**Match pattern:** `Browser disconnected event triggered`

**Root cause:** Chromium crashed or was killed **mid-session** — OOM on a heavy page, an external `pkill`, or losing a profile lock to a competing process (E7). Distinct from startup failures: the connection was working, then the browser died.

**Permanent fix:** No permanent guard (it's runtime). Recover:

```bash
pkill -f playwright-mcp          # clear any half-dead instance
# restart Claude Code; the server respawns clean
```

If it recurs on a specific heavy page, that page is the trigger — note it.

**Verify:** fresh session, navigate to a light page (about:blank), screenshot succeeds.

---

## E5 — `page.screenshot: Timeout exceeded ... waiting for fonts to load`

**Status:** operational · **First seen:** 2025-12-12

**Log signature:**

```
Operation failed: page.screenshot: Timeout 30000ms exceeded.
Call log: - taking page screenshot - waiting for fonts to load...
```

**Match pattern:** `page\.(screenshot|click|goto): Timeout \d+ms exceeded`

**Root cause:** The target page never reached a stable state — webfonts/assets stalled, or a locator never appeared (`page.click` waiting for `button:has-text("Login")`). This is the **target page's** problem, not the MCP's.

**Permanent fix:** Runbook, not a guard:

- Navigation timeout is already 60s in `~/.claude/playwright-mcp.config.json`. Action timeout is 15s.
- For a slow page, screenshot without waiting for fonts, or navigate with `waitUntil: domcontentloaded` instead of `networkidle`.
- For a missing locator, the selector is wrong or the element is gated (auth) — fix the selector or log in via `browser-headed` first.

**Verify:** the same operation on the same page succeeds, or the selector is corrected.

---

## E6 — Chromium executable not found (revision drift)

**Status:** guarded · **First seen:** 2026-05-20 (this fix — synthesized from version-pin analysis)

**Log signature:**

```
browserType.launch: Executable doesn't exist at .../ms-playwright/chromium-<rev>/...
```

or (the `@playwright/mcp@0.0.75` flavor of the same root cause, returned to the tool call rather than logged):

```
Error: Browser "chromium" is not installed. Run `npx @playwright/mcp install-browser chromium` to install
```

**Match pattern:** `Executable doesn't exist|chromium-\d+.*not found|Browser "chromium" is not installed`

**Root cause:** The pinned `@playwright/mcp@0.0.75` bundles `playwright-core@1.61.0-alpha-1778188671000`, which requires Chromium revision **1224**. If that revision isn't in `~/Library/Caches/ms-playwright`, launch fails. Caused by version bumps or an aggressive cache prune. Confirmed again 2026-06-17 (hogwarts): cache topped out at chromium-1223; 1224 was simply never downloaded.

**Permanent fix:**

```bash
# Install the EXACT revision the pinned server needs. MUST pin @0.0.75 —
# bare `npx @playwright/mcp install-browser` (what the error message suggests)
# resolves @latest and pulls the WRONG revision (e.g. 1226).
npx -y @playwright/mcp@0.0.75 install-browser chromium
# (verify which rev 0.0.75 wants: npm view @playwright/mcp@0.0.75 dependencies.playwright-core
#  → then the cached playwright-core's browsers.json gives the chromium revision)
```

**Verify:** `ls ~/Library/Caches/ms-playwright | grep chromium-1224` shows the revision. NOTE: the running MCP server only launches at Claude Code session start, so a mid-session install does NOT recover the current session — it fixes the *next* session. There is no mid-session browser recovery.

---

## E7 — Profile locked / `ProcessSingleton`

**Status:** guarded · **First seen:** 2026-05-20 (this fix)

**Log signature:**

```
Error: ProcessSingleton ... The profile appears to be in use by another Chromium process
SingletonLock present in user-data-dir
```

**Match pattern:** `ProcessSingleton|profile.*in use|SingletonLock`

**Root cause:** Two servers or two Claude sessions pointed at the **same** `--user-data-dir`. Chromium enforces a one-process lock per profile dir. Historically caused by (a) the config file's `userDataDir` overriding the CLI flag so headless+headed collided, and (b) a stale `playwright-mcp` PID holding the dir.

**Permanent fix (already applied, keep it that way):**

- `~/.claude/mcp.json`: headless → `~/.playwright-auth-headless`, headed → `~/.playwright-auth` (distinct, explicit `--user-data-dir`).
- `~/.claude/playwright-mcp.config.json`: **no** `userDataDir` key (CLI flag is authoritative).
- Clear a stuck lock:

```bash
pkill -f playwright-mcp
rm -f ~/.playwright-auth/Singleton{Lock,Cookie,Socket}
rm -f ~/.playwright-auth-headless/Singleton{Lock,Cookie,Socket}
```

**Verify:** `pgrep -c playwright-mcp` ≤ 2; no `SingletonLock` in either profile dir. The session-start hook warns if these regress.

---

## E8 — `Browser is already in use … use --isolated` (multi-session collision)

**Status:** guarded · **First seen:** 2026-06-15 (kun — dominant current-era error)

**Log signature:**

```
Error: Browser is already in use for /Users/abdout/.playwright-auth-headless, use --isolated to run multiple instances of the same browser
```

**Match pattern:** `Browser is already in use|use --isolated to run multiple instances`

**Root cause:** `@playwright/mcp` opens a **persistent** browser context whenever `--user-data-dir` is set, and a persistent profile is locked to ONE browser process. The Cowork bridge routinely runs 4-8 concurrent Claude Code sessions; the first to navigate claims `~/.playwright-auth-headless`, and every other session's `browser_*` call then fails with this error. This is distinct from E7 (OS-level `SingletonLock`) — it's Playwright-MCP's own higher-level guard, and it names the fix. In the `.jsonl` logs this was the #1 current error by a wide margin: the real cause behind "the browser MCP keeps disconnecting" during `/watch` / `/handover` / `/check`.

**Permanent fix (applied 2026-06-15):** the headless `browser` server needs no persistent login (that's `browser-headed` → `~/.playwright-auth`), so give it an in-memory profile:

- In **`~/.claude.json`** (the file Claude Code actually loads — see [[reference-mcp-loading]]) AND `~/.claude/mcp.json`, the `browser` args use `--isolated` instead of `--user-data-dir ~/.playwright-auth-headless`. Each session now gets its own ephemeral Chromium with no shared lock.
- `browser-headed` keeps `--user-data-dir ~/.playwright-auth` and is **single-session-at-a-time by nature** — never drive it from two sessions at once. For parallel _authenticated_ runs, use `--isolated --storage-state <file>` instead of a shared persistent dir.

**Verify:** `jq '.mcpServers.browser.args' ~/.claude.json` shows `--isolated` and no `--user-data-dir`. After a session restart, two sessions can `browser_navigate` at the same time without the "already in use" error.

---

## Template for new entries

```
## E<n> — <short title>

**Status:** guarded | operational | watch · **First seen:** YYYY-MM-DD (project)

**Log signature:**
` ``
<exact string(s) from the log>
` ``

**Match pattern:** <grep regex>

**Root cause:** <why it happens>

**Permanent fix:** <commands / config change that kills it for good>

**Verify:** <how to confirm it's fixed>
```

## E9 — Session killed the MCP's own Chromium while freeing a port

**Status:** guarded · **First seen:** 2026-08-05 (hogwarts)

**Log signature:**

```
Error: browserBackend.callTool: Target page, context or browser has been closed
MCP server "browser" is not connected
```

**Match pattern:** `Target page, context or browser has been closed|MCP server "browser" is not connected`

**Root cause:** `lsof -ti :3000 | xargs kill -9` to free a dev-server port also kills
Chromium/headless-shell PIDs that merely hold client sockets on that port — including
the Playwright MCP's own browser. The MCP server then dies and cannot reconnect until
the Claude Code session restarts.

**Permanent fix:** never blind-kill every PID on a port. Filter to the server process:
`lsof -ti :3000 -sTCP:LISTEN | xargs kill` (LISTEN state = the actual server), or
`pkill -f "next dev"`. Chromium client sockets never LISTEN on the port.

**Verify:** after freeing the port, `pgrep -fl playwright-mcp` still shows the MCP and
`mcp__browser__*` calls keep working.
