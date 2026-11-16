# The jobs loop becomes a contracts lane

**ID**: D-20261116-jobs-lane-to-contracts
**Date**: 2026-11-16
**Decided by**: founder
**Type**: 2 (reversible: set `"mode": "jobs"` in `jobs/loop.config.json`)
**Status**: executed
**Reviewed-by**: 2026-11-30
**Tags**: #revenue #jobs #tenders

## Decision

The seek/jobs loop stops sending job applications. Its Rwanda feeds now look for **tenders that Databayt Ltd bids on as a company**, plus client requests from databayt.org. For each tender that fits the company's registered activities (software, IT consultancy, data, computer training), `jobs:bid` writes a proposal packet. A person submits it. Nothing is auto-sent. The AI-training platform cards are archived.

## Context

The loop ran from 2026-09-26 to 11-16.

| What happened | Count |
|---|---|
| Applications sent | 66 |
| Follow-ups | 67 |
| Interviews | 0 |
| Positive human replies | 0 |
| Auto-acknowledgements | 36 |
| Rejections | 17 |

- Three earlier pivots (10-10, 10-27, 11-07) changed *which* postings were targeted. None of them changed whether those employers could hire the applicant at all.
- The platform lanes that did answer were all waiting on steps only the founder could take.
- Meanwhile, the existing adapters found about 19 tender notices in November, and none was bid.
- One tender asked for a *software firm* and was sent an ordinary CV-and-letter application, because only the title was checked.
- Databayt Ltd was registered on 2026-11-08, so company bids are now possible.
- Rwanda's e-procurement system (Umucyo) publishes its open tenders publicly.

Canon #6, The Lean Startup: hold a regular pivot-or-persevere review, because persevering by default is the failure mode. This is that review.

## Expected outcome

- **Success looks like:** at least 2 bids submitted by 2026-11-30, and 1 shortlist or clarification request within 45 days.
- **Failure looks like:** no in-scope tender appears in 30 days, or packets sit unsubmitted because the company gates are missing (tax clearance, Umucyo bidder account).
- **Probability of success:** 0.4.
- **Reasoning:** the supply is real and visible. AB Rwanda HRIS closes 11-27, and the Umucyo list carries government work. But a two-week-old company with no audited accounts fails many eligibility checklists. NGO and private ToRs are the likelier first wins.

## Alternatives considered

1. **Keep applying, fix the funnel again.** Rejected: three funnel fixes produced no interview, and the eligibility block doesn't change with targeting.
2. **AI-training platforms only.** Rejected: every lead there waited on founder-only steps for five weeks. The founder chose to drop them.
3. **Do nothing / shut the lane.** Rejected: tender supply is already flowing through the adapters, and the new company makes it biddable at little cost.

## Action

- Owner: kun (loop + `jobs:bid` packets) · founder (submits bids, clears company gates)
- What changed:
  - `scripts/seek/loop.sh` contracts mode.
  - `src/lib/jobs/send-gate.ts`: tenders never become letters.
  - `scripts/seek/archive.ts`
  - `scripts/seek/bid.ts`
  - `umucyo` discover adapter.
  - Contracts digest and weekly report.
- Next checkpoint: 2026-11-30, which counts bids submitted and the company gates still missing.

## Review (filled at reviewed-by date)

- **Actual outcome**: …
- **Was the prediction right?** …
- **Was the decision right?** …
- **Lesson**: …
