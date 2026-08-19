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

**Account + throttle rule — read this every time.** Use a **dedicated account**, never Abdout's:
losing it also loses the Page tokens the whole social pipeline depends on. Throttle every run. The
`scrape-guard` PreToolUse hook **blocks** (exit 2) when no dedicated identity is declared, and
**escalates to you** (`permissionDecision: "ask"`) when a run declares no throttle — so an
unthrottled run now stops and waits for a human instead of proceeding with a warning. If either
fires, fix the run; don't route around it.

Two vectors, only one of them inspectable: the bespoke scraper is CDP-on-9222 and the hook can read
which Chrome profile backs that port, but agent-reach/OpenCLI drives your **real desktop Chrome**
via a daemon on `127.0.0.1:19825` with no port and no profile to read. The declaration rule is what
covers the second one.

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

**Measured on three real `webQueue` rows:** plain `curl` yielded 1 of 3; the residual is JS-rendered shells and dead hosts, not parsing. Jina Reader is 451-blocked from this machine. Full table and the `tpsdxb.com` diagnosis: `.claude/skills/scrape/references/backends.md`.

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

A lane that returns nothing is ambiguous until you know which failed: the target had no contact, or
the reader was broken. **Pre-flight before any batch run:** try the reader on ONE row you have
already confirmed by hand. If that row fails the reader is down — stop and fix it, rather than
burning the queue and recording a false zero.

| Tool            | Lane                                               | Account risk               |
| --------------- | -------------------------------------------------- | -------------------------- |
| **Scrapling**   | Anonymous: school websites, government registers   | **None** — nothing to lose |
| **Agent Reach** | Logged-in social: Facebook, Instagram (§2's rules) | **High** — a real session  |

Install commands and their two traps, the measured findings, `agent-reach doctor`'s
config-vs-liveness boundary, the MCP-vs-library decision, and where Scrapling must NOT go:
`.claude/skills/scrape/references/backends.md`. Read it when a reader misbehaves or before
installing or swapping one — not on every run.

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
