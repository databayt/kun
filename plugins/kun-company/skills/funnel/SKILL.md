---
name: funnel
description: Conversation to conversion — gates, segments, assets, the stall clock
when_to_use: "Converting a lead that already replied — gate state, segmentation, value before payment, the stall clock, the follow-up drain. Triggers on: funnel, qualify, segment, nurture, follow up, stalled, chatbot, قمع, تأهيل, متابعة. NOT /scrape (finding them), /draft (brand copy), /approve (a social post), /qa (a block)."
argument-hint: "[qualify|segment|nurture|follow-up|stalled|chatbot] [for <product>] [--apply]"
---

# Funnel — the conversion runbook

**The measured truth this runbook exists to enforce: nothing here has ever converted.**
0 funnel sessions, 0 leads moved through a gate, 0 active paying schools against a Q3 2026 target
of 1. The plumbing landed 2026-08-18 — the gate ladder and 16 fields are live in Twenty, the
inbound receiver is registered and proven, `promoteToLead()` exists — but **capture does not**, so
those zeros are *structurally* empty rather than genuinely empty. Say it that way; the difference
is the whole state of the lane.

Three facts govern the design, and none of them are opinions:

- **hogwarts already has the chatbot** (`src/components/chatbot/`, Groq, bilingual, mounted on both
  the SaaS site and every tenant site). It answers well and **captures nothing** — `sendMessage`
  writes to no table. The work is capture, not construction.
- **The inbound plumbing is built and still unused.** `saas-marketing/actions.ts` holds
  `requestDemo`, `startFreeTrial`, `captureLead`, all writing `Prospect` via
  `upsertInboundProspect`, with **zero importers**. `promoteToLead()` now exists and is
  idempotent — it is waiting on a caller, not on itself.
- **The funnel logic is deterministic; the LLM is asynchronous.** Which question comes next, which
  segment you land in, which asset you get, when a touch fires — scripted, **zero tokens**. Groq
  answers free-form messages (already live, a different budget line). Personalized follow-up copy is
  batch-drafted on the Max pool via the launchd drain. **Never a per-lead Anthropic call.**

Numbers and hard rules: `.claude/agents/funnel.md`. Acquisition — everything before the first
reply — belongs to `.claude/agents/lead.md` and `/scrape`. **kun holds no funnel code.**

## State — built vs not, so nothing is claimed twice

**Live and production-proven:** the inbound receiver (`POST /api/webhooks/twenty` → verify →
parse → one `TwentyInboundEvent` row, applying nothing) on `company.updated` +
`opportunity.updated` · `promoteToLead()` · `School.trialEndsAt` · the gate ladder and 16 funnel
fields seeded into the live workspace · mkan's two-way sync.

**Missing:** capture · the applier that reads the inbox · the cadence clock, drain and approve
queue · every URL in the value registry.

**Two traps, measured:** never `prisma db push` against hogwarts production (no
`_prisma_migrations`; a `migrate diff` aimed at `prisma/schema.prisma` rather than the `prisma/`
folder falsely reports 719 dropped FKs and 328 dropped tables) — and Vercel runs `prisma generate`,
never `migrate deploy`, so schema reaches the database *before* the code that expects it.

## Argument: $ARGUMENTS

| Argument              | Mode                                                              |
| --------------------- | ----------------------------------------------------------------- |
| _(none)_              | **Gate report** — where every lead sits, and the biggest stall. §1 |
| `qualify`             | The gate spine: entry, the ONE question, the field, the asset. §2  |
| `segment`             | Compute a segment key and the routing it drives. §3               |
| `nurture`             | The value ladder — and which gate/segment pairs have no gift. §4   |
| `stalled`             | Who stopped, where, for how long; run the DORMANT sweep. §5        |
| `follow-up`           | The drain — due, drafted, awaiting approval. §6                    |
| `chatbot`             | Widget + WhatsApp surface: mount status, capture rate, parity. §7  |
| `for <product>`       | Resolve scope. Default hogwarts. §0                                |
| `--apply`             | Write. Absent = dry run. Always dry-run first.                     |

