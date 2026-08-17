# Prompt — enrich the 3,156 schools

> Paste into a **new Claude Code session**. Work happens in `~/hogwarts` (code) against the
> Twenty CRM on `localhost:3100`. Saying **"enrich"** or **"scrap for hogwarts"** should already
> route you through `.claude/skills/scrape/SKILL.md` and the `lead` agent — read both first.

---

Fill the 3,156 school records in the hogwarts Twenty workspace with phone, website, Facebook, and
every other attribute we can legitimately obtain. Today 175 are contactable (5.5%). The goal is to
take that as high as the available sources actually allow, cheapest source first, and to **measure
the yield of each lane rather than assume it**.

## What these records are

They are **schools**, not companies. They live on Twenty's standard `Company` object because that
is what the workspace was built on — the API name stays `company`, but the workspace label should
read "School". First task, two minutes: rename `labelSingular`/`labelPlural` on the object metadata
so the UI stops calling a school a company. Do not rename the API field.

## Measured starting state (2026-08-17 — verify, do not trust blindly)

```
3,156 schools
  3,145  carry an OpenStreetMap element id in sourceUrl   ← the key handle
    608  have lat/lon stored in Twenty
    158  have a website
    153  have a phone
    119  have an email in principalContact
     53  have a Facebook page
     46  have a city;  10 have a state
```

By country: SA 1001 · EG 764 · SD 609 · AE 603 · QA 173. Mostly Gulf and Egyptian
private/international schools, plus the Sudan slice.

## Lane 1 — re-fetch the OSM tags the import threw away (FREE, do this first)

The original import took only name + coordinate from OpenStreetMap. **The elements carry much
more.** Measured on a random sample of 120 via Overpass:

| Tag                                                       | Share of sample |
| --------------------------------------------------------- | --------------: |
| any of phone / contact:phone / website / email / facebook |        **6.7%** |
| `name:en`                                                 |           38.3% |
| `addr:street`                                             |           15.8% |
| `grades`                                                  |           13.3% |
| `operator`                                                |            8.3% |
| `isced:level`                                             |            8.3% |
| `addr:city`                                               |            7.5% |
| `operator:type` (public vs private)                       |            5.0% |
| `school:gender`                                           |            4.2% |

Projected over 3,145 elements: **~210 new contacts** (95% CI is wide on n=120 — roughly 100–400;
report the real number after the full run, do not repeat this estimate as fact). Plus ~1,200
English names, ~500 street addresses, and — most valuable for tiering — `operator:type`,
`isced:level`, `grades` and `school:gender`.

**`operator:type=private` is the single most commercially useful tag we are missing.** Private
schools are the ones that pay. Map it into `schoolType` and let it drive tier.

Build it:

- Batch the 3,145 ids into Overpass queries (`node(id:…);way(id:…);relation(id:…)` + `out tags center;`).
  Keep batches ~120–200 — a 300-id batch timed out on the main endpoint. Retry across mirrors
  (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`), and treat an HTML body
  as failure: the error arrives as XHTML with HTTP 200, so a naive `res.json()` throws instead of
  reporting "server busy".
- `out center` also returns coordinates for ways and relations, which **backfills lat/lon on the
  ~2,537 rows that lack it** — that is what unlocks Lane 2.
- Write back through the REST API with `normalize-contacts.ts`'s rules applied to any phone found,
  and the fill-empty-never-replace-populated discipline from mkan's `sync-contacts-to-twenty.ts`.
  A conflict becomes a dated note, never an overwrite.

Zero cost, zero ToS risk, no rate-limit exposure beyond Overpass politeness. Land this before
considering anything paid.

## Lane 2 — Google Places (PAID: cost it, sample it, then decide)

Name + lat/lon → `formatted_phone_number`, `international_phone_number`, `website`,
`business_status`, `user_ratings_total`. This is the only lane that can plausibly reach the schools
OSM has nothing on.

**There is already a Google Cloud project** — hogwarts holds `GOOGLE_TRANSLATE_API_KEY` restricted
to the Translation API. Enabling Places there is a console change, not a new vendor.

Before spending anything:

1. Run a **50-school sample** across all five countries and report the actual hit rate for phone
   and for website separately. Arabic school names in Sudan may match far worse than in the UAE;
   assume nothing.
2. Publish the arithmetic: Places Text Search + Details per school × 3,000 at current list price,
   and what the sample says that buys. **Ask before spending** — the standing constraint is
   subscription-only, and this is the first thing in this plan that costs money.

If the sample is weak, say so and stop. A lane that returns 5% is not worth $50 and a week.

## Lane 3 — Facebook pages (the CDP scraper, carefully)

`twenty/scripts/sudan-schools-scraper/` drives a logged-in Chrome via CDP. Two rules, both
non-negotiable:

- **A dedicated Facebook account, never Abdout's.** Losing it also loses the Page tokens the social
  pipeline runs on.
- Extract the **About / Intro tab**, not the feed. The current extractor reads the feed, which is
  why its yield is near zero. Split Pages from Groups — a `/groups/` URL is a community, not a school.

Relocate it to `hogwarts/scripts/crm/` as part of this work; it currently sits in an
upstream-tracked fork guarded by a `divergence-guard` hook. Delete its `import-to-twenty.js` — it
writes raw SQL into every workspace with a fresh UUID per row and no dedup key, so re-running it
duplicates everything.

## Lane 4 — official directories (the only thing that reaches the long tail)

Ministry / regulator lists are the real answer for schools with no online presence at all: Saudi
MoE, UAE **ADEK** (Abu Dhabi) and KHDA (Dubai), Egypt MoE, Qatar MoEHE. These publish licensed-school
registers, often with contact details. Investigate availability and licence terms and report
before scraping anything — a public register is not automatically redistributable.

## Order, and the rule that governs it

Run **1 → 2 → 3 → 4**, and after each lane re-run `contact-gap.ts` and report the delta. Stop
escalating the moment a lane's measured yield stops justifying its cost or risk.

Hard rules:

- **Twenty is written only through the REST API.** Never `psql` into a workspace schema — it
  bypasses the metadata layer, search vectors and timeline, and it is exactly what the strangler
  rewrite does not preserve.
- **Dry-run by default, `--apply` to write.** mkan's discipline; keep it.
- **Never overwrite a populated field.** Fill empties; log conflicts as dated notes.
- **Re-running any importer must produce zero duplicates.** Dedup on a stable external id
  (`osm:<type>/<id>`, `fb:<pageId>`). Prove it by running twice and comparing counts.
- **No silent caps.** If a stage truncates — rate limit, sample, top-N — log what was dropped.
  A quiet truncation reads as "we covered everything".
- Phones go through `normalize-contacts.ts`: E.164, and `MOBILE`/`LANDLINE`/`NOT_DIALABLE`
  labelled, because only mobiles can be reached on WhatsApp and a landline in a WhatsApp campaign
  is a silent non-delivery that looks like disinterest.

## Done means

- A before/after table per lane: schools gained a phone, a website, a Facebook page, an email, and
  the attribute fields.
- `contact-gap.ts` re-run and its new split reported.
- Every importer proven idempotent by a second run.
- One honest sentence on what remains unreachable and what it would take — the long tail is a
  directory-access problem, not a scraping problem, and the report should say so if that is still
  true at the end.

## Context files

- `~/.claude/plans/reference-kun-and-twenty-cosmic-meteor.md` — the approved lead-engine plan
- `.claude/memory/project_lead_engine.md`, `.claude/memory/reference_crm.md`
- `hogwarts/scripts/crm/{twenty-rest,contact-gap,normalize-contacts}.ts`
- `mkan/scripts/crm/` — the canonical pipeline (52 files); `contact-hunt.ts --worksheet` is the
  human lane for whatever automation cannot reach
- Twenty token: `security find-generic-password -s databayt-twenty -a hogwarts -w`;
  `TWENTY_API_URL=http://localhost:3100` (**not** 3000 — that is hogwarts' dev server)
