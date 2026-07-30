# The agent window drafts via the API — a deliberate per-draft spend

**ID**: D-20260730-in-app-draft-spend
**Date**: 2026-07-30
**Decided by**: Abdout (in-session direction: "anyone can run it… we can run it into command"), executed by Claude
**Type**: 2 (reversible — remove the window or unset the key and the spend stops)
**Status**: decided
**Reviewed-by**: 2026-08-30 (against the first Anthropic bill)
**Tags**: #social #billing #api-spend #agent-window

## Decision

The Social Agent window on `/social` drafts server-side through `ANTHROPIC_API_KEY` —
`draftSocialCopy` → `draftBrief` in `src/lib/social-draft.ts`, always the Anthropic lane,
contributor-gated. This is the **first sanctioned API spend** under the subscription-only billing
doctrine, scoped to exactly one surface.

What stays gated: the cron's drafting default (`SOCIAL_DRAFT_SOURCE=hermes`, no-spend) is
untouched — the window never consults `draftSource()`, so the no-spend default gains no side
door. `SOCIAL_AUTOPOST_PRODUCTS` remains empty; unattended drafting is still off.

## Cost model

~$0.02–0.05 per draft at the `claude-opus-4-8` default (≈1K in / ≤2K out, one forced tool call).
Knob: `SOCIAL_DRAFT_MODEL` (downshift to `claude-sonnet-5` if the bill says otherwise). Blast
radius: contributors only (allowlist + scrypt), brief capped at 2 000 chars, one call per press.

## Premortem — how this goes wrong

- **A leaked contributor session farms the endpoint.** Bounded: allowlist re-checked per call,
  2 000-char brief, 2K max tokens. If the bill spikes, the review date catches it; rate limiting
  can ride the existing `rate-limit.ts` if Upstash lands in prod.
- **The window normalizes API spend and the doctrine erodes.** Guard: this entry names the ONE
  surface; anything else still needs its own `/decide`.
- **Drafts get published without reading them.** Unchanged mitigation: the window only fills the
  composer — the human still presses Publish, and the approval lane still exists for
  someone-else-signs-off.

## Expected outcome

Team drafting moves into the product (no Claude Code session needed); monthly draft spend stays
under ~$5 at realistic volume (≈100 drafts). If the 2026-08-30 review shows more, downshift the
model or cap per-day drafts before touching the doctrine.
