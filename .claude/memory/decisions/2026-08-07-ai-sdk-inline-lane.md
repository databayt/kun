# The inline draft lane runs on the AI SDK; eve and HarnessAgent stay out

**ID**: D-20260807-ai-sdk-inline-lane
**Date**: 2026-08-07
**Decided by**: Abdout (scope: "Everything" on the boost plan), executed by Claude
**Type**: 2 (reversible — the adoption is one lib file; revert = revert the commit)
**Status**: shipped
**Reviewed-by**: 2026-09-07 (with D-20260807-gemini-inline-draft's own review)
**Tags**: #social #draft #ai-sdk #eve #billing
**Amends**: [D-20260807-gemini-inline-draft](./2026-08-07-gemini-inline-draft.md) — its "no new dependency" line

## Decision

The inline Gemini lane calls models through **Vercel AI SDK v7** (`ai` +
`@ai-sdk/google`, `generateObject` + zod) instead of hand-rolled fetch. Two
JSON-mode clients collapsed into one provider-abstracted call; the dark
`draftBrief` Anthropic client is deleted — a funded-Anthropic future is a
one-line `createAnthropic` swap, not a parallel client kept warm. Same
free-tier `GEMINI_API_KEY`; the SDK is a free library; **no billing change**.

This deviates from D-20260807's "no card, no doctrine change, no new
dependency" line — deliberately, and only on the third clause: the dependency
buys schema-validated output (the tolerant-parser class of bug gone), retries,
and the provider swap the funded future needs.

**eve and HarnessAgent were evaluated and stay out**: eve bills via AI
Gateway/API keys and its server-orchestrates-agent shape inverts the
pipeline's inverted arrow; HarnessAgent is experimental and API-billed with no
subscription OAuth documented (watch item). The reviewer/LLM-judge subagent
stays rejected per copy.mdx (L4, `/decide`-gated). Full evaluation:
`docs/SOCIAL-AUTOMATION.md` § "AI SDK 7 + eve evaluation".

## What shipped with it (the same evaluation's findings)

- Craft gate on both Gemini lanes — retry once, then refuse-to-queue
  (`craft-refused:` marker; drain-google skips, claude lane reads).
- D-20260807's unshipped spec: `SOCIAL_DRAFT_INLINE=off`, non-throwing
  8/min-global 4/min-user limiter, `gemini-3.6-flash` reconciled (code was
  calling the ~24s `gemini-2.5-flash`).
- Prompt single-sourced (parity-pinned mirror pair, statics-first for
  caching) + `lessons` line inline.
- Scene bank (`content/social/scenes.json`) for check 4; Friday digest
  (`scripts/social-digest.mjs`, launchd) for the weekly loop. Both zero-token.

## Premortem

- **ai@7 breaking change bites an upgrade.** Surface is one file
  (`google-draft.ts`); the raw-fetch fallback lives in git history and
  drain-google still carries its own fetch shape.
- **engines bump (node >=22) breaks a deploy.** Vercel default is 22+;
  verified locally on v25. If a build fails on engines, pin the project's
  Node version — do not revert the SDK.
- **The gate refuses too much and the Mac lane backs up.** The digest's
  craft-refused counter + `drain-drafts.sh` logs make it visible; the revert
  is `SOCIAL_DRAFT_INLINE=off`, never deleting the gate.

## Expected outcome

Inline drafts keep their ~11s latency but arrive craft-gated — the reviewer
stops seeing the reject list's own failures. Quota worst-case doubles on
craft retries (still inside the 20/day ceiling at current volume; overflow is
the Mac lane by design). If the 2026-09-07 review shows the gate refusing

> 1 in 3 drafts, the prompt (not the gate) is the thing to fix.
