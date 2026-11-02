# QA workflow via GitHub Issues, not WhatsApp

**ID**: D-20260315-qa-workflow-github-issues-not-whatsapp
**Date**: 2026-03-15 (approximate — backfilled)
**Decided by**: founder
**Type**: 1 (cultural — once we set the channel for QA, switching is painful)
**Status**: executed
**Reviewed-by**: 2026-09-15 (after 6 months of use)
**Reviewed**: 2026-11-02 (grade: partly)
**Tags**: #qa #process #ali #github #backfilled

## Decision

All QA-discovered issues from Ali (or anyone testing Databayt products) flow through GitHub Issues with the `report` label. Not WhatsApp. Not Apple Notes. Not text messages. The auto-fix pipeline (`/report` skill + `report` agent) only triggers on labeled issues that pass the credibility-scored verified-report bucket.

## Context

- Ali tests features in production after Claude deploys.
- Without structured channel, bugs were arriving via WhatsApp and getting lost in scrollback.
- Auto-fix pipeline depends on machine-readable issue format with credibility scoring.
- Issues are also the canonical evidence base for the Contribution Units sharing-economy model — so structured issue creation has a second purpose.

## Premortem (retrospective)

- *"It failed because Ali finds GitHub friction-y and reverts to WhatsApp."* — Partially happened; mitigated by templates + the `/issue` skill + Sedon's batched-support cycle bridging when Ali is constrained.
- *"It failed because the credibility scoring gates out real bugs."* — Has happened occasionally; mitigated by the `needs-human` bucket.
- *"It failed because contributors don't realize WhatsApp reports won't get fixed."* — Standing reminder needed; built into Ali's 1:1 prep.

## Expected outcome

- **Success looks like**: ≥80% of QA issues arrive as GitHub Issues with `report` label; auto-fix pipeline closes ≥50% of `verified-report` bucket within 24h.
- **Failure looks like**: Bugs stuck in WhatsApp; auto-fix pipeline goes idle; team loses faith in the system.
- **Probability of success (at decision time)**: 0.7
- **Reasoning**: Cultural change in habits is hard; needs reinforcement.

## Alternatives considered

1. **WhatsApp + manual transcription**: Rejected — too lossy, doesn't scale, breaks the auto-fix pipeline.
2. **Linear or Jira instead of GitHub**: Rejected — GitHub is already the developer's home; one tool less.
3. **A custom in-app reporter**: Rejected — would take 2 weeks of engineering for marginal benefit; defer until paying customers.

## Action

- Owner: Abdout (system) + Ali (compliance) + Sedon (bridge for Saudi-routed reports)
- Due: 2026-03-15
- Next checkpoint: 2026-09-15

## Review

(To be filled at reviewed-by date 2026-09-15.)

**Notes from backfill (2026-05-12)**: System is operational and reinforced via session-start hook (`scripts/session-start.sh`) — open `verified-report` issues are auto-prompted at session start. See `/Users/abdout/.claude/projects/-Users-abdout-kun/memory/feedback_qa_workflow.md` and `~/.claude/rules/session-start.md`.

**2026-11-02 — decision-review sweep · grade: partly**

- **Actual outcome**: GitHub Issues became the QA record — 216 `report` issues org-wide since April (April: 112 of 143 closed inside 24 h; since the 09-13 human gate: 38 of 56, 10 open). But every one arrived through the in-app report dialog — the Alternative 3 this record rejected — which took one day, not two weeks (hogwarts `0b3a6ea43`, kun `cf219df`, 2026-04-02). Since 03-15 no teammate has authored an issue, a comment (the checklists hogwarts#164/#166/#273/#377/#402 carry only abdout + bots) or a commit in any databayt repo.
- **Was the prediction right?** Partially. The ≥80% share is unmeasurable (WhatsApp volume is not on record). The 24 h verified-bucket target never applied: no issue ever reached `verified` because triage never ran without an API key (`A: 0`, e.g. hogwarts#409), and the auto-fix lane gave way to the 09-13 human gate (`b8ad593`, `project_report_human_gate.md`).
- **Was the decision right** (independent of outcome)? Yes on the channel, no on the mechanism — structure arrived once filing cost the reporter one tap.
- **Lesson**: Bring the channel to the reporter. Asking teammates to move to GitHub produced zero teammate-authored issues in 7.5 months; the one-day dialog carried all 216.
