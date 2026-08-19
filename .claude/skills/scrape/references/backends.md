# Backends — the readers behind the lanes

Loaded on demand, not on every run. Read this when a reader misbehaves, before installing or
swapping one, or when deciding between the CLI and the MCP. The runbook itself is
`.claude/skills/scrape/SKILL.md`; §9 there carries the pre-flight rule and points here.

## The measurement history of the website lane

Kept because it is the reason the lane is shaped the way it is, and re-testing it costs a morning.

**Measured 2026-08-19 on three real `webQueue` rows:**

| Attempt                       | Result                                                                      |
| ----------------------------- | --------------------------------------------------------------------------- |
| plain `curl -sL` + browser UA | **1 of 3** yielded (`qla.edu.qa` → email + `+974` phone)                    |
| the other 2                   | one JS-rendered shell (5.6 KB, no contact in HTML), one dead host (0 bytes) |
| Jina Reader `r.jina.ai/<url>` | **HTTP 451 on every URL from this machine** — systemic, not per-site        |

`tpsdxb.com` was confirmed as the JS case: `/`, `/contact` and `/contact-us` all return ~5.6 KB of
`<noscript>` plus a nonce'd script tag and zero contact. Jina Reader 451s for `example.com` as
readily as for a school site, so it is an IP/region block on this machine rather than anything about
the target. Re-test before planning around it; do not assume it came back.

## Choosing a reader

Every reading lane has a **backend**, and a lane that returns nothing is ambiguous until you know
which one failed: the target had no contact, or the reader was broken. Separate those before
concluding anything — a broken reader reported as "low yield" is how a good lane gets abandoned.
(The runbook's §9 carries the pre-flight rule that follows from this; it is repeated here so this
file stands alone: try the reader on **one** row you have already confirmed by hand before running a
batch. If that row fails, the reader is down — stop, rather than burning the queue and recording a
false zero.)

Two tools cover this, and **the line between them is the account-risk line**:

