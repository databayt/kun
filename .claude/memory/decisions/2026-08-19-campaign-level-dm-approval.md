# Comment→DM capture: the human gate moves to the campaign, not the message

**ID**: D-20260819-campaign-level-dm-approval
**Date**: 2026-08-19
**Decided by**: founder (proposed by Claude; awaiting Abdout)
**Type**: 1 (irreversible — automated outbound messages to strangers under a brand name; Meta App Review is a platform-side one-way door, and a bad first impression cannot be un-sent)
**Status**: proposed
**Reviewed-by**: 2026-11-19 (90 days)
**Tags**: #social #funnel #capture #autonomy #meta #openreply

## Decision

Add a **comment→DM capture lane** to the social pipeline, modelled on
[diwenne/openreply](https://github.com/diwenne/openreply) (pattern only — not the
codebase, not its Redis/BullMQ worker). A published `SocialPiece` may carry a
**campaign**: a keyword, a match mode, a DM template, and an optional public
reply. When someone comments the keyword on that post, kun sends the templated
private reply carrying a tracked link, and writes the commenter as a `Prospect`.

The autonomy change this requires, stated plainly: **the human gate moves from
per-message to per-campaign.** Today `/social` doctrine #5 is "no human approval,
no publish" and every outbound brand message is approved individually — that is
L1/L2. An auto-DM has no per-message approval and is therefore L4 under the
current ladder. This decision resolves that collision by treating the **DM
template as the approvable artifact**: a contributor approves the template once
in the existing `/social/publish` review queue, and each send is a _delivery of
an already-approved artifact_, not a new message. Nothing else in the ladder
moves — copy is still Claude's, Arabic still ships first, the moral gate still
binds, and the public-reply half of a campaign (which is visible brand speech,
not a 1:1 reply) stays per-campaign approved too.

Without this decision the capture lane cannot ship at all. It is the blocker,
not a detail.

## Context

**The pipeline is outbound-complete and capture-missing.** `calendar → draft →
media → approve → publish → measure` runs end to end; `/measure` then hands back
reach and engagement numbers that nobody can act on, because nothing converts a
reactor into a row. `/funnel`'s own measured truth: 0 funnel sessions, 0 leads
moved through a gate, 0 active paying schools against a Q3 target of 1 —
**structurally** zero, because `upsertInboundProspect` and `promoteToLead()` are
built, idempotent, and have **zero importers**. This lane would be their first
real caller.

**It fits the funnel's cost doctrine exactly.** keyword → templated DM is
deterministic and **zero-token** — no per-lead Anthropic call, which
`.claude/skills/funnel/SKILL.md` names as a hard rule. Under the subscription-only
billing posture that is the strongest structural argument for the lane.

**The Meta constraint is measured, not assumed** (debug_token on
`FACEBOOK_PAGE_ACCESS_TOKEN_HOGWARTS`, 2026-08-19):

- Token is `PAGE` type, `expires_at: 0` (permanent), Business app "Gabriel" (renamed from "Hogwarts Social" 2026-08-19).
- Granted scopes: `pages_manage_posts`, `pages_read_engagement`,
  `pages_read_user_content`, `pages_show_list`, `public_profile`, `read_insights`.
- **`pages_messaging` is NOT granted.** Neither is `pages_manage_engagement`
  (needed for the public-reply half).
- Reading comments already works today (`pages_read_user_content` is present) —
  only the _send_ half is unpermissioned.

Meta's private-replies mechanics, from the Messenger Platform docs:
`POST /PAGE-ID/messages` with `recipient: {comment_id}`; requires
`pages_messaging` and a Page token with the MESSAGING task; **exactly one message
per commenter**; must be sent **within 7 days** of the post/comment; after they
reply, the standard 24-hour window applies. So a re-auth with the added scopes is
required, and because the app must be Live to message non-admins, **App Review**
is on the path.

**Scope stays the standing slice.** OpenReply is Instagram-first; IG is gated on
#141 and [D-20260806](./2026-08-06-social-one-slice-hogwarts-facebook-sudan.md)
binds us to hogwarts × facebook × Sudan. The pattern lands on **Facebook comments
today**; IG inherits it when #141 unblocks. No widening.

## Premortem

> It's 2026-11-19 and this decision failed catastrophically. Here's why:

The campaign shipped against a Sudan-facing hogwarts post. The keyword matched
partially, so comments that merely _contained_ the word — including two arguing
about the school-fees crisis — triggered the DM. Parents received an unsolicited
sales message from a school-software brand in the middle of a thread about
families who cannot pay fees. Screenshots circulated. The Page took a wave of
reports; Meta restricted messaging on the app, which also killed the App Review
we had just cleared, and with it the only live transport the whole social
pipeline has. The approved-once template was never re-read after approval, so
nobody noticed it had been written for a different post. Worse, the Prospect rows
it produced were people who never asked for anything — so the one lane that was
supposed to prove capture instead produced a list we could not ethically work.

