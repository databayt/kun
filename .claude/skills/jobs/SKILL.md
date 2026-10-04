---
name: jobs
description: Abdout's + Databayt's income lane — jobs, gigs, tenders, client requests and funding programs across Rwanda, Kenya, Nigeria, Gulf, Sudan; tracked on sales.databayt.org
when_to_use: "Any opportunity someone POSTED that pays Abdout or Databayt: Kigali/Nairobi/Lagos roles, remote dev, AI-training gigs, freelance, electrical/protection work, tenders, RFPs, client project requests, and funding — incubators, accelerators, grants, credits, angels. Triggers on: jobs, find work, apply, opportunities, gigs, tenders, RFP, client request, incubator, accelerator, grant, credits, investor, angel, fundraising, funding, did anyone reply, وظائف, فرص, مناقصات, حاضنة, مسرعة, منحة, تمويل. NOT /scrape (outbound leads we go find)."
argument-hint: "[status|scrape|wave|send|inbox|hold|funding|requests|learn|pause|resume]"
---

# Jobs — the self-running loop: fetch → wave → send → read → follow up → learn

**The measured truth this runbook exists to enforce: the bottleneck is SENDING, not finding.**
On 2026-09-26 all 26 board records had sat at TO_APPLY for a month. Since 2026-09-27 the loop sends
email applications itself — gated, capped, vetoable — so the question each run is "what did the loop
hold, and why", not "what should I draft".

