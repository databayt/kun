# Social Automation — Build Roadmap & Channel Reality

> **Internal · Confidential — do not publish.** The public architecture is at
> `content/docs/social/`; the brand rules at `content/docs/brand.mdx`. This document holds the
> parts that don't belong on the public site: the posting-API reality per platform, the
> credential plan, the cost/ToS decisions, and the deferred engineering. Cross-linked from
> `docs/GO-TO-MARKET.md`.

## Why this exists

We want to market five brands (databayt, Hogwarts, Mkan, Moallimee, Sijillee) across eight
platforms, ideally automated. The public docs describe the _pipeline_. This describes what it
actually takes to _publish_ — which is where every hard decision lives, because the eight
platforms could not be more different in how (or whether) they let you post programmatically.

## Channel-feasibility matrix

Organic posting to an **owned brand account** (not ads, not analytics). Verified against official
developer docs / current industry sources, 2026.

| Channel           | API                                                              | Gate to post                                                                                                                | Cost                                                                                                    | Media                                | Difficulty      |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------- |
| **Telegram**      | Bot API (`sendMessage`/`sendPhoto`/`sendVideo`/`sendMediaGroup`) | Bot must be a channel admin (instant, via `@BotFather`)                                                                     | Free                                                                                                    | Text, image, video, album            | **TRIVIAL**     |
| **X / Twitter**   | API v2 (`POST /2/tweets`)                                        | Dev app; no review                                                                                                          | **Pay-per-use since Feb 6 2026** — ~$0.015/post ($0.20 if it has a link); **no free tier for new devs** | Image, video, ≤4 images              | **EASY (paid)** |
| **Facebook Page** | Graph API (`POST /{page-id}/feed`)                               | App Review (Advanced Access) + **Business Verification** for production                                                     | Free                                                                                                    | Image, video, Reels, multi-photo     | **MEDIUM**      |
| **Instagram**     | Graph API Content Publishing (`/media` → `/media_publish`)       | **Business account linked to a FB Page** + App Review + Business Verification; media must be a public URL                   | Free                                                                                                    | Image, video, Reels, carousel, story | **MEDIUM**      |
| **LinkedIn**      | Posts API (`POST /rest/posts`)                                   | **Community Management API** approval (registered legal org) + page Super/Content Admin                                     | Free                                                                                                    | Image, video, carousel, poll         | **MEDIUM**      |
| **TikTok**        | Content Posting API (Direct Post)                                | **Full app audit (~1–4 wks)**; until passed, posts are **private (SELF_ONLY)** and ≤5 users; strict username/avatar UX rule | Free                                                                                                    | Video, photo                         | **HARD**        |
| **Snapchat**      | Public Profile API → Content Management                          | **Allowlist-only** — set up a Snap Business account, then a Snap contact must allowlist your client ID. No self-serve.      | Free                                                                                                    | Stories, Saved Stories, Spotlight    | **LIMITED**     |
| **WhatsApp**      | _(none for organic posting)_                                     | Cloud API is **1:1 template/conversation messaging**, not broadcast posting; **Channels have no official API**              | Cloud API is per-message paid                                                                           | n/a for "posts"                      | **LIMITED**     |

### Reading the matrix

- **Do first, free, instant:** **Telegram.** One bot, admin on the channel, done. Every brand
  should have a Telegram presence day one.
- **Cheap + metered:** **X.** Trivial to build, but budget for it now that it's pay-per-use — a
  direct hit on the subscription-only / no-new-API-spend doctrine. **`/decide` before wiring.**
- **One-time review, then free:** **Facebook, Instagram, LinkedIn.** Meta business verification
  and LinkedIn's Community Management API approval are paperwork gates, not money gates. Worth it
  for Hogwarts (FB/IG), Mkan (IG), Sijillee (FB), Databayt (LinkedIn).
