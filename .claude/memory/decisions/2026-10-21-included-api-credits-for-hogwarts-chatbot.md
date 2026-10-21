# The hogwarts chatbot may spend included Max API credits, capped at $20 a month

**ID**: D-20261021-included-api-credits-for-hogwarts-chatbot
**Date**: 2026-10-21
**Decided by**: founder (Abdout, choosing Haiku 5.5, the $20 cap and the memory scope while planning the chatbot upgrade)
**Type**: 2 (reversible — revoke the key in the Console, or unset `CHATBOT_CLAUDE_ENABLED`, and the chatbot falls back to Groq, then to the guide's own steps)
**Status**: decided
**Reviewed-by**: 2026-11-21
**Tags**: #billing #hogwarts #chatbot

## Decision

The hogwarts chatbot (the SaaS sales bot, the school public sites, and the signed-in support desk) answers with Claude Haiku 5.5 (`claude-haiku-5-5`), paid **only** from the Max plan's included $100 / month API credits. The app switches to Groq at **$18** a month (`CHATBOT_CLAUDE_CAP_USD`) and $2 a day (`CHATBOT_CLAUDE_DAILY_USD`), reading its own spend from `AIUsageLog` under the platform sentinel (`schoolId: "platform"`, `jobType: chatbot | chatbot-notes`). A dedicated Console workspace carries a **$20** spend limit as the hard backstop, so the Console limit never trips mid-answer. A 402 or "credit balance / spend limit" error counts as the cap. Paid overage is never used.

The key has its own name, `CHATBOT_ANTHROPIC_API_KEY` (Keychain `cf-hogwarts-CHATBOT_ANTHROPIC_API_KEY`). The plain `ANTHROPIC_API_KEY` stays unset in hogwarts prod: five dormant callers read it (`src/lib/ai/providers.ts` → admission classify, receipt extraction, the document extractor; `src/lib/ai/enrich-prospect.ts`; `src/lib/report/triage.ts`), and setting it would switch all of them on with no cap.

Fallback chain: Claude → Groq's free tier (only while no text has been sent) → the matched guide's own steps (code, no model). A safety refusal goes to the code path, never to Groq.

This extends D-20261021-included-api-credits-for-readers ($10) and D-20261021-included-api-credits-for-find ($15); together the three lanes can use at most $45 of the $100.

## Context

On 2026-10-21 the chatbot ran on Groq's free tier (`openai/gpt-oss-20b`) with a key shared by hogwarts prod and mkan. During the upgrade's browser pass the model hit its **200K tokens/day** cap by midday, and every chat fell back. Desk members now get the matched guide's steps when that happens, but public visitors with non-guide questions get an apology. The upgrade (plan: `~/.claude/plans/read-hogwarts-chatbot-idempotent-micali.md`) puts the whole help center in a cached prompt, which only fits a model with prompt caching and room to spare. Abdout saw the included-credits offer and asked to use it.

## Expected outcome

- **Success looks like:** answers whenever asked (no daily cliff); support questions land on the right guide in one turn (eval: guide accuracy ≥ 90 %, language match 100 %); spend of a few dollars a month at today's traffic.
- **Failure looks like:** the $18 app cap is hit before month end, or cache hits stay low (the read/(read+write) ratio under 0.6 at steady traffic), or the eval doesn't beat today's Groq answers.
- **Probability of success:** 0.8
- **Reasoning:** a desk turn with the help center cached costs about $0.0005 warm and $0.0021 cold (Haiku 5.5 ≤100K prompts: input $0.10, 5-min cache write $0.125, cache read $0.01, output $0.50 per MTok — checked live 2026-10-21). $18 covers roughly 8.5k–35k answers a month.

## Actions

- Abdout: claim the credits (https://clau.de/api-credits); create the Console workspace `hogwarts-chatbot` with a $20 monthly spend limit; create its key and store it as `cf-hogwarts-CHATBOT_ANTHROPIC_API_KEY` (credentials skill).
- Code: phase 3 of the plan ships the lane dark; it switches on (`CHATBOT_CLAUDE_ENABLED=1`) only after the 40-question eval passes.
- Doctrine amended in the same change: `.claude/skills/funnel/SKILL.md` and `.claude/agents/funnel.md` (the chatbot's answers may use the capped included credits; per-lead work still never does).
- Review the spend on the reviewed-by date: `AIUsageLog` platform rows vs the Console workspace usage (within ±5 %).
