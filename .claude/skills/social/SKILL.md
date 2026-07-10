---
name: social
description: Draft, stage, and publish brand social posts — Claude drafts, /higgs renders, a human approves, Hermes relays
when_to_use: "Use when creating or publishing social-media content for a databayt brand (databayt, hogwarts, mkan, moallimee, sijillee) — drafting bilingual post copy, generating post media, staging for approval, or broadcasting via the Hermes gateway. Triggers on: social post, post to slack, post to x, tweet, draft a post, publish to social, social automation, broadcast the announcement, منشور تواصل."
argument-hint: "[brand] [idea] [--channels slack] [--publish]"
---

# Social — brand posts through the pipeline

One post, done right: **Claude drafts, `/higgs` renders, a human approves, Hermes relays.**
Autonomy is **L1 (assisted)** — nothing auto-publishes to a brand account. Strategy, brand pages,
and the autonomy ladder: `content/docs/social/` (public) · `docs/SOCIAL-AUTOMATION.md` (internal).

Arguments: $ARGUMENTS — brand (`databayt|hogwarts|mkan|moallimee|sijillee`), the idea/news,
optional `--channels` (default `slack` — the only wired channel today), optional `--publish`
(dispatch after explicit approval).

## Doctrine (non-negotiable)

1. **Claude writes the copy** — never the gateway's LLM. Hermes is a relay, not a brain.
2. **Arabic first, English second** — per `content/docs/brand.mdx` and the brand's page under
   `content/docs/social/<brand>.mdx`. Correct Arabic or it doesn't ship.
3. **The multiplier** — write the core piece story-first, then adapt per channel (hook, length,
   ratio, hashtags, AR/EN). One piece → many platform-native variants.
4. **Media via `/higgs`** — text-free visuals, brand kit; overlay copy in-post. Label AI media
   (TikTok `is_aigc`; house rule stricter than every platform floor).
5. **Human gate** — present drafts + media and STOP for approval. No approval, no publish.
6. **Moral gate** — truthful claims, cultural fit, consent for faces (children: never without
   written consent), no crisis-exploitation in Sudan-facing content.

## Steps

1. **Resolve context** — brand, audience, channels. Read the brand's page
   (`content/docs/social/<brand>.mdx`); check channel wiring in
   `src/components/root/social/config.ts` (`wired: true` = Hermes adapter live; slack today).
2. **Draft** the core piece + per-channel variants (AR first, EN second). UTM on every link
   (`?utm_source=<channel>&utm_medium=social&utm_campaign=<slug>`).
3. **Media** if the post needs it — pick the `/higgs` recipe (og image / social card / reel),
   text-free, brand style blocks.
4. **Stage for approval** — show copy variants + media paths to Abdout/Ali/Samia. Stop here.
5. **Publish** (only after explicit approval, or `--publish` given after the gate):
   - Dashboard: `/engine/social` composer (contributors-only, Zod-validated).
   - Headless: `node scripts/post-to-hermes.mjs --text "<approved copy>" --channels slack`.
6. **Log** — note the post + slot in the content calendar; UTM lands in PostHog for the
   quarterly payoff review (kill criteria live in `content/docs/social/strategy.mdx`).

Reference: `.claude/agents/growth.md` (owner) · `.claude/skills/higgs/SKILL.md` (media) ·
`content/docs/hermes.mdx` (gateway wiring) · `content/docs/social/strategy.mdx` (six lenses).