- **LinkedIn caveat (2026):** company-page organic reach is ~2–5% and falling; **personal
  profiles reach ~70% more than pages**. The working LinkedIn strategy is Ali's personal profile
  with the page as storefront — which lowers the urgency of the Community Management API
  (personal posting isn't automatable anyway; a human posts it).
- **Heavy gate:** **TikTok** — a multi-week audit with strict UX requirements; posts are private
  until you pass. Plan for human-posting or an aggregator in the interim.
- **No clean path:** **Snapchat** (allowlist via a Snap rep) and **WhatsApp** (no organic-post
  API at all). For WhatsApp, the real play is **community broadcast lists + business messaging**,
  not automated feed posts. **Do not** use unofficial reverse-engineered WhatsApp "channel" APIs —
  they violate ToS and risk account bans.

### The aggregator option

**Ayrshare** (most API-first) covers **7 of our 8** — Facebook, Instagram, X, LinkedIn, TikTok,
Snapchat, Telegram — and eats the TikTok/Snapchat gating for us. It does **not** cover WhatsApp
(nothing does). Pricing: Premium from ~$149/mo (single profile); Business ~$599/mo (~30 profiles)
for multi-brand. **Postiz** is open-source/self-hostable and covers the mainstream set — a fit if
we want to run the aggregation layer ourselves (aligns with self-hosting + no-SaaS-spend).

**Open Phase-2 `/decide`:** build per-channel adapters on the Hermes gateway (its adapter set
already covers Slack/Telegram/Discord/WhatsApp/Signal — see `/docs/hermes`), or wrap an aggregator
(Ayrshare paid vs. Postiz self-hosted). Adapters = more work, no per-brand SaaS fee, full control.
Aggregator = fast breadth, someone else maintains the gating, recurring cost.

## Credential inventory & wiring plan

**Slack is the first wired channel** (Hermes gateway: `SLACK_BOT_TOKEN`/`SLACK_APP_TOKEN` in
`~/.hermes/.env`, proactive posts via `SLACK_HOME_CHANNEL`). `.env.example` documents
`HERMES_API_URL` / `HERMES_API_KEY` / `NEXT_PUBLIC_HERMES_API_URL` for the site's Social Hub.

- Track accounts per **brand × channel** (5 × 8 = up to 40). Some pages are already opened; audit
  which exist, which are dormant (`@databayt` on X), and which are still to claim.
- All platform tokens live **server-side only** — never `NEXT_PUBLIC`. The one browser-exposed
  value is `NEXT_PUBLIC_HERMES_API_URL` (the health-check URL).
- Keys go in the central `.env` / Keychain per the credentials skill, not scattered files.

## Doctrine conflicts (each needs a call)

1. **Paid social APIs vs. subscription-only / no-new-API-spend.** X is now metered per post;
   aggregators are monthly SaaS. Both are billing changes → **`/decide` + Abdout**, per the
   engine's billing doctrine. Telegram (free) sidesteps this — which is why it's first.
2. **Self-hosted Hermes vs. anthropic-native.** Mitigated by scoping Hermes to **egress
   only** — Anthropic has no "post to X" primitive, so a relay is legitimate. The brain (drafting)
   stays Claude-native. Document the boundary so Hermes never creeps into being the LLM.
3. **Full-auto publishing to real brand accounts is a Type-1 (public, hard-to-reverse) decision.**
   L4 autonomy needs an automated guardrail layer _before_ it ships: an LLM-judge content +
   Arabic-correctness gate (the brand's no-broken-Arabic rule), per-channel rate limits, and a
   kill switch. Autonomy without guardrails is an incident generator.

## Build roadmap (the deferred engineering)

Spelled out so the follow-up is turnkey — none of this ships in the docs-only session.

### Design driver — the repurposing multiplier

The binding constraint is **content capacity, not channel count**: Samia carries 2–3 core pieces
a week (growth.md), Abdout occasional technical posts. 5 brands × 8 channels is only feasible if
the pipeline treats a post as **one core piece → N platform-native variants** (Claude adapts
hook, length, caption, hashtags, ratio, AR/EN per platform; `/higgs` re-ratios the media). So the
`/social` skill and the eventual `SocialPost` model must be **variant-aware from day one**: a
parent `piece` with per-platform child `variants`, not 8 disconnected posts. ~3 core pieces/week
→ ~15–20 platform posts. This is what the automation is _for_; strategy detail in
`content/docs/social/strategy.mdx`.

### Engine config (`/social` capability)

- `.claude/skills/social/SKILL.md` — the workflow skill (resolve → draft → media → stage → publish).
- Extend `.claude/agents/growth.md` — add a Social Automation section + `hermes`/`posthog` tool
  rows + a decision-matrix row (auto-publish → human gate + `/decide`). (Don't add a new agent —
  growth already owns "social media.")
- `.claude/vocabulary.json` — a `social` spell in the Pensieve school:
  `order: [{familiar, growth}, {skill, /social}]`, `connects: ["higgs", "weekly"]`.
- `.claude/engine.json` — bump `counts.project_skills` 38 → 39.
- Run `node .claude/scripts/generate-vocab.mjs` + `bash .claude/scripts/build-plugin.sh`, then
  `bash .claude/scripts/health.sh` green — **one commit** (engine-parity rule).

### WIP harden (the existing Social Hub)

- `src/actions/post-social.ts` — Zod schemas + `unknown` inputs, typed errors (drop `any`), a
  role check (`authjs/action-authz-check`), rename `generateAndPublishPost → draftPost`.
- `src/lib/hermes.ts` — `err: unknown` narrowed; `metadata: Record<string, unknown>`.
- `src/components/root/social/config.ts` (new) — a `CHANNELS` allowlist shared by the dashboard
  toggles and the Zod channel enum; replace the hardcoded 4-channel list, extend toward the 8.
- `src/app/[lang]/(root)/engine/social/page.tsx` — a page-level `auth()` guard.
- `.env.example` — document `NEXT_PUBLIC_HERMES_API_URL` (health-check URL; key stays server-side). ✅ done

### Persistence, scheduling, metrics

- Prisma `SocialPost` / `ScheduledPost` — **variant-aware**: parent piece + per-platform variants
  (brand, channel, status, scheduled_for, result, `aiGenerated` flag — see moral gate below).
- `/schedule` (Vercel cron or the harness scheduler) for timed publishing.
- PostHog events + per-platform analytics for attribution; UTM on every link.

### AI-disclosure mapping (the moral gate's compliance half)

The publish payload carries `aiGenerated: boolean` (set whenever media came from `/higgs`). The
gate maps it per platform — duties verified against official platform docs, July 2026:

| Platform         | Duty (2026)                                                                                                                        | Wire-up                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **TikTok**       | Labeling **realistic AIGC is mandatory**; unlabeled risks removal/restriction                                                      | Set `is_aigc: true` in the Content Posting API                                                                                           |
| **Meta (FB/IG)** | Self-disclosure required **only for photorealistic video / realistic audio**; C2PA/IPTC metadata auto-triggers the "AI Info" label | **No organic API flag exists** — comply by policy: never publish photorealistic synthetic people/events; keep C2PA metadata when present |
| **X**            | No duty for ordinary marketing images (policy bites only on deceptive + harmful media)                                             | Nothing to wire                                                                                                                          |
| **LinkedIn**     | No duty; displays a C2PA "CR" badge when metadata survives                                                                         | Nothing to wire                                                                                                                          |
| **Snapchat**     | Disclosure required for **monetized** content only                                                                                 | Caption disclosure if Spotlight-monetized                                                                                                |

House rule stays stricter than every platform floor: AI media is labeled by default, and we never
publish photoreal fakes of people or places (the brand style is deliberately non-photoreal —
charcoal/cyan, text-free). Don't rely on C2PA surviving upload — most platforms strip manifests;
the API flag and caption are the reliable lanes. The gate's other checks (truthfulness, Arabic
correctness, cultural fit, consent for faces) live in the L4 guardrail spec (doctrine conflict #3).

## Payoff governance (cash-flow-first applied to social)

Effort is a cost. Social must be accountable to the drive like everything else:

- **Organic-only by default.** $0 ad budget; any paid experiment (boosts, ads, aggregator SaaS)
  is a billing change → `/decide` + captain.
- **Timeline honesty.** 0–3 months of consistent posting = silence is normal; 3–6 months = first
  signal expected; 6–12 months = compounding or cut. Set this expectation up front so nobody
  panic-quits at week 6 or zombie-posts at month 9.
- **Kill criteria.** A channel earns its slot: zero signal (reach, clicks, DMs, pipeline
  mentions) after **3 months** of consistent posting → drop to monthly maintenance or park it.
  Review quarterly in the captain's cadence.
- **Payoff map** (fastest revenue-linkage first): Hogwarts social = trust asset for Ali's sales
  calls; Mkan = direct consumer funnel (fast feedback); databayt dev-rel = talent/contributor/
  partner pipeline (long-tail); Sijillee = market education (slow, cheap). Measure UTM → PostHog
  → CRM pipeline → North Star (active paying schools).

## Phasing

1. **Phase 1 — docs & R&D** _(this session)_ — the public `social/` section + brand pages +
   `brand.mdx` + this roadmap. No code, no credentials.
2. **Phase 2 — engine config + WIP harden** — one health-green commit; the `/social` keyword goes live.
3. **Phase 3 — Telegram live** — free, trivial; human-staged (L2). First real automated channel.
4. **Phase 4 — multi-channel** — FB/IG/LinkedIn (review gates) + X (`/decide` on cost); aggregator
   decision for TikTok/Snapchat. WhatsApp stays community-broadcast, not automated.
5. **Phase 5 — L4 full-auto** — only after the guardrail layer (LLM-judge gate + rate limit +
   kill switch) exists and `/decide` signs off.

## Notes on the priority-5 brands

- **Databayt** — LinkedIn + X + GitHub/Dev.to + Telegram. B2B/dev-rel; least dependent on the hard
  consumer channels.
- **Hogwarts** — FB + IG + WhatsApp (parents) + LinkedIn (buyers). WhatsApp = school↔parent
  broadcast, not feed posts.
- **Mkan** — IG + TikTok + Snapchat + FB. The most gated channel mix (visual/consumer) → likely
  needs the aggregator or human-posting earliest.
- **Moallimee** — _pre-launch._ Do not open accounts until positioning is confirmed.
- **Sijillee** — FB + WhatsApp dominate in Sudan; Telegram/IG support. B2B, Sudanese-Arabic,
  trust-first. Mind Sudan connectivity when setting cadence.
