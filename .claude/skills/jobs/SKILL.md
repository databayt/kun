---
name: jobs
description: Abdout's income lane — scrape jobs, gigs and tenders, draft applications, track on sales.databayt.org
when_to_use: "Finding paid work for Abdout: Kigali roles, remote dev, AI-training gigs, freelance, tenders, protection contracts. Triggers on: jobs, find work, apply, opportunities, gigs, tenders, did anyone reply, وظائف, فرص, مناقصات. NOT /scrape (sales leads)."
argument-hint: "[status|scrape|wave|send|inbox|hold|learn|pause|resume]"
---

# Jobs — the self-running loop: fetch → wave → send → read → follow up → learn

**The measured truth this runbook exists to enforce: the bottleneck is SENDING, not finding.**
On 2026-09-26 all 26 board records had sat at TO_APPLY for a month. Since 2026-09-27 the loop sends
email applications itself — gated, capped, vetoable — so the question each run is "what did the loop
hold, and why", not "what should I draft".

**Priority (Abdout, 2026-09-26):** Rwanda/Kigali → remote income (remote dev, AI-training, freelance) →
engineering contracts abroad. **Send mode (2026-09-27): auto-send with a daily cap** — email only;
portals, platforms, tenders and bids stay packets Abdout submits. **Learning proposes, Abdout adopts.**

## The loop (launchd `com.databayt.jobs-loop`, every 30 min — `pnpm jobs:loop --status`)

| When (Kigali) | Step | Script | Tokens |
|---|---|---|---|
| ≥07:00 daily | discover (7 adapters) + ingest | `jobs:discover`, `jobs:ingest` | 0 |
| ≥07:00 Mon–Fri | wave: tailor letters, gate → QUEUED / HOLD | `jobs:facts`, `jobs:wave` | claude -p |
| after wave | digest → Slack DM via `hermes send` | `jobs:digest --send` | 0 |
| ≥10:00–17:00 Mon–Fri | send QUEUED (after a 2h veto) + APPROVED | `jobs:send --apply` | 0 |
| 08:00–22:00 | read hotmail replies → move cards, alert | `jobs:inbox` | 0 |
| ≥16:00 Mon–Fri | templated follow-ups day 7/14, archive day 21 | `jobs:followup --apply` | 0 |
| Fri ≥17:00 | learn: outcomes by variant/lane/wave, ≤2 inactive proposals | `jobs:learn --propose --send` | claude -p |

**Board states:** TO_APPLY → QUEUED (sends next window) → APPLIED → RESPONSE/INTERVIEW/OFFER/REJECTED;
gate fail / needs input → HOLD (`holdReason` says what) → Abdout fixes + moves to APPROVED → sends.
**Veto:** move a QUEUED card to Hold/Archived before it sends. **Pause everything:** `pnpm jobs:loop --pause`.

**Guards (all in code):** kill switch `jobs/.send-off` · window Mon–Fri 09–17 · cap 5/day until
2026-10-11 then 10 (`jobs/loop.config.json` overrides) · one per company per run · 30-day no-repeat ·
send gate (`src/lib/jobs/send-gate.ts`): no placeholders, 120–350 words, names company + role, every
number backed by `jobs/facts.json` or the posting, recipient appears on the posting, CV 1–2 pages,
extra-document asks → HOLD.

## ATS lane — portal forms (since 2026-09-27, goal ~100/day)

`pnpm jobs:ats prepare` (daily, in the loop) → `pnpm jobs:ats submit --apply` (per tick, 09–20).
- **Greenhouse: auto-submitted.** Answers from `jobs/profile.json` via `src/lib/jobs/ats-answers.ts`;
  Greenhouse emails an 8-char code to hotmail — Abdout approved reading it (Mail.app) and entering it.
