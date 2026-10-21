---
name: reverse
description: Competitor feature teardown, with evidence (REA)
when_to_use: "Use when the question is HOW another product works — requests, routes, API shape. Not /clone (pixels). Triggers on: reverse, teardown, how does <app> do <feature>, inspect this HAR, هندسة عكسية."
argument-hint: '<url|file.har|app-dir|file.asar|file.apk> ["the feature"] [--vault]'
---

# Reverse — feature teardown with evidence

Wraps [REA](https://github.com/morluto/rea) (MIT, `rea-agents`), a CLI + MCP that inspects
software with no source access and returns **evidence plus stated unknowns** for every
finding. kun drives the **CLI**, never the MCP: the Mac is RAM-tight and the catalog was pruned
on purpose, so `rea` is not registered (see the `$comment` in `.claude/mcp.json`).

**Runner** — always this, never bare `npx rea-agents`:

```bash
R=.claude/skills/reverse/scripts/rea.sh    # pins REA 6.7.0 under Node 24 (Node 25 fails doctor)
$R doctor                                   # readiness; native engines will show missing — fine
```

Never run `rea setup` — it rewrites agent configs and CLAUDE.md files that kun owns.

## Argument: $ARGUMENTS

Work dir: `.claude/handoff/reverse/<target-slug>/` — every evidence JSON lands there.
Always pass `--format json` and redirect to a file; read files with `jq`, never cat them whole.

## Modes — pick by target

| Target                                                      | Lane                      | Cost (measured 2026-10-21)                                                                     |
| ----------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Public URL + a feature to exercise                          | **A. Scenario** (default) | ~9 s, ~380 MB                                                                                  |
| Logged-in page (Abdout's own account)                       | **B. Vault** (`--vault`)  | same as A                                                                                      |
| A `.har` Abdout exported from DevTools                      | **C. HAR**                | seconds                                                                                        |
| Electron app dir / `.asar`, or scripts exported from lane B | **D. Static JS**          | ~30 s, ~1.4 GB peak                                                                            |
| `.apk`                                                      | **E. Android**            | needs JDK + JADX — say so if absent                                                            |
| Native binary                                               | —                         | needs Ghidra (`GHIDRA_INSTALL_DIR`); none installed. State the limit; never install Hopper/IDA |

### A. Scenario — launch a clean Chrome, script the feature, capture network from byte one

Write `scenario.json` (contract: REA `docs/browser-scenario-contract.md`; actions: `goto`
`click` `fill` `press` `select_option` `check` `uncheck` `wait_for` `wait_for_timeout`; locator
`kind`: `css` | `role` | `test_id`; typed values are `{ "source": "literal", "value": … }`):

```json
{
  "browser": {
    "mode": "launch",
    "executable_path": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  },
  "start_url": { "url": "https://competitor.example/search" },
  "actions": [
    {
      "step_id": "type",
      "action": "fill",
      "locator": { "kind": "css", "selector": "input[type=search]" },
      "value": { "source": "literal", "value": "math" },
      "timeout_ms": 10000
    },
    { "step_id": "settle", "action": "wait_for_timeout", "duration_ms": 3000 }
  ],
  "capture": { "events": ["network"], "at_end": ["dom", "url"] }
}
```

```bash
$R capture-browser-scenario "$W/scenario.json" --format json > "$W/scenario-out.json"
# the API surface, minus static chunks:
jq -r '.. | objects | select(has("method") and has("url")) | "\(.method) \(.url.url // .url)"' "$W/scenario-out.json" \
  | grep -v '/_next/static\|\.css\|\.woff\|\.png\|\.svg\|\.gif\|\.avif\|\.ico' | sed 's/?.*/?…/' | sort -u
```

Add `"network": { "response_body": true }` to `capture` only when the JSON response **shape**
matters — it widens what is retained.

### B. Vault — attach to Abdout's signed-in Chrome on :9222

The same session vault `/behalf` and the `chrome-devtools` MCP use (`~/.claude/bin/chrome-debug.sh`
starts it). Run the **same scenario in connect mode** on a fresh tab — REA drives it from the
first request, so the page load is captured, with Abdout's cookies:

```bash
T=$(curl -s -X PUT "http://127.0.0.1:9222/json/new?about:blank" | jq -r .id)   # own tab
# scenario.json: "browser": { "mode": "connect", "cdp_endpoint": "http://127.0.0.1:9222", "target_id": "<T>" }
$R capture-browser-scenario "$W/scenario.json" --format json > "$W/scenario-out.json"
curl -s "http://127.0.0.1:9222/json/close/$T"                                  # always close it
```

For a passive snapshot of the page as it stands (DOM, scripts, storage key names, workers):

```bash
$R list-browser-targets http://127.0.0.1:9222 --allowed-origins <origin> --format json  # always filter: titles leak
$R inspect-web-page http://127.0.0.1:9222 "$T" --observation-ms 1500 --format json > "$W/page.json"
```

Passive tools see only what happens after they attach — `inspect-web-page` on a loaded page
reported 0 requests. Use them for structure, the scenario for traffic.

`jq '.normalized_result | keys'` → dom, network, scripts, storage, workers, limitations.

**Do not run `analyze-web-bundle` on a real app** — on kun.databayt.org's Next.js bundle it
hit V8's 4 GB heap limit and crashed (fine on a toy page). For bundle structure, take lane D:
`inspect-web-page … --include-script-sources` → `$R export-web-scripts "$W/page.json" "$W/scripts"`.

### C. HAR

```bash
$R inspect-web-network-capture "$W/session.har" har --format json > "$W/har.json"
$R inspect-web-network-capture "$W/session.har" har --record 3 --format json   # drill into one request
```

Cookies and auth headers are never retained; pass `--sensitive-value <literal>` for anything
else that must be scrubbed.

### D. Static JS / Electron

```bash
$R analyze-javascript-application "$W/scripts" --max-heap-mb 1024 --analysis-timeout-ms 120000 \
  --format json > "$W/js.json"
jq '.normalized_result | {summary, statistics}' "$W/js.json"
```

The full output is huge (237 MB for a 1 MB bundle). Read only `summary` and `statistics`, then
query `semantic_graph` with targeted `jq`. The IPC/preload summary only says anything for
Electron apps; for a web bundle the value is the module/import graph.

## Deliverable — the teardown

Write `$W/TEARDOWN.md` and reply with its gist:

1. **What it does** — the feature in one paragraph, as a user sees it.
2. **How** — the requests (method, path, payload shape), routes, storage, notable modules —
   every claim cites an evidence file + `jq` path.
3. **Unknowns** — REA's `limitations` plus what we did not exercise. Absence of evidence is
   only absence within what was observed.
4. **Our build** — how we would do it in the house stack (Next.js 16 server actions, Prisma,
   shadcn, ar/en), which product it belongs to, and rough size.
5. **Next** — offer `/idea <product>` with the teardown linked. Don't open the issue unasked.

## Guardrails

- Lawful, authorized analysis only (REA `DISCLAIMER.md`): public behavior of competitor
  products, our own apps, software we are licensed to run.
- Never bypass a login, paywall, rate limit, or anti-bot measure; never pull other users'
  data. In lane B, inspect only what Abdout's own account can already see.
- Understand, then reimplement. Never paste a competitor's code, assets or copy into our repos.
- Network evidence can carry personal data in URLs — keep `$W` local (the handoff dir is not
  published), and summarize, don't quote, user-identifying values.

## Exit gate

`TEARDOWN.md` exists, every "How" claim has an evidence citation, unknowns are listed, and any
tab opened in the vault was closed.
