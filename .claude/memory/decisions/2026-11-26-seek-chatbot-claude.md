---
id: D-20261126-seek-chatbot-claude
title: Seek chatbot runs the mkan agent block on Claude, hard-capped
date: 2026-11-26
decided_by: founder
type: 2
status: pending-key-approval
review_by: 2026-12-10
---

# Seek chatbot on Claude (hard cap)

**Decision.** Seek (databayt/seek, the Saudi recruitment platform) reuses the mkan chatbot/agent
block as-is on the Claude API instead of the free Groq gateway it shipped with. Abdout chose this
in planning on 2026-11-26.

**Billing guard (CLAUDE.md: any API spend beyond the included lines needs /decide + approval).**
- Separate key `SEEK_ANTHROPIC_API_KEY` stored in the Keychain via `credentials`, never in git.
- Hard monthly cap `SEEK_CHAT_MONTHLY_CAP_USD`, default **10**, enforced in code (mkan `cost.ts`
  pattern): when the month's spend reaches the cap the chatbot returns a "use the forms" fallback.
- Cap 0 or missing key → chatbot disabled, forms still work (blueprint acceptance #10).
- The key does not go live until Abdout approves this entry.

**Canon.** The Lean Startup (#build-measure-learn): the chatbot is a pilot feature; cap the spend,
measure use in the Saudi pilot, then decide whether it earns a bigger line.

**Type 2 (reversible).** Swap the provider back to the OpenAI-compatible gateway (Groq) by env.

**Expected outcome.** Success: pilot employers and candidates use the chat to search jobs / draft
jobs, spend stays under the cap. Failure: spend hits the cap in week 1 with little use.
P(success) = 0.6 — usage is unknown pre-pilot; the cap bounds the downside to $10/mo.

**Alternatives rejected.** (1) Groq brain + mkan UI — cheaper but Abdout chose Claude quality.
(2) Do nothing (keep Groq bare chat) — no tools, no saved chats, weaker product.