## §0 — Scope and access

Product from `.claude/memory/repositories.json`. Default **hogwarts**; `mkan`'s lead is the property
**host** and its conversion is a claimed listing, not a subscription.

```bash
export TWENTY_API_URL=http://localhost:3100          # NEVER 3000 — that is hogwarts' dev server
export TWENTY_API_KEY=$(security find-generic-password -s databayt-twenty -a <product> -w)
```

**hogwarts Postgres is the source of truth for gate state. Twenty is a mirrored Kanban.** A card
dragged by a human is advisory: the `opportunity.updated` webhook records it and opens a review
task; it never silently writes back. One writer, one truth.

## §1 — No argument: the gate report

The ladder is the **union of the enums that already exist** — no fourth vocabulary:

| Gate          | `Prospect.status`                | `Lead.status`  | Twenty `stage` | live |
| ------------- | -------------------------------- | -------------- | -------------- | ---- |
| COLD          | `new` `enriched` `queued` `contacted` | —         | `COLD`         | 3,119 |
| PROSPECT      | `queued`                         | —              | `PROSPECT`     | 21   |
| **WARM**      | `replied`                        | `NEW`          | `WARM`         | 0    |
| **DISCOVERY** | `promoted`                       | `QUALIFIED`    | `DISCOVERY`    | 0    |
| **DEMO**      | `promoted`                       | `PROPOSAL`     | `DEMO`         | 0    |
| **TRIAL**     | `promoted`                       | `NEGOTIATION`  | `TRIAL`        | 0    |
| **PILOT**     | `promoted`                       | `NEGOTIATION`  | `PILOT`        | 1    |
| **PAID**      | `promoted`                       | `CLOSED_WON`   | `PAID`         | 0    |
| DORMANT       | `dead` + tag `dormant:<gate>`    | `ARCHIVED`     | `DORMANT` ➕    | —    |
| LOST          | `dead`                           | `CLOSED_LOST`  | `LOST`         | 65   |

**Measured 2026-08-18: this ladder was already there.** `company.stage` carries nine options and
five of them hold zero rows — someone built the ladder and never populated it. So the funnel adopts
it and adds exactly one genuinely missing state, `DORMANT`. Appending a parallel REPLIED/QUALIFIED/
CUSTOMER set would have created the duplicate vocabulary this lane exists to avoid: WARM *is*
replied, DISCOVERY *is* qualified, PAID *is* customer.

The existing split of **TRIAL** (self-serve sandbox) from **PILOT** (the committed free 3-month
engagement) is better than a merged stage, and the GTM needs both. **COLD and PROSPECT are
`/scrape`'s; the funnel starts at WARM** — at a reply.

Report the count at each gate **and name the biggest stall**. A gate report that lists counts without
naming the next move is how "send more messages" wins by default.

## §2 — `qualify`: the gate spine

Every gate declares six things, and a gate missing any of them is broken:
**entry condition → the ONE question → the field it writes → the value asset → the stall timer →
the next gate.** One question per gate. The seven facts a hogwarts invoice requires — authority,
student count, country, curriculum, current system, term start, a reachable channel — are exactly
the questions asked, and nothing else is.

**Segmentation is never a gate.** It is a pure function of fields already collected, recomputed on
every read, so it cannot stall and cannot disagree with itself between the web and WhatsApp lanes.

## §3 — `segment`: the customer department

hogwarts key `<authority>-<band>-<rail>-<term>`; mkan `<units>-<airbnb>-<wave>-<photos>`. Written to
`tags[]` as `seg:<key>` so Prisma and Twenty both filter on it. It routes four things at once:
**owner · cadence speed · value asset · price path.**

