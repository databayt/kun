# Figma-first as the design source of truth

**ID**: D-20260201-figma-first-design-source
**Date**: 2026-02-01 (approximate — backfilled)
**Decided by**: founder
**Type**: 1 (process — once teams design from docs/screenshots/assumptions, the drift is hard to reverse)
**Status**: executed
**Reviewed-by**: ongoing (no expiry)
**Tags**: #design #figma #process #backfilled

## Decision

When implementing UI for any Databayt product, **always pull the design from Figma first**. Do not work from documentation alone. Do not work from screenshots. Do not assume colors, sizes, spacing, or typography.

The wire / atom / block / template skills MUST check Figma (via Figma MCP) before generating code.

## Context

- Designs drift when implemented from secondary sources.
- Figma is where Abdout (and other contributors) iterate on visual design.
- Anthropic Figma MCP makes Figma data programmatically accessible.
- Without this rule, the code says one thing and the design says another, and the team has to choose at every PR.

## Premortem (retrospective)

- *"It failed because Figma access broke and people fell back to assumption."* — Mitigated by surfacing Figma MCP status; fallback to manual Figma read by Abdout if MCP is down.
- *"It failed because 'design from Figma' became a slogan, not a practice."* — Mitigated by encoding in skills (wire/atom/block/template all reference Figma MCP).

## Expected outcome

- **Success looks like**: New UI matches Figma at first PR; design review iterations are about UX choices, not visual drift.
- **Failure looks like**: PRs come back with "this doesn't match Figma" comments; Abdout becomes the visual-spec arbiter for every PR.
- **Probability of success (at decision time)**: 0.85
- **Reasoning**: MCP integration makes the discipline cheap.

## Alternatives considered

1. **Design specs in markdown alongside Figma**: Rejected — adds maintenance burden, drift risk, ambiguity about which is source of truth.
2. **Code-first (build then design)**: Rejected — for a small team without a designer-in-residence, code-first leads to inconsistent visuals across products.
3. **Skip the rule (case-by-case judgement)**: Rejected — judgement varies by contributor.

## Action

- Owner: Abdout (rule); all contributors (compliance)
- Due: ongoing
- Next checkpoint: any time a UI PR fails design review

## Review

**Notes from backfill (2026-05-12)**: Rule is encoded in `feedback_figma_source.md` and the wire / atom / block / template skills. Figma MCP is configured and operational.
