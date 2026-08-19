---
name: scrape
description: Lead acquisition — contact gap first, discovery last
when_to_use: "Finding, enriching, tiering or reaching leads in the Twenty CRM. Triggers on: scrap, scrape, scrap facebook, scrap whatsapp, scrap facebook for hogwarts, scrap for mkan, leads, prospect, contact gap, enrich, outreach, pipeline health, who should we contact, find schools, اسحب, جمع بيانات, عملاء محتملين. NOT /health (engine drift), /measure (social numbers), /report (a bug)."
argument-hint: "[facebook|whatsapp|website] [for <product>] [--apply]"
---

# Scrape — the lead acquisition runbook

**The measured truth this runbook exists to enforce: discovery is the low-yield lane.**
A full scrape run adds **+15** contactable rows — 505 of the scraper's 817 names were already in the
CRM. So: measure the gap, work the contactable, and treat raw discovery as a deliberate choice
someone made on purpose — never the default.

**Counts are NOT hardcoded in this file, on purpose.** Read them from
`<repo>/scripts/crm/.data/contact-gap.json` (or re-run §1). This paragraph used to carry them and
they went 50× stale inside two days — it claimed 13 Facebook rows while the CRM held 639. An
instruction file that says "do not re-derive" must not itself be the stale source. The `lead` agent
card is the one place a live snapshot lives; everything else reads the artifact.

**Two lanes are now settled, so nobody re-litigates them:**

- **OSM re-fetch is DONE and exhausted** (2026-08-17). `hogwarts/scripts/crm/osm-refetch.ts` re-read
  all 3,145 elements; contactable moved **175 → 176**, because the CRM already held OSM's contact
  tags. It did bank +2,528 coordinates and +1,106 English names. A re-run plans **0 writes** — if
  you are about to propose "re-fetch the OSM tags", it already happened.
- **Government open data is the highest free yield, measured.** ADEK's ArcGIS layer gives 225 Abu
  Dhabi private schools at 100% phone/email/website; exact-name matching alone reaches **48**
  unreachable AE rows. That is 48× the entire OSM lane. Build §5 before anything paid or scraped.

Full numbers and the hard rules: `.claude/agents/lead.md`. Code lives in the product repos —
`hogwarts/scripts/crm/` and `mkan/scripts/crm/` (canonical). **kun holds no scraper code.**

## Argument: $ARGUMENTS

Polymorphic on argument, like `/handover`:

| Argument                              | Mode                                           |
| ------------------------------------- | ---------------------------------------------- |
| _(none)_                              | **Gap report** — measure, then recommend. §1   |
| `facebook`                            | The FB Page About/Intro lane. §2               |
| `whatsapp`                            | Harvest numbers + hand to the sender. §3       |
| `website`                             | Fetch + extract from a domain. §4              |
| `for <product>` / `<x> for <product>` | Resolve scope, then run the above. §0          |
| `--apply`                             | Write. Absent = dry run. Always dry-run first. |

## §0 — Resolve product scope

Resolve the product from `.claude/memory/repositories.json` (`repositories.*[].id` → `.local`).
Default: **hogwarts**. `mkan`'s lead is the property **host**, not a school — same machinery,
different object.

```bash
export TWENTY_API_URL=http://localhost:3100          # NEVER 3000 — that is hogwarts' dev server
export TWENTY_API_KEY=$(security find-generic-password -s databayt-twenty -a <product> -w)
```

Off this Mac: `https://twenty-api-2.tail42a5c4.ts.net`. The CRM is down whenever the laptop is.

## §1 — No argument: report the gap, recommend the move

```bash
cd <product-local> && npx tsx scripts/crm/contact-gap.ts   # read-only by design
```

Report the split **as the command prints it** — CONTACTABLE / FB_PAGE / WEBSITE / MAP_ONLY, plus
"Workable NOW" — and then **recommend the highest-yield next move**, which is almost never "scrape
more". Rank by what the run actually returned:

1. **Work the contactable unworked** (the "Workable NOW" line) → `/outreach`. Yield: immediate, and
   it needs no enrichment run to start.
2. **Enrich the rows that still carry a signal** — FB_PAGE + WEBSITE (§2, §4). That sum IS the
   enrichment ceiling; state it as a number you just read, never one you remembered.
3. **Directories** (§5). The only lane that reaches MAP_ONLY, and the highest measured free yield.
4. **Discovery** (§6). +15 measured. Only on an explicit decision, and say the number first.

