---
name: jobs
description: Abdout's income lane — scrape jobs, gigs and tenders, draft applications, track on sales.databayt.org
when_to_use: "Finding paid work for Abdout: Kigali roles, remote dev, AI-training gigs, freelance, tenders, protection contracts. Triggers on: jobs, find work, apply, opportunities, gigs, tenders, did anyone reply, وظائف, فرص, مناقصات. NOT /scrape (sales leads)."
argument-hint: "[scrape|apply [n]|update|report] [--lane <campaign>]"
---

# Jobs — scrape → apply → update

**The measured truth this runbook exists to enforce: the bottleneck is APPLYING, not finding.**
On 2026-09-26 all 26 records on the board had sat at TO_APPLY for a month. Discovery without
applications is zero income. Every `jobs` run ends with drafts in front of Abdout, not a longer list.

**Priority (Abdout, 2026-09-26):** Rwanda/Kigali first → remote income (remote dev, AI-training,
freelance) → engineering contracts abroad. Goal: the low-hanging fruit that pays soonest.

## The pieces (all in kun)

| Step                | Tool                                                                           | Where                                                                                     |
| ------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Board               | Twenty object `kigaliOpportunity` ("Jobs & Opportunities"), workspace Databayt | sales.databayt.org · REST `localhost:3100` · Keychain `databayt-twenty`/`databayt`        |
| Lanes               | 9 campaigns → CRM `campaign` select                                            | `src/lib/jobs/campaigns.ts` (mirror: `jobs/kigali-campaigns.json`)                        |
| Scrape              | deterministic adapters → `jobs/inbox/<date>-<source>.json`                     | `pnpm jobs:discover` (`scripts/jobs/discover.mjs`)                                        |
| Scrape (connectors) | Indeed MCP `search_jobs` · web research                                        | in-session only — claude.ai connectors are absent in `claude -p`                          |
| Ingest              | score, dedup, drop expired/ineligible, write Neon, push board                  | `pnpm jobs:ingest [--dry-run]`                                                            |
| Queue               | TO_APPLY ranked band → deadline → score                                        | `pnpm jobs:queue [--limit n] [--json] [--stale] [--summary]`                              |
| Mark                | move a record (board + Neon)                                                   | `pnpm jobs:mark <crm-id> <status> [note]`                                                 |
| CVs                 | web + protection, Kigali number                                                | `jobs/cv/Osman_Abdout_{Web_Developer,Protection_Engineer}.pdf` (HTML sources beside them) |
| Research            | employers, boards, eligibility gates                                           | `jobs/KIGALI-TARGETS.md`, `jobs/REMOTE-TARGETS.md`, `references/sources.md`               |

`jobs/` is gitignored — it holds personal documents. Never commit, upload or paste the CVs anywhere
except as an attachment Abdout sends himself.

## Verbs

### `jobs` — the full cycle (default)

`scrape` → `ingest` → `apply 5` → `report`. Stop after the drafts; Abdout sends.

### `jobs scrape`

1. `pnpm jobs:discover` (all adapters; test one with `--source <id> --limit 1` first if an adapter changed).
2. In-session lanes the script can't reach: Indeed MCP for remote + engineering contracts; the AI-training
   platforms' role pages; tender portals that need a browser. Write items to
   `jobs/inbox/<date>-<lane>.json` in the inbox shape (below).
3. `pnpm jobs:ingest --dry-run` → read it → `pnpm jobs:ingest`.

Inbox item = `NormalizedJobInput` (`src/lib/jobs/types.ts`) plus `campaign`, `deadline`
(`YYYY-MM-DD`|`rolling`), `applyMethod` (`email:<addr>`|`portal:<url>`|`in-person`|`tender-portal:<url>`),
`note`, and for remote work `rwandaEligible`, `payoutMethod`, `timeToFirstPay`.

### `jobs apply [n]` — drafts only, Abdout submits

**Hard rule: never send an email, submit a form, or register an account.** Draft, stage, stop.

1. `pnpm jobs:queue --limit n --json`.
2. Per record: read the posting (`url`), pick the CV by lane (protection/electrical/marine/engineering
   contract → Protection CV; everything else → Web CV), and write the tailored text from real CV facts
   (`jobs/cv/*.html`, `src/lib/jobs/cv-evidence.ts`) — never invent a credential, date or number.
3. By apply method:
   - `email:` → Gmail `create_draft` (to, subject, body; note the CV file to attach — the connector
     can't attach local files). Drafts land in the connector's Gmail account.
   - `portal:` / `tender-portal:` → write `jobs/packets/<crm-id>.md`: the answers to the portal's
     questions, cover letter, which CV, the URL. Optionally pre-fill with the headed browser and **stop
     before submit**.
   - `in-person` → a 5-line pitch + what to carry (CV printout, certificates from the Figma archive).
4. Show Abdout the list: draft/packet per record. When he says one went out → `pnpm jobs:mark <id> applied`.

AI-training platforms and vetted networks (Mindrift, Outlier, Alignerr, Andela, Proxify…) are a
sign-up, not a letter: the packet is the profile text, the exact role to pick, and the test to prep for.

### `jobs update`

1. Gmail `search_threads` for replies from applied companies (and ask about Outlook/hotmail — the CVs
   carry `osmanabdout@hotmail.com`, which no connector reads).
2. Classify → `pnpm jobs:mark <id> response|interview|rejected|offer "<one line>"`.
3. `pnpm jobs:queue --stale` → draft a follow-up for each APPLIED ≥ 7 days; ≥ 21 days with nothing
   → `jobs:mark <id> withdrawn` (board: ARCHIVED).

### `jobs report`

`pnpm jobs:queue --summary` + applied this week, replies, interviews, which lane converts. The number
that matters: **applications sent per week** — if it is 0, say so first.

## Gotchas

- The CRM API runs in Docker on the Mac (`:3100`). Mac asleep = no board. 401 "Token invalid" = the
  key was signed with an old APP_SECRET → re-sign (memory `reference_crm.md`), don't re-mint in the UI.
- `rwandajob.com` and We Work Remotely block bots — browse by hand.
- Eligibility beats fit: Lemon.io excludes Africa; many US remote roles need US work authorisation.
  Check the region line before writing a word.
- The matcher scores from software + CV engineering evidence; AI-training and tender rows score low by
  construction. Rank by band (the queue does), not by score alone.
- kun's Neon is shared by prod and local — `ingest` writes prod. Dry-run first.