**Priority (Abdout, 2026-10-03), by days-to-cash:** AI-training gigs + software roles → remote →
freelance + electrical/protection (unpaused) → Databayt tenders and client projects → engineering
contracts. **Markets:** Rwanda, Kenya, Nigeria (Africa = remote AND on-site) · Gulf = **remote only,
never on-site** · Sudan. **Two tracks on one board:** `track` FOUNDER (Abdout earns) / DATABAYT (the
company earns: TENDER, CLIENT_PROJECT). **Funding** lives on its own board, "Funding & Programs".
**Boundary with `/scrape`:** jobs = opportunities someone posted (jobs, gigs, RFPs, wizard requests,
funding calls); scrape = outbound leads we go find (businesses with outdated sites, schools). **Send mode (2026-09-27): auto-send with a daily cap** — email, and since 2026-10-04 **WhatsApp** (postings that say "CV on WhatsApp" → channel WHATSAPP, `applyPhone`; same letter + CV PDF from Abdout's number via the Hermes Baileys bridge, paired once with `hermes whatsapp`; cap `whatsappCap` 5/day; no auto follow-ups);
portals, platforms, tenders and bids stay packets Abdout submits. **Learning proposes, Abdout adopts.**

## The loop (launchd `com.databayt.jobs-loop`, every 30 min — `pnpm jobs:loop --status`)

| When (Kigali) | Step | Script | Tokens |
|---|---|---|---|
| ≥07:00 daily | discover (10 adapters, incl. MyJobMag KE/NG) + ingest (one retry) | `jobs:discover`, `jobs:ingest` | 0 |
| every tick | databayt.org wizard requests → CLIENT_PROJECT card on HOLD + Slack | `jobs:requests --apply` | 0 |
| ≥07:00 Mon–Fri | wave: tailor letters, gate → QUEUED / HOLD | `jobs:facts`, `jobs:wave` | claude -p |
| after wave | digest → Slack DM via `hermes send` (+ funding closing ≤14 days) | `jobs:digest --send` | 0 |
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
- **Location:** `openToRwanda()` in discover.mjs — bare Remote or a named open region (EMEA, MENA,
  Africa) only ("<Country> Remote" = must live there). US `City, ST` postings are US-remote.
  `onsiteAllowed()`: Africa on-site yes · Gulf on-site never · elsewhere only with visa/relocation.
  Board `country` / `city` / `track` are derived at push time (`src/lib/jobs/markets.ts`);
  `pnpm jobs:markets --apply` backfills empty ones.
- Boards: `jobs/ats-boards.json` (226+), seeded by `node scripts/jobs/ats-seed.mjs <remote-jobs clone>`
  or `--yc <yc all.json>`; merge, never replace.
- One application per company per day across email and ATS. Daily total cap 100 (config), hotmail 40.

## Phone surface — Hermes (since 2026-10-05; no model, subscription-only)

- **Briefs out:** every sent application (email / form / WhatsApp) → `✅ Applied …` in Abdout's WhatsApp
  self-chat (`whatsappBrief`, hung off `ledger()`); interview/offer/reply → 🎯/🏆/💬. `briefWhatsApp` in config;
  `JOBS_BRIEF=off` silences.
- **Commands in** (WhatsApp self-chat or Slack DM): `/jobs` `/jobsqueue` `/jobsreplies` `/jobspause` `/jobsresume` —
  Hermes `quick_commands` (exec, no args, 30s). Install/refresh: `pnpm jobs:hermes` (text-edits only that block).
- **Linking WhatsApp:** `pnpm jobs:whatsapp-pair` (QR page on :8790) — `! hermes whatsapp` fails (needs a TTY).
  Linked number: +249919071294. After linking: `WHATSAPP_ENABLED=true`, `launchctl kickstart -k gui/$(id -u)/ai.hermes.gateway`.
- **Self-heal:** each tick probes Mail.app (20s) and restarts it if wedged (-1712); held "unanswerable" ATS cards
  are re-asked every morning, so answers added to `jobs/profile.json` free them.
- **Connectors:** Indeed works (no RW/KE codes, rate-limits ~40 calls; vet non-US eligibility per posting);
  Upwork connector is client-side only (can't find work); no LinkedIn connector.

## Pieces

| Thing | Where |
|---|---|
| Board | Twenty `kigaliOpportunity` ("Jobs & Opportunities") · sales.databayt.org · REST `localhost:3100` · Keychain `databayt-twenty`/`databayt` · client `scripts/jobs/board.ts` · fields `scripts/crm-kigali-object.mjs` |
| Funding board | Twenty `fundingProgram` ("Funding & Programs") · `scripts/crm-funding-object.mjs` · seed `jobs/funding.seed.json` → `pnpm jobs:funding` |
| Mail | Mail.app, account **osmanabdout@hotmail.com** — `scripts/jobs/mail-send.applescript`, `mail-read.applescript`. No account → send/inbox refuse, never fall back to another sender |
| Letters | `jobs/templates/letters/<lane>@<n>.md` · follow-ups `follow-up-{1,2}@<n>.md` |
| CVs | `jobs/cv/*.html` → `pnpm jobs:cv` (playwright PDF) · registry `jobs/variants.json` |
| Variants | `pnpm jobs:variant` (list, sends) · `activate <id>` / `deactivate <id>` — two active per lane split 50/50 |
| Ledger | `jobs/ledger.jsonl` — every queued/hold/sent/followup/reply/error line; learn's raw data |
| Reports | `jobs/learn/<date>.md` · packets `jobs/packets/` |
| Alerts | `scripts/jobs/notify.ts` → `hermes send` (no model needed) + macOS notification; `whatsappBrief` → his WhatsApp |
| Phone | `pnpm jobs:brief [queue\|replies]` (what `/jobs*` runs) · `pnpm jobs:hermes` · `pnpm jobs:whatsapp-pair` |

`jobs/` is gitignored — personal documents. Never commit, upload or paste the CVs.

## Verbs

- **`jobs`** — status first: `pnpm jobs:loop --status`, `pnpm jobs:digest`; then what's on HOLD and why;
  then the in-session lanes the loop can't reach (below). Report **applications sent this week** first.
- **`jobs scrape`** — `pnpm jobs:discover` + in-session: Indeed MCP, AI-platform role pages, norrsken,
  micro1, tender portals → `jobs/inbox/<date>-<lane>.json` (NormalizedJobInput + `campaign`, `deadline`,
  `applyMethod` `email:|portal:|tender-portal:|in-person`, `note`, `rwandaEligible`, `payoutMethod`) →
  `pnpm jobs:ingest --dry-run` → `pnpm jobs:ingest`.
- **Indeed** — the claude.ai Indeed connector works in Code too (`mcp__claude_ai_Indeed__search_jobs`); supported countries exclude RW/KE — use `US` + `remote` (then check the posting accepts non-US) and `AE` (on-site → skip). Hits go to `jobs/inbox/<date>-indeed.json` → `pnpm jobs:ingest`.
- **`jobs wave`** — `pnpm jobs:wave [--dry-run] [--limit n] [--regate]`.
- **`jobs send`** — `pnpm jobs:send` (dry) · `--apply --limit n` · `--apply --to-self` (test to hotmail).
- **`jobs inbox` / `jobs update`** — `pnpm jobs:inbox [--dry-run] [--hours n]`; Gmail (datapayt) replies
  still need the in-session connector.
- **`jobs hold`** — for each HOLD card: supply what `holdReason` names (salary figure → edit the
  `.letter.json` in `jobs/outbox/<wave>/`; certified copies → Abdout's scan) then move to APPROVED.
- **`jobs apply <portal item>`** — packets for portals/platforms/tenders, as before: never submit.
- **`jobs funding`** — `pnpm jobs:funding --due 30` first (what closes soon), then refresh the seed:
  WebSearch each market (credits → grants → zero-equity programs → SAFE → VC, the ladder in memory
  `reference_fundraising_ladder`), verify the program is live and read eligibility for a **Sudanese
  national resident in Rwanda, company not yet registered**; append to `jobs/funding.seed.json`
  (never invent a deadline — null = rolling) → `pnpm jobs:funding` → `--apply`. Portal sign-ups in
  Abdout's name go to Cowork via `~/.claude/bridge.md`; Claude drafts the answers, he submits.
- **`jobs requests`** — `pnpm jobs:requests` (dry) · `--apply`. A CLIENT_PROJECT card is HOLD by
  design: a human answers a client within 24h; scope + price via `/proposal` / `/pricing`.
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
