# Mkan: the chat closes the loop by itself; 10% of commission; a person at every viewing

**ID**: D-20261114-mkan-autonomous-chat-loop
**Date**: 2026-11-14
**Decided by**: founder (Abdout), from his notebook pages and three answers in session
**Type**: 2 (reversible: env switches `MKAN_VIEWING_AUTO`, `MKAN_QUIET_NUDGE`, `MKAN_INTRO_CAP`, `AGENT_ANSWER_LOCALES`)
**Status**: active — code on mkan main (`7cad48e`…`d21b75d`), not deployed
**Reviewed-by**: 2026-11-28
**Tags**: #mkan #chat #revenue #whatsapp #tiktok

## Decision

- The WhatsApp and web chat run with no person in the gate: no reply may promise a person; the line
  re-asks silent brokers for a tenant's own pick, answers questions under the homes, agrees the viewing
  time with the broker and books it, nudges a quiet tenant once, and follows up after the viewing.
- Mkan's cut stays **10% of the broker's commission**, with a free viewing for Mkan's tenants.
- **A person from Mkan attends every viewing**; Mkan stays in the middle from the first deal.
- Mobile: installable web app first, stores after.
- The line never claims to be human; asked, it says it is Mkan's assistant.

## Context

Read on production 11-05..11-13: a real tenant (12 Nov) picked a home and was told a person would reply;
nobody did. 16 hand-offs in nine days, none answered. 0 viewings and 0 deals ever. Detail:
`mkan/src/components/agent/ISSUE.md` (2026-11-14); plan `~/.claude/plans/optimized-twirling-parrot.md`.

## Expected outcome

- **Success looks like:** by 2026-11-28, hand-offs to a person at zero and the first `VIEWING_BOOKED` deal.
- **Failure looks like:** brokers still silent on re-asks, or tenants put off by automated replies.
- **Probability of success**: 0.5
- **Reasoning**: the loop no longer stalls on a person, but demand is thin (a handful of real chats a
  week) and at 5,000–10,000 RWF a deal break-even needs 9–16 paid deals a month until the container
  and database costs are cut (`mkan/docs/cost-study-2026-11.md`).

## Alternatives considered

1. **Flat share per lease (about 15,000 RWF)**: break-even at 4–6 deals; Abdout kept 10% of commission.
2. **Tenant and broker only at the viewing**: fully hands-off; Abdout chose a person at every viewing.
3. **Native apps now**: weeks before any revenue effect; deferred behind the web app.