- **Ashby + Lever: never auto-submitted** — Ashby's spam filter and Lever's hCaptcha block bots, and the
  rule is **CAPTCHA/bot block → HOLD, never evade**. `prepare` writes their packet and holds the card the
  same morning (never QUEUED — since 2026-09-28). Paste-ready packets live in `jobs/packets/ats/`
  (every field's answer, written answers, cover letter, CV path); the digest lists the best six.
- **Truth rules:** a required question the profile can't answer truthfully holds the card, quoted.
  Honeypots ("leave this field blank") are never filled. Self-ID questions always declined.
- **Location:** `openToRwanda()` in discover.mjs — bare Remote or a named open region only
  ("<Country> Remote" = must live there). US `City, ST` postings are US-remote.
- Boards: `jobs/ats-boards.json` (226+), seeded by `node scripts/jobs/ats-seed.mjs <remote-jobs clone>`
  or `--yc <yc all.json>`; merge, never replace.
- One application per company per day across email and ATS. Daily total cap 100 (config), hotmail 40.

## Pieces

| Thing | Where |
|---|---|
| Board | Twenty `kigaliOpportunity` ("Jobs & Opportunities") · sales.databayt.org · REST `localhost:3100` · Keychain `databayt-twenty`/`databayt` · client `scripts/jobs/board.ts` |
| Mail | Mail.app, account **osmanabdout@hotmail.com** — `scripts/jobs/mail-send.applescript`, `mail-read.applescript`. No account → send/inbox refuse, never fall back to another sender |
| Letters | `jobs/templates/letters/<lane>@<n>.md` · follow-ups `follow-up-{1,2}@<n>.md` |
| CVs | `jobs/cv/*.html` → `pnpm jobs:cv` (playwright PDF) · registry `jobs/variants.json` |
| Variants | `pnpm jobs:variant` (list, sends) · `activate <id>` / `deactivate <id>` — two active per lane split 50/50 |
| Ledger | `jobs/ledger.jsonl` — every queued/hold/sent/followup/reply/error line; learn's raw data |
| Reports | `jobs/learn/<date>.md` · packets `jobs/packets/` |
| Alerts | `scripts/jobs/notify.ts` → `hermes send` (no model needed) + macOS notification |

`jobs/` is gitignored — personal documents. Never commit, upload or paste the CVs.

## Verbs

- **`jobs`** — status first: `pnpm jobs:loop --status`, `pnpm jobs:digest`; then what's on HOLD and why;
  then the in-session lanes the loop can't reach (below). Report **applications sent this week** first.
- **`jobs scrape`** — `pnpm jobs:discover` + in-session: Indeed MCP, AI-platform role pages, norrsken,
  micro1, tender portals → `jobs/inbox/<date>-<lane>.json` (NormalizedJobInput + `campaign`, `deadline`,
  `applyMethod` `email:|portal:|tender-portal:|in-person`, `note`, `rwandaEligible`, `payoutMethod`) →
  `pnpm jobs:ingest --dry-run` → `pnpm jobs:ingest`.
- **`jobs wave`** — `pnpm jobs:wave [--dry-run] [--limit n] [--regate]`.
- **`jobs send`** — `pnpm jobs:send` (dry) · `--apply --limit n` · `--apply --to-self` (test to hotmail).
- **`jobs inbox` / `jobs update`** — `pnpm jobs:inbox [--dry-run] [--hours n]`; Gmail (datapayt) replies
  still need the in-session connector.
- **`jobs hold`** — for each HOLD card: supply what `holdReason` names (salary figure → edit the
  `.letter.json` in `jobs/outbox/<wave>/`; certified copies → Abdout's scan) then move to APPROVED.
- **`jobs apply <portal item>`** — packets for portals/platforms/tenders, as before: never submit.
- **`jobs learn`** — `pnpm jobs:learn [--propose] [--send]`; adoption = `pnpm jobs:variant activate <id>`.
- **`jobs pause` / `resume`** — `pnpm jobs:loop --pause|--resume`.

## Gotchas

- CRM + Mail.app + the loop all live on the Mac: asleep = nothing runs; the next tick catches up. On
  mains power the tick holds `caffeinate -i` until the next tick (07–21); on battery it doesn't, so a
  Mac on battery still sleeps through the windows. After a wake the tick waits ≤2 min for the CRM.
- 401 "Token invalid" from Twenty = key signed with an old APP_SECRET → re-sign (memory `reference_crm.md`).
- Prod Neon enum lacks 9 statuses (kun#152) — the board is the loop's truth; Neon is best-effort.
- `rwandajob.com`, We Work Remotely block bots; ReliefWeb API needs an approved appname.
- The matcher scores from software + CV evidence; AI-training/tender rows score low by construction.