Never quote a count this file or the agent card taught you without checking it against the run.
Every previous read of this funnel was optimistic and each was corrected only by measuring.

## §2 — `facebook`: the About/Intro lane

Read `fbQueue` from `contact-gap.json` for the size of the surface, and say it before running. It
grew from 13 rows to the high hundreds once the About-tab pass landed, so this is now the **largest
automated lane** — treat a stale number here as a planning error, not a detail.

- Extract from the **About / Intro tab**, not the feed — the feed is why the earlier yield was near
  zero; schools publish phone and WhatsApp on About.
- Split Pages from Groups. A `/groups/` URL is not a school lead.
- Reuse the existing phone regex and `extractWhatsApp` in `tier4-enricher.js`; do not write a third.
- **Checkpoint** (`dorker_checkpoint.json` pattern) so a stop is resumable, and log what the stop dropped.

**Account + throttle warning — read this every time.** The scraper drives a logged-in Chrome via
CDP. Use a **dedicated Facebook account**, never Abdout's: losing it also loses the Page tokens the
whole social pipeline depends on. Throttle every run. The `scrape-guard` PreToolUse hook blocks the
command when the profile is not the dedicated one, and warns when no throttle is set — if it fires,
fix the run, don't route around it.

## §3 — `whatsapp`: say the honest thing first

**"Scrape WhatsApp" is not a thing.** WhatsApp has no scrapeable surface — no directory, no public
profile index, and nothing to crawl. Two real capabilities sit behind the phrase, and this mode
routes to them:

1. **Harvest numbers** from the public web and Facebook Page About tabs (that is §2 and §4), then
   `normalize-contacts.ts` to E.164 — and **label mobile vs landline**. Barely a quarter of the
   contacts are mobile; the rest are switchboards, and a landline in a WhatsApp campaign is a
   silent non-delivery that reads as disinterest. Count them, do not assume the ratio held.
2. **Send** through `hogwarts/src/lib/whatsapp/` — the Evolution API sender that already exists with
   retry, rate limiter, templates and dispatch. **Never build a second sender.**

And say the channel truth: **for the MENA-wide list, email reaches more rows than WhatsApp.**
WhatsApp leads for the Sudan slice, where the diaspora directories delivered mobile numbers — the
channel is a per-market decision, not a global one.

Send guardrails live in the sender, not bolted on: dedicated number, separate Evolution instance
from school notifications, warm-up ramp 10→20→30/day, randomized 40–180s gaps, stop-on-reply,
`OUTREACH_SEND=off` kill switch.

## §4 — `website`: fetch + extract

Read `webQueue` from `contact-gap.json` for the count. Fetch the domain, extract contact from the
usual pages (`/contact`, `/about`, footer), same regexes as §2. Cheap, no account risk, no ban risk.

**Measured 2026-08-19 on three real `webQueue` rows, so nobody re-tests it next week:**

| Attempt                       | Result                                                                      |
| ----------------------------- | --------------------------------------------------------------------------- |
| plain `curl -sL` + browser UA | **1 of 3** yielded (`qla.edu.qa` → email + `+974` phone)                    |
| the other 2                   | one JS-rendered shell (5.6 KB, no contact in HTML), one dead host (0 bytes) |
| Jina Reader `r.jina.ai/<url>` | **HTTP 451 on every URL from this machine** — systemic, not per-site        |

So the residual is **JS-rendered sites and dead hosts**, not parsing. `tpsdxb.com` was confirmed:
`/`, `/contact` and `/contact-us` all return ~5.6 KB of `<noscript>` plus a nonce'd script tag and
zero contact. Nothing reaches a dead host; a headless render reaches the rest.

**The fix is [Scrapling](https://github.com/D4Vinci/Scrapling)'s `DynamicFetcher`** (BSD-3, ~75k★,
released weekly) — real Playwright Chromium, so the page is rendered before extraction. It also
ships the CLI that Jina Reader would have been, except it runs **locally**, which makes the 451
block irrelevant:

```bash
scrapling extract get   'https://qla.edu.qa'    contact.md    # static, fast path
scrapling extract fetch 'https://www.tpsdxb.com' contact.md --solve-cloudflare   # rendered
```

Order the chain cheapest-first and **record which fetcher produced each row**: plain fetch →
`DynamicFetcher` → dead. A row found by rendering is a row that plain curl will keep missing, so the
attribution is what tells you whether the lane is worth re-running.

Jina Reader stays **unavailable here** — 451 for `example.com` as readily as for a school site, so
it is an IP/region block on this machine, not the target. Re-test before planning around it.

## §5 — Official directories (build this next)

The only lane that reaches the 2,935 MAP_ONLY rows, and the only free one with a measured yield
worth the name. Regulators publish licensed-school registers, often with contact details:

| Source                  | Endpoint                                                                                | Measured                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **ADEK** (Abu Dhabi)    | `arcgis.sdi.abudhabi.ae/agspublish/rest/services/OpenData/ADSDI_OpenData/MapServer/212` | 225 schools, **100%** phone/email/website; 48 unreachable AE rows matched |
| **KHDA** (Dubai)        | `dubaipulse.gov.ae/data/khda-schools/…` (+ web API)                                     | contact details published; not yet measured                               |
| Saudi MoE / SDAIA       | `open.data.gov.sa`                                                                      | not yet investigated — SA is the biggest slice (1,001)                    |
| Egypt MoE · Qatar MoEHE | —                                                                                       | not yet investigated                                                      |

ADEK's emails are mostly regulator-routed (`9338@adek.gov.ae`), which is deliverable but not a
direct line — say so rather than counting them as warm. Phones are local-format and must go through
`normalize-contacts.ts`. **Check each register's licence before redistributing it**; enriching our
own CRM is ordinary use, republishing the register is not.

Matching is the real work, not fetching: normalize Arabic (strip diacritics, ألف/همزة, ة/ه, ى/ي,
and the boilerplate `مدرسة|مدارس|الخاصة|الدولية`), match EN and AR names both ways, and use the
coordinates §1's OSM re-fetch just banked to break ties. Dedup key: `adek:<SCH_ESIS_ID>`.

## §6 — Discovery (deliberate only)

Never the default. Before running, state the measured yield (**+15**) and get an explicit yes.
Then: `tier2-osm.js` / `tier1-dorker.js` / `tier3-fb-matrix.js` from the relocated scraper.

**`import-to-twenty.js` is forbidden.** Fresh `crypto.randomUUID()` per row with
`ON CONFLICT (id) DO NOTHING` = no dedup key, and it writes raw SQL into **every** workspace. Use
`twenty-upsert` (dedup on a stable external id — `fb:<pageId>` / `osm:<nodeId>`).

## §7 — Load into Twenty

**REST only, never SQL.** Dry-run, then `--apply`. `stage=COLD`, `leadStatus=UNREVIEWED`, `source`
set, **fill-empty-never-replace-populated** — a conflict becomes a dated note, not an overwrite.

Run `--apply` **twice**; the company count must be identical after the second run. That is the
dedup test, and it is not optional.

## §8 — Measure the yield

The `scrape-yield` PostToolUse hook appends the contact-gap delta to
`.claude/logs/scrape-runs.log` after every run, so yield is measured rather than assumed. Read it
back and report the delta — including when it is zero. A run that added nothing is a finding.

## §9 — Backends: check the reader before blaming the lane

Every reading lane above has a **backend**, and a lane that returns nothing is ambiguous until you
know which one failed: the target had no contact, or the reader was broken. Separate those before
concluding anything — a broken reader reported as "low yield" is how a good lane gets abandoned.

**Pre-flight, before any batch run:** try the reader on **one** row you have already confirmed by
hand. If that row fails, the reader is down; stop and fix it rather than burning the queue and
recording a false zero.

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

**Install status: neither is installed, and Python is not the blocker.** An earlier note here said
3.9.6 blocked them; that was wrong. `python3` is 3.9.6 but **`python3.11` (3.11.15) and `uv` are
both present**, so each installs isolated without touching the system interpreter:

```bash
uv tool install 'scrapling[fetchers]' && scrapling install   # fetchers + browsers
```

Adopt the ideas now, the tools on approval:

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

## Deterministic fan-out

For a full `discover → enrich → tier → gap-report` pass, run the saved workflow:
`Workflow({ name: "scrape", args: { product: "hogwarts", stages: ["enrich","tier","gap"] } })`.
Dry-run by default; every stage that truncates logs what it dropped.

## Exit gate

- The gap split is reported with real numbers, not remembered ones.
- The recommendation names a **yield** and ranks discovery last unless someone chose otherwise.
- Any write ran dry first, then `--apply` twice with an identical count.
- Whatever was dropped is in the log.

## Not this skill

`/health` = engine config drift · `/measure` = published-social numbers · `/report` = a user-filed
bug · `/social` = brand publishing. Closing and pricing a deal is the `revenue` agent.
