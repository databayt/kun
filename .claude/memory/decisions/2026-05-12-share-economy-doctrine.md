# Share-economy doctrine — establish a referenced model

**ID**: D-20260512-share-economy-doctrine
**Date**: 2026-05-12
**Decided by**: founder
**Type**: 1 (constitutional — once published, the doctrine binds the meaning of "Community is the moat" / Principle #22 across the company and the public-facing brand)
**Status**: in-progress (drafting)
**Reviewed-by**: 2026-08-12 (90 days)
**Tags**: #doctrine #share-economy #constitution #principle-22 #samia #references

## Decision

Establish a single canonical doctrine document at `/Users/abdout/kun/docs/SHARE-ECONOMY-MODEL.md` (~800 lines, English, strategy folder) that binds four named intellectual references to the existing "Open source, sharing economy" posture:

1. محمد حسام خضر — *رائد الأعمال Inside Out* (Dar Don, 2019)
2. جميل عبد القادر أكبر — *قص الحق* (Ummatics 2024 colloquium) + *Crisis in the Built Environment* (1988)
3. Islamic economy primitives — Mudaraba, Shirkat al-a'mal, Waqf-track, Zakat-aligned needs fund
4. الحركة الوطنية للبناء والتنمية (NMBD) — *ورقة الاقتصاد التشاركي* + production-solidarity principle

Plus a public bilingual mirror at `/Users/abdout/kun/content/docs/share-economy.mdx` (+ `.ar.mdx`) and light reference-only edits to `CONSTITUTION.md` §7, `PRINCIPLES.md` #22, `CEO-OS.md` Part V, and `hogwarts/content/docs-{en,ar}/shared-economy.mdx` footers.

**Explicitly defers** operational mechanics (CU pool sizing, multi-class CU, conversion-to-cash, founder/operating reserve %s) to Samia's Q3 2026 framework owned in the future `databayt/revenue` repo. The doctrine doc does NOT pre-commit Samia's work.

## Context

- The phrase "Open source, sharing economy" appears in 25+ files across kun/, hogwarts/, and content/ — positioned everywhere, defined nowhere at the company-wide level.
- The only existing operational artifact is `hogwarts/content/docs-en/shared-economy.mdx` (CU measurement spec, hogwarts-scoped).
- Founder identified four references he wants integrated to give the existing posture its intellectual lineage.
- Samia owns the operational Spec with a Q3 2026 deadline; she has not started.
- Plan reviewed and approved 2026-05-12; see `/Users/abdout/.claude/plans/for-share-econmay-model-velvet-wren.md`.

## Premortem (per Principle #7 — Invert, always invert)

It is **2026-12-31** and the share-economy doctrine has failed. Why?

1. **Political-lineage misstep.** The doctrine cited politically charged figures from NMBD's intellectual lineage (Qutb, Turabi, Shariati, Messiery, Taha Abdurrahman) in a public document. A Saudi sponsor, Gulf government counterparty, or US-based open-source maintainer screenshotted the page and circulated it. The reputational damage closed two pilot conversations and a potential angel sponsor. → Mitigation: cite NMBD's *paper* and the production-solidarity principle; name only Bennabi (مالك بن نبي) and Hajj Hammad (ابو القاسم حاج حمد) in public. Internal-only doc footnotes the full list with an explicit non-endorsement caveat. Grep-verified before publish.
2. **Khedr-misquote.** The doctrine attributed a specific framework ("Helicopter Khedr methodology" or a named equity formula) without verifying via Khedr's book or YouTube. A reviewer who had read Khedr pointed out the misrepresentation; the credibility of the doctrine was undermined. → Mitigation: cite Khedr generally as "MENA-context Islamic-compliant equity methodology"; defer specific framework names until founder reads chapter or verifies via YouTube.
3. **Doctrine confused for operational spec.** Contributors read the doctrine as the new CU spec, expected the founder reserve % or pool sizes to be there, and lost trust when they weren't. Samia got pulled into rewriting the doctrine instead of drafting the operational Spec for Q3. → Mitigation: page 1 of the doctrine says explicitly *"This document does NOT change CU formulas. Samia's Q3 2026 framework will."* Repeated in Part IV ("What this IS NOT"). Translation table in Part III makes the doctrine/spec separation visible at a glance.
4. **Scope creep.** The doctrine grew from ~800 lines to ~2,500 because the temptation to specify pool sizes, multi-class CU schemas, Mudaraba contract templates, and waqf custodial structures was irresistible. Drafting consumed 6 weeks of founder time. Samia's Q3 work was effectively pre-empted; she had nothing to add by the time it was her turn. → Mitigation: hard stop at the Part III translation table. Each "Samia Q3 formalizes" row IS the wall. If a sentence describes a number, a formula, a percentage, or a contract clause that doesn't already exist in `hogwarts/content/docs-en/shared-economy.mdx`, it does not belong in this doctrine.
5. **Samia bottleneck.** The doctrine required Samia's review of Arabic terminology and Islamic-finance precision, but Samia's screen-reader workflow made markdown review slow and Anthropic UI accessibility blockers compounded. Publication slipped 8 weeks. → Mitigation: Samia reviews, does not draft. Voice 1:1 for terminology questions. Deliver in plain markdown (not MDX) for the review pass. Samia signs off only on Part II §D (Islamic primitives) and the Arabic mirror — not the whole doc.
6. **Cross-repo link rot.** The doctrine cross-linked to Constitution §7 and Principle #22; after a routine restructure of `kun/docs/`, the links broke and the doctrine pointed at nothing. → Mitigation: use absolute paths within kun (e.g., `/Users/abdout/kun/docs/CONSTITUTION.md`) in the source, and relative paths for the published MDX. Verify resolution on both `databayt.org/docs` and `ed.databayt.org/docs` after deploy.
7. **Captain doesn't auto-load doctrine.** The captain agent's frontmatter loads CONSTITUTION/PRINCIPLES/NORTH-STAR, not SHARE-ECONOMY-MODEL. When asked a share-economy question, the captain answered without the doctrine context and gave a Western-canon answer that contradicted the doctrine. → Mitigation: by design — captain reaches the doctrine via Constitution §7 / Principle #22 / CEO-OS Part V cross-links. Do NOT bloat captain frontmatter. If the captain consistently misses the doctrine in practice, that's a memory-retrieval problem to address separately.

## Expected outcome

- **Success looks like**: Doctrine published in 3 weeks. Ali can pitch the doctrine in ≤3 minutes to a sponsor. Samia approves Arabic terminology and confirms her Q3 Spec scope is unblocked. Ahmed Baha receives a courtesy share before public announcement. CONSTITUTION/PRINCIPLES/CEO-OS/hogwarts cross-links resolve and are grep-verified clean.
- **Failure looks like**: Doctrine slips past 6 weeks (scope creep). Samia rewrites doctrine instead of drafting Spec. Political-lineage misstep surfaces in sponsor conversation. Doctrine is ignored in practice — captain answers continue using only Western-canon framings.
- **Probability of success (at decision time)**: 0.75
- **Reasoning**: Scope is well-defined; references are real; founder has the bandwidth in May; Samia is the only critical-path reviewer and she only signs off on Part II §D + Arabic mirror. Risks 1–4 above are all addressable through documented mitigations. Main residual risk is scope creep (founder discipline).

## Alternatives considered

1. **Single combined doc with doctrine + draft operational spec (~2,000 lines)** — Rejected. Pulls Samia's Q3 work forward without her validation; locks numbers prematurely; risks the doctrine being read as Spec.
2. **Light touch — references only (no new doctrine doc)** — Rejected. The gap (positioned everywhere, defined nowhere) remains. Adding citations to CEO-OS Part V is necessary but not sufficient.
3. **Doctrine in `databayt/revenue` repo (new)** — Rejected. Empty repo with TBD content is worse than no repo; create when Samia has a Q3 draft.
4. **Doctrine in hogwarts/content/docs-en/ extending shared-economy.mdx in place** — Rejected. The hogwarts CU spec is product-scoped; doctrine is company-scoped. Mixing audiences degrades both.

## Action

- Owner: Abdout (founder, author)
- Reviewer: Samia (Arabic terminology + Islamic-finance precision, Part II §D + Arabic mirror only)
- Sanity-checker: Ali (pitchability — can he deliver this in 3 minutes?)
- Courtesy share: Ahmed Baha at King Fahad before public announcement
- Due: 2026-06-02 (3 weeks from decision date)
- Next checkpoint: 2026-08-12 (90-day review of doctrine adoption)

## Review

(To be filled at reviewed-by date 2026-08-12.)

Specific review questions to answer at 90 days:
1. Has the doctrine been cited in a sponsor pitch, contributor onboarding, or board-style document?
2. Has Samia begun the Q3 operational Spec, and does the doctrine support her work?
3. Are CONSTITUTION/PRINCIPLES/CEO-OS/hogwarts cross-links still resolving?
4. Has any political-lineage concern surfaced from a sponsor, partner, or contributor?
5. Has any Khedr-misquote concern surfaced from a reviewer who has read his work?
6. Did scope creep occur after publication (Part III translation table breached)?