| Tool                                                                       | Lane                                                                                                | Account risk                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **[Scrapling](https://github.com/D4Vinci/Scrapling)** (BSD-3, ~75k★)       | Anonymous: school websites, government registers. Rendering, adaptive selectors, crawl + checkpoint | **None** — no login, nothing to lose |
| **[Agent Reach](https://github.com/Panniantong/Agent-Reach)** (MIT, ~73k★) | Logged-in social: Facebook, Instagram. Multi-backend + `doctor`                                     | **High** — drives a real session     |

Use Scrapling for everything that does not need a login, which is most of the remaining yield: §4's
rendered sites and §5's registers. Use Agent Reach only where a login is unavoidable, under §2's
dedicated-account rule.

Agent Reach is a capability layer over readers — one CLI routing Facebook, Instagram, web, RSS and
Exa semantic search across multiple backends, with `agent-reach doctor --json` reporting which
backend serves each platform right now. Its premise is that access methods break and get swapped,
which is precisely this lane's failure mode.

**Install status: BOTH INSTALLED 2026-08-19** — Scrapling 0.4.14, Agent Reach v1.5.0. Python was
never the blocker (an earlier note here said 3.9.6 stopped them; `python3` is 3.9.6 but
`python3.11` and `uv` are both present, so each lives in its own isolated tool env).

```bash
uv tool install --with markdownify 'scrapling[fetchers]' && scrapling install
uv tool install 'https://github.com/Panniantong/agent-reach/archive/main.zip'
```

Two install traps, both hit for real, so nobody hits them twice:

1. **`uv tool install agent-reach` installs the WRONG PACKAGE.** PyPI's `agent-reach` is version
   0.1.0 by a different author pointing at `github.com/jgalea/agent-reach` — a name collision, not
   the ~73k★ project. The version mismatch (repo says 1.5.0, PyPI serves 0.1.0) is the tell. Install
   from the **GitHub archive URL** above — that is what Agent Reach's own install guide
   ([docs/install.md upstream](https://github.com/Panniantong/Agent-Reach/blob/main/docs/install.md))
   prescribes. Verify with `agent-reach --version`; it must print `Agent Reach v1.5.0`.
2. **`scrapling[fetchers]` omits `markdownify`**, so `scrapling extract` fetches and renders the page
   and then dies at the markdown step. `--with markdownify` fixes it.

**Measured payoff, same day, on a real `webQueue` row.** `tpsdxb.com/contact-us` — 5,652 bytes of JS
shell and zero contact under plain curl — yielded `info@tpsdxb.com`, `registrar@tpsdxb.com` and
`+971-428-444-65` through `scrapling extract fetch`. One unreachable row became contactable, which is
the entire thesis of adopting it.

**`agent-reach doctor` is a CONFIG check, not a liveness check — do not trust it as one.** It reports
4/15 channels up and marks "any web page via Jina Reader" **✅ available**, while `r.jina.ai` returns
451 for every URL from this machine. That is not a bug so much as a boundary: doctor verifies that a
backend is configured, not that it answers. It is exactly why §9 opens with a one-known-good-row
pre-flight instead of a health command. Still unlocked: Facebook and Instagram (need OpenCLI plus the
dedicated account) and Exa semantic search (needs `npm install -g mcporter` + `mcporter config add`).

Adopt the ideas as well as the tools:

| Its idea                              | Applied here                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `doctor` before work                  | the one-known-good-row pre-flight above                                                   |
| declare which backend you are using   | say it in the run report, so a yield number is attributable                               |
| ordered backend fallbacks per channel | §4's chain: plain fetch → headless render → give up, and name which one produced each row |
| backends change, config should not    | never hardcode a reader into the yield claim — record reader **and** result               |

**Measured before adopting anything** (2026-08-19): its headline zero-config web reader,
`r.jina.ai`, returns **HTTP 451 from this machine for every URL** — see §4. So the piece that looked
like the free win is the piece that does not work here. Test the others the same way before planning
around them, and do not treat the README's "works immediately" as measurement.

**Where Scrapling must NOT go.** Its `StealthyFetcher` bypasses Cloudflare and spoofs browser
fingerprints. On an anonymous school website that is ordinary, sensible scraping. Aimed at a
platform we hold an irreplaceable logged-in account on, it is the **worst pairing available**:
evasion raises the stakes of detection on the one account we cannot re-buy. Same for a `--cdp-url`
attaching to an existing browser — the existing browser here is the vault. `scrape-guard` blocks
both shapes and leaves every anonymous run untouched, which is the whole reason to adopt it. Honour
`robots.txt` on the website lane; Scrapling makes it optional and we do not.

**If Agent Reach is installed, the account rule does not relax — it widens.** It does not log in for
you; its OpenCLI backend drives _the browser session you already have_, which on this machine is the
session vault holding Abdout's personal account. `scrape-guard` already matches its social
subcommands, and it was extended **before** the install rather than after. `agent-reach doctor`,
`install` and `check-update` are deliberately left unblocked. When `doctor` reports a **new**
active_backend for those channels, add that binary to the guard — it cannot discover the swap alone.

**What Scrapling buys the other sections**, beyond §4's rendering:

- **§5 directories.** ADEK's ArcGIS is plain JSON that curl already handles, but the portals still
  unmeasured (KHDA, `open.data.gov.sa`) are likely JS-heavy. Rendering is what makes them reachable.
- **§2 parsing durability.** `auto_save=True` / `adaptive=True` relocate elements by similarity when
  a layout changes. The About tab is exactly the kind of markup that silently reshapes, and a 600+
  row queue is exactly where a silent selector break costs the most.
- **Checkpointing and throttling, already required here.** Its spider `crawldir` gives resumable
  runs and AutoThrottle adapts delay to the server — §2 demands both today and hand-rolls them.

**Its MCP server is a separate decision from the library, and the answer differs.** Scrapling ships
an MCP for Claude. Useful for inspecting _one_ page interactively; wrong for the queue, because this
lane's rule is zero tokens per lead — 600+ pages through an MCP is 600+ pages of model context for
work a local extractor does free. Library for batches, MCP only for a one-off look.

**Ergonomic note.** The guard matches command _text_, so prose naming a tool and a platform in one
clause can trip it — writing this section did, twice. That is the conservative bias working as
intended on an account-loss risk. Edit these files with the Edit tool rather than a Bash heredoc,
and do not loosen the pattern to make documentation easier.

**Do not install Agent Reach's skill as a kun skill.** It ships a Claude Code `SKILL.md` whose description is
"MUST USE when the user wants to research/search anything, or mentions any platform or URL" — a
fleet-wide dispatch collision, and the listing budget has roughly 80 characters of headroom. Call
its CLI from this runbook instead.