### Risks exposed

1. **Match precision — a keyword hits a conversation it was never meant for.**
   _Mitigation_: whole-word matching is the **default and the only mode shipped
   first**; partial matching requires its own `/decide`. A campaign is bound to
   exactly one `SocialPiece` and dies with it. Every campaign carries a
   negative-keyword list, and the Sudan moral clause (`/social` doctrine #6) is
   checked against the _template_ at approval, not just against post copy.
2. **Approve-once decays — the template outlives the context it was approved in.**
   _Mitigation_: campaign approval **expires with the 7-day private-reply window**
   — the platform limit is also the approval TTL, which costs nothing to enforce
   and makes stale approval structurally impossible. A campaign also auto-pauses
   after N sends (start at 25) pending a human re-look, and every send is logged
   with the exact rendered body.
3. **Platform risk concentrates on the one live transport.** Facebook is the only
   wired channel; a messaging restriction takes the whole pipeline down, not just
   this lane. _Mitigation_: a **kill switch** (`SOCIAL_CAMPAIGNS=off`, checked at
   drain time, not at boot) and a conservative self-imposed send cap well under
   Meta's ceiling. _Partially accepted_: concentration is inherent to the one-slice
   decision and is a known cost of it.
4. **Consent — a comment is not a request to be messaged.** _Mitigation_: the
   keyword must be an **explicit opt-in phrase the post itself asks for** ("comment
   _دليل_ and I'll send it"), never an ambient word. If the post does not ask, no
   campaign. The DM leads with what they asked for and carries an opt-out line.
   _This is the constraint the whole lane hangs on; if it cannot be held, do not
   ship._

## Expected outcome

- **Success looks like**: by 2026-11-19, ≥1 published hogwarts post carries an
  approved campaign; ≥20 private replies sent with zero moral-gate violations and
  zero Meta enforcement; ≥5 `Prospect` rows created **by this lane** — making
  `promoteToLead()` a called function for the first time; a measured click-through
  on the tracked link, so `/measure` reports a per-person signal rather than reach.
- **Failure looks like**: App Review not cleared (lane never ships), OR any Meta
  messaging restriction on the Page, OR a DM that a reasonable Sudanese parent
  would call intrusive, OR 20+ sends producing 0 replies (the mechanism works and
  the offer does not).
- **Probability of success**: 0.45
- **Reasoning**: the engineering is small and the pattern is proven in the wild;
  the risk sits almost entirely in Meta App Review, which is slow, opaque, and
  outside our control — a messaging permission for a Business app with no
  published messaging product is a plausible rejection. Conditional on review
  clearing, I'd put the rest at ~0.75.

## Alternatives considered

1. **Keep per-message human approval** (a human eyeballs each DM before it sends).
   _Rejected_: the 7-day window and the value of an instant reply both collapse
   under a human round-trip, and at any volume worth having, a human rubber-stamps
   rather than reads — which is worse than campaign approval, because it _looks_
   like a gate. Reconsider if volume stays under ~5/week, where it is honest.
2. **Run OpenReply itself, self-hosted.** _Rejected_: a second Next.js app plus
   Redis and a BullMQ worker duplicates infrastructure kun already has —
   `/api/social/drain`, the cron routes and the launchd drain **are** the worker,
   and Neon is an adequate queue at this volume. It is also Instagram-first, so it
   solves a channel that is gated. Take the pattern, not the process.
3. **Skip capture; drive comments to a link in the post and let the funnel catch
   them there.** _Rejected_: that is today's state, and today's state has produced
   zero captured leads. The whole point of the private reply is that it is a 1:1
   surface that yields an addressable person; a link click yields an anonymous hit.
4. **Do nothing.** _Rejected_: `/measure` stays a vanity read and `/funnel` stays
   structurally empty. Against The Drive — cash flow first — an outbound pipeline
   with no capture cannot reach revenue no matter how well it posts.

## Action

- Owner: Abdout (the autonomy call) → Claude (implementation once decided)
- Due: decision by 2026-08-26; if yes, the Meta re-auth + App Review submission is
  the long pole and starts immediately — the code is worthless until it clears.
- Next checkpoint: 2026-09-19 (App Review status), then 2026-11-19 (full review)
- Blocked on: re-auth adding `pages_messaging` (+ `pages_manage_engagement` if the
  public-reply half ships) and Meta App Review with the app Live.
- Scoping issue: [databayt/kun#150](https://github.com/databayt/kun/issues/150)

## Review (filled at reviewed-by date)

- **Actual outcome**:
- **Was the prediction right?**
- **Was the decision right** (independent of outcome)?
- **Lesson**:
