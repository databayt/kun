# databayt/revenue (seed)

> This directory is a **seed** for the public ledger repo `databayt/revenue` that tracks contributions and revenue distribution for the databayt sharing-economy model.
>
> The actual repo will be created as a follow-up to PR #10. For now this is the spec drafted in-place to keep the conversation about CU math, reserves, and disputes anchored to a real artifact.

## What lives here when this becomes a real repo

```
databayt/revenue/
├── README.md                       # this file (rewritten as public-facing)
├── RULES.md                        # CU table + distribution policy + anti-gaming
├── CONTRIBUTING.md                 # links to kun's CONTRIBUTING.md
├── ledger/                         # revenue events, signed by founder
│   └── 2026/
│       └── 03-15-king-fahad.md
├── distributions/                  # monthly distribution events
│   └── 2026-03.md
├── reports/                        # auto-generated monthly CU reports
│   └── monthly-report-2026-03.md
├── .snapshot/                      # nightly aggregates (signed JSON, hash chain)
│   └── 2026-03-31.json
└── .github/
    ├── workflows/
    │   ├── contrib-tally.yml       # nightly aggregate across all 13 repos
    │   ├── contrib-monthly.yml      # 1st of month, generate report
    │   ├── distribution-window.yml  # 7-day public review window
    │   └── snapshot-integrity.yml   # SHA-256 hash chain check
    ├── ISSUE_TEMPLATE/
    │   └── dispute.yml              # public dispute form
    └── CODEOWNERS                   # only @abdout for ledger/ and distributions/
```

## The model in one paragraph

Every closed issue + merged PR + signed commit across all 13 databayt repos is an immutable Contribution Unit (CU) credit. Sizes (1/2/3/5/8/13) on issues lock at `status/ready` and become the CU multiplier when the issue closes. The PR template's Contribution declaration block attributes credits to author/pair/reviewers/design — parsed by the monthly tally workflow. Real revenue (Hogwarts pilot, sponsors) flows through this ledger: founder reserve and operating reserve are held back; the rest is distributed monthly proportional to CU share. AI co-authors are recorded but earn 0 CU — humans get paid.

## Status

- `RULES.md` v1.0 drafted (TBD reserve % — locked in a separate small "lock-PR" before first cash distribution)
- `contrib-tally.yml` + `contrib-monthly.yml` drafted in this seed
- Backfill script + symbolic-distribution dry run pending

## Why this is open

Anyone can read the CU table, dispute attributions, fork the org and the ledger if rules drift abusively. That's the open-source guarantee — the founder's reserve is structural (CODEOWNERS + branch protection), not a private decree.

## Cross-references

- `databayt/kun#9` — workflow PR that bootstraps the issue/PR/commit attribution chain
- `databayt/kun/CONTRIBUTING.md` — contributor walkthrough
- `databayt/kun/.claude/rules/github-workflow.md` — the rule that all 13 repos follow
