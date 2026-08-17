---
name: scrape
description: Lead acquisition — contact gap first, discovery last
when_to_use: "Finding, enriching, tiering or reaching leads in the Twenty CRM. Triggers on: scrap, scrape, scrap facebook, scrap whatsapp, scrap facebook for hogwarts, scrap for mkan, leads, prospect, contact gap, enrich, outreach, pipeline health, who should we contact, find schools, اسحب, جمع بيانات, عملاء محتملين. NOT /health (engine drift), /measure (social numbers), /report (a bug)."
argument-hint: "[facebook|whatsapp|website] [for <product>] [--apply]"
---

# Scrape — the lead acquisition runbook

**The measured truth this runbook exists to enforce: discovery is the low-yield lane.**
Automated enrichment caps at **+40** rows. The Sudan scraper adds **+15**. Meanwhile **130 tier-A/B
schools are contactable and unworked right now.** So: measure the gap, work the contactable, and
treat raw discovery as a deliberate choice someone made on purpose — never the default.

Full numbers and the hard rules: `.claude/agents/lead.md`. Code lives in the product repos —
`hogwarts/scripts/crm/` and `mkan/scripts/crm/` (canonical). **kun holds no scraper code.**

## Argument: $ARGUMENTS

Polymorphic on argument, like `/handover`:

| Argument                              | Mode                                           |
| ------------------------------------- | ---------------------------------------------- |
| _(none)_                              | **Gap report** — measure, then recommend. §1   |
| `facebook`                            | The FB Page About/Intro lane (13 rows). §2     |
| `whatsapp`                            | Harvest numbers + hand to the sender. §3       |
| `website`                             | Fetch + extract from a domain (27 rows). §4    |
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

Report the split as measured — CONTACTABLE / FB_PAGE / WEBSITE / MAP_ONLY — and then **recommend
the highest-yield next move**, which is almost never "scrape more":

1. **Work the contactable unworked** (130 tier-A/B today) → `/outreach` drafting. Yield: immediate.
2. **Enrich the 40 with a signal** (§2 + §4). Yield: ≤40 rows, ceiling, measured.
3. **Discovery** (§5). Yield: +15 measured. Only on an explicit decision, and say the number first.

If the split has moved materially since 2026-08-17, say so — the agent card's numbers are a
snapshot, and a drifted snapshot is worth flagging rather than quietly using.

## §2 — `facebook`: the About/Intro lane

Only **13 rows** have a Facebook page. That is the whole surface. Say it before running.

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
   `normalize-contacts.ts` to E.164 — and **label mobile vs landline**. Only **45 of 175** contacts
   are mobile; a landline in a WhatsApp campaign is a silent non-delivery that reads as disinterest.
2. **Send** through `hogwarts/src/lib/whatsapp/` — the Evolution API sender that already exists with
   retry, rate limiter, templates and dispatch. **Never build a second sender.**

And say the channel truth: **119 rows carry an email; email is the larger channel for this
MENA-wide list.** WhatsApp is right for the Sudan slice.

Send guardrails live in the sender, not bolted on: dedicated number, separate Evolution instance
from school notifications, warm-up ramp 10→20→30/day, randomized 40–180s gaps, stop-on-reply,
`OUTREACH_SEND=off` kill switch.

## §4 — `website`: fetch + extract

27 rows. Fetch the domain, extract contact from the usual pages (`/contact`, `/about`, footer),
same regexes as §2. Cheap, no account risk, no ban risk.

## §5 — Discovery (deliberate only)

Never the default. Before running, state the measured yield (**+15**) and get an explicit yes.
Then: `tier2-osm.js` / `tier1-dorker.js` / `tier3-fb-matrix.js` from the relocated scraper.

**`import-to-twenty.js` is forbidden.** Fresh `crypto.randomUUID()` per row with
`ON CONFLICT (id) DO NOTHING` = no dedup key, and it writes raw SQL into **every** workspace. Use
`twenty-upsert` (dedup on a stable external id — `fb:<pageId>` / `osm:<nodeId>`).

## §6 — Load into Twenty

**REST only, never SQL.** Dry-run, then `--apply`. `stage=COLD`, `leadStatus=UNREVIEWED`, `source`
set, **fill-empty-never-replace-populated** — a conflict becomes a dated note, not an overwrite.

Run `--apply` **twice**; the company count must be identical after the second run. That is the
dedup test, and it is not optional.

## §7 — Measure the yield

The `scrape-yield` PostToolUse hook appends the contact-gap delta to
`.claude/logs/scrape-runs.log` after every run, so yield is measured rather than assumed. Read it
back and report the delta — including when it is zero. A run that added nothing is a finding.

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