Bands are not arbitrary: **100** is the free-tier ceiling in `pricing/config.ts`, **20** is the
`minimumMonthly 30 ÷ $1.50` floor, **1000** is where enterprise is offered. Rail sets the channel —
`sd` → WhatsApp first; `gulf`/`eg` → **email first**, because 119 of 176 contactables carry an email
and only 45 are mobile. A landline in a WhatsApp campaign is a silent non-delivery that reads as
disinterest.

## §4 — `nurture`: give before asking

**Every touch carries a new asset. If a segment has no unsent asset left, the touch does not fire —
it opens a human task instead.** That one rule is what stops a cadence becoming "just checking in."

Assets are produced by `/carousel`, `/draft` and `/higgs`, pushed to the CDN, and referenced **by
URL** — never generated at runtime. That is what holds the per-lead cost at zero. The strongest give
in either product is already built and costs nothing marginal: hogwarts' **sandbox carrying the
school's own name**, and mkan's **pre-built listing plus a single-use `HostClaimToken`**.

Report every `(gate, segment)` pair that resolves to no asset. Each one is a question with no gift
that gets asked anyway.

## §5 — `stalled`: who stopped

Four touches, then **DORMANT** — never infinite. DORMANT is `ARCHIVED` plus
`nextFollowUpAt = now + 90d`; at +90d the lead re-enters **at the gate it stalled at**, touch 1, with
one asset it has never received. A reply at any time resumes it. Nothing is ever deleted — a deleted
row is an outreach history nobody can audit.

## §6 — `follow-up`: the drain

The clock is **launchd on the Mac + a Vercel cron**, never a Twenty `CRON` workflow: Twenty is down
whenever the Mac sleeps, has **no automatic retries**, and fails rather than queues past **5,000
runs/hour**. A cadence that silently loses every overnight window looks exactly like disinterest.

```
tick        → rows past their stall timer            [0 tokens]
touch 1–2   → existing templates, send unattended
touch 3+    → FunnelDraftRequest (pending)
drain       → claude -p on the Max pool, ONE session per tick, answers written
              through FILES not argv (multi-line Arabic breaks argv)
human gate  → approve now | schedule | dismiss       ← required for drafted touches
dispatch    → Evolution WhatsApp | Resend email | human task
```

**Stop on reply, instantly** — freeze the cadence, advance the gate if the reply parses as the
current gate's answer, hand to a human. A reply is a gate transition, not just a stop.

Templated touches send unattended; **drafted touches always need a human yes.** Smartness arrives
exactly where the template failed, which is exactly where a person should look.

## §7 — `chatbot`: the capture surface

Both surfaces write through **one** server action so a lead that starts on WhatsApp and finishes on
the site is one record. The join key is a `FunnelSession` cookie until an identifier arrives, then
the synthetic namespace that already exists: `inbound:<email>` for web, `inbound:wa:<e164>` for
WhatsApp. On a second identifier, merge **fill-empty-never-replace-populated**, keep the older row,
never delete.

Capture is a *parallel* deterministic action, never inside the LLM call — so a capture failure
cannot block a reply, and a reply cannot fabricate a gate transition. Check EN/AR dictionary parity
and that **Arabic-Indic digits normalize**; a naive regex silently drops every Sudanese number.

## Deterministic fan-out

`Workflow({ name: "funnel", args: { product: "hogwarts", stages: ["gates","segment","ladder","stall"] } })`.
Dry-run by default and **`drain` is excluded by default** — it sends messages to real strangers, so
it must be a deliberate act someone typed.

## Exit gate

- Gate counts are measured, not remembered; `UNMEASURED` when there is nothing to measure.
- The recommendation names **a gate and a stall count**.
- Any write ran dry first, then `--apply` twice with an identical count.
- No drafted touch was sent without a recorded human yes.
- Whatever was dropped is in `.claude/logs/funnel-runs.log`.

## Not this skill

`/scrape` = finding them, everything before the first reply · `/draft` = brand social copy ·
`/approve` + `/publish` = a social post · `/qa` = a feature block · `/proposal` + `/pricing` = the
`revenue` agent's close.
