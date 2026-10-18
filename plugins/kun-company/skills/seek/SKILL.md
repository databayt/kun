---
name: seek
description: The open opportunity loop anyone runs from their own profile — find, tailor, apply, follow up
when_to_use: "Seek for a new person, or a track beyond jobs. Triggers on: seek, set up seek, scholarship, admission, visa, منحة دراسية, قبول جامعي, تأشيرة. Abdout's own loop is /jobs."
argument-hint: "[setup|status|sweep|wave|send|inbox|pause|resume]"
---

# Seek — the opportunity loop

One loop, five beats, any person: **discover → tailor → apply → follow up → brief**. It runs in the
person's own Claude Code on their own subscription — no hosted account, nothing of theirs on our
servers. Public page: `kun.databayt.org/<lang>/seek`. Docs: `content/docs/seek.mdx`.

Abdout's own instance (Twenty board, Kigali lanes, Slack #jobs) is the **`jobs`** skill — read it
for the full operational detail of a mature setup.

## Tracks

Defined in `src/lib/seek/tracks/` (`TRACKS`, `getTrack()`): what each track discovers, which
documents it writes, its status pipeline, follow-up days and the statuses that trigger a brief.

| Track | Status | Documents |
|---|---|---|
| `job` — jobs, gigs, freelance, AI-training, tenders | **live** (the loop below) | CV, cover letter, form answers, proposal |
| `scholarship` | soon | CV, statement, document checklist |
| `admission` | soon | CV, statement, document checklist |
| `visa` | soon | cover letter, document checklist |
| `funding` | soon | pitch deck, proposal, form answers |

A "soon" track becomes live when it has a discover source (a `seek.sweep` brief already works for
any search) and artifact templates; flip `status` in its track file and add the test case.

## Setup (a new person)

1. Clone `databayt/kun`, `pnpm install`.
2. `mkdir -p seek && cp scripts/seek/profile.example.json seek/profile.json` — or keep the data
   anywhere and export `SEEK_HOME=/path/to/data`. `seek/` is gitignored.
3. Fill the profile with them — never guess a field:
   - `identity` — name, email, phone, city, country, `utcOffsetHours`, a one-line `bio`.
   - `work`, `authorization`, `compensation`, `languages`, `skills.yes/no`, `answers` — what
     application forms ask.
   - `seek.sweep` — the daily search brief in prose (`{today}`, `{month}` are filled in), the
     allowed `campaigns`, a `campaignGuide`, default `location`, `bidCampaigns`.
   - `seek.strategy` — what they want first and why (the weekly planner reads it).
   - `seek.tailorRules` — how a CV may present their record.
4. Put their CVs (HTML) in `<data>/cv/` and run `pnpm seek:facts` — `facts.json` is the only
   source of claims the letter gate accepts.
5. Optional: `loop.config.json` in the data dir for `slackTarget`, `jobsChannel`, `briefWhatsApp`,
   caps and `focus`. Unset = off; the loop still runs and reports to the terminal.

Paths resolve in `scripts/seek/lib/paths.mjs`; identity in `scripts/seek/lib/identity.ts`.

## Run

| Beat | Command | Notes |
|---|---|---|
| discover | `pnpm seek:google`, `pnpm seek:discover`, `pnpm seek:ingest` | the sweep reads `seek.sweep`; skipped without one |
| tailor | `pnpm seek:wave`, `pnpm seek:tailor` | `claude -p` letters + CVs from facts only, then the send gate |
| apply | `pnpm seek:send --apply`, `pnpm seek:ats` | email via Mail.app on macOS; portals become packets |
| follow up | `pnpm seek:followup --apply` | day 7 / 14, archive day 21 |
| brief | `pnpm seek:inbox`, `pnpm seek:digest` | replies classified; interview/offer → notify + brief |
| all of it | `pnpm seek:loop --install` | launchd every 30 min; `--status`, `--pause`, `--resume` |
| console | `pnpm seek:pull --apply` (tick start), `pnpm seek:push --apply` (tick end) | web console at `/seek/board`: pull applies queued web commands through the loop's own tools, push mirrors board + ledger + switches to Neon under `SEEK_INSTANCE` |

## Guards — never cross them

- **Truth:** every number, date and credential in a letter or CV comes from `facts.json` /
  the career record or the posting. The send gate (`src/lib/jobs/send-gate.ts`) rejects the rest.
- **Consent:** the person's own name, mailbox and number. Never send for someone who has not set
  up the profile themselves, and never put one person's data in another's data dir.
- **Kill switch:** `<data>/.send-off` or `pnpm seek:loop --pause` stops all sending.
- Caps, the send window and the veto period live in `scripts/seek/config.ts` (`HARD_LIMITS`).
