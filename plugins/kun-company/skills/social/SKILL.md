---
name: social
description: Draft, stage, and publish brand social posts — Claude drafts, /higgs renders, a human approves, Hermes relays
when_to_use: "Use when creating or publishing social-media content for a databayt brand (databayt, hogwarts, mkan, moallimee, sijillee) — drafting bilingual post copy, generating post media, staging for approval, or broadcasting via the Hermes gateway. Triggers on: social post, post to slack, post to x, tweet, draft a post, publish to social, social automation, broadcast the announcement, منشور تواصل."
argument-hint: "[brand] [idea] [--channels slack,telegram] [--media] [--publish]"
---

# Social — brand posts through the pipeline

One post, done right: **Claude drafts, `/higgs` renders, a human approves, Hermes relays.**
Autonomy is **L1 (assisted)** by default (human sign-off before brand post) or **L4 (cron pipeline)** when explicit `--auto-publish` or automated cron scheduler flags are active.
Strategy, brand pages, and the autonomy ladder: `content/docs/social/` (public) · `docs/SOCIAL-AUTOMATION.md` (internal).

Arguments: $ARGUMENTS — brand (`databayt|hogwarts|mkan|moallimee|sijillee`), the idea/news,
optional `--channels` (default `telegram`; wired: `telegram` direct Bot API, `facebook` direct Graph API, `slack` via Hermes), optional `--media` (triggers `/higgs` visual card generation), optional `--publish` (dispatch after explicit approval).

## Doctrine (non-negotiable)

1. **Claude writes the copy** — never the gateway's LLM. Hermes is a relay, not a brain.
2. **Arabic first, English second** — per `content/docs/brand.mdx` and the brand's page under
   `content/docs/social/<brand>.mdx`. Correct Arabic or it doesn't ship.
3. **The multiplier** — write the core piece story-first, then adapt per channel (hook, length,
   ratio, hashtags, AR/EN). One piece → many platform-native variants.
4. **Media via `/higgs`** — text-free visuals, brand kit; overlay copy in-post. Use `node scripts/generate-social-media.mjs --product <brand> --prompt "<topic>"` for automated card rendering. Label AI media (TikTok `is_aigc`; house rule stricter than platform floor).
5. **Approval gate & Egress** — present drafts + media in `#social` channel before publishing unless running under automated cron pipeline.
6. **Moral gate** — truthful claims, cultural fit, consent for faces (children: never without
   written consent), no crisis-exploitation in Sudan-facing content.

## Steps

1. **Resolve context** — brand (`databayt`, `hogwarts`, `mkan`, `moallimee`, `sijillee`), audience, channels. Read `content/docs/social/<brand>.mdx`; check channel wiring in `src/components/root/social/config.ts`.
2. **Draft** the core piece + per-channel variants (AR first, EN second). UTM on every link
   (`?utm_source=<channel>&utm_medium=social&utm_campaign=<brand>-<slug>`).
3. **Media Generation (`/higgs`)** — if `--media` or visual card requested:
   - Run `node scripts/generate-social-media.mjs --product <brand> --prompt "<topic>"`
   - Output lands in `public/social/media/<brand>-<timestamp>.png` (or `.svg` fallback).
4. **Stage for approval** — show copy variants + media paths in Slack `#social` channel.
5. **Publish** (after explicit approval or `--publish` flag):
   - Headless telegram: `node scripts/post-to-telegram.mjs --text "<approved copy>"`
   - Headless facebook: `node scripts/post-to-facebook.mjs --text "<approved copy>" --product <brand>`
   - Headless hermes:   `node scripts/post-to-hermes.mjs --text "<approved copy>" --channels slack`
   - Dashboard UI:     `kun.databayt.org/social` composer.
6. **Log** — note post slot in content calendar; track UTM performance.

Reference: `.claude/agents/growth.md` · `.claude/skills/higgs/SKILL.md` · `content/docs/hermes.mdx` · `docs/SOCIAL-AUTOMATION.md`.
