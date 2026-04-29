# databayt/revenue — RULES.md v1.0

> Open-source sharing-economy compensation rules. Versioned. Disputable. Locked at the version this file ships at.

## What this document is

This is the canonical specification of the Contribution Unit (CU) model that converts git/GitHub activity into proportional revenue distribution among contributors to the databayt organization.

When real revenue lands (Hogwarts King Fahad pilot, sponsors, future products), it is distributed monthly per the CU shares computed from the prior month's git activity across all 13 databayt repos.

Anyone can dispute. All disputes are public issues on this repo.

## Contribution Unit (CU) — the unit of credit

A CU is the atomic unit of attribution. Every closed issue + merged PR + review + design contribution generates CUs that add to a contributor's monthly tally.

Issues carry a Fibonacci size estimate at creation: `1 | 2 | 3 | 5 | 8 | 13`. Once `status/ready` is applied, the size locks. That locked size becomes the CU multiplier when the issue closes.

## CU table

| Action | CU | Notes |
|--------|-----|-------|
| Issue assignee whose work closed it | `1.0 × size` | the doer's headline credit |
| PR author (if ≠ assignee) | `0.2 × size` | captures pair work where one opens the PR |
| Declared pair | `0.5 × size` | one pair max, declared in PR body |
| Substantive reviewer | `0.1 × size` | per reviewer, max 3, requires >2 review comments + ≥50 chars total |
| Design credit | `0.2 × size` | declared, must link to a Figma URL or RFC issue |
| Issue author (if ≠ assignee) | `0.1 × size` | rewards product thinking |
| QA report root-cause-confirmed | `0.5 × size` | report dialog issues, closed with `area:qa-confirmed` |
| Sales close (`area:sales`) | `1.0 × size` | size reflects deal complexity (1 lead → 5 contract signed) |
| Documentation (`type/docs`) | `1.0 × size` | same as code |
| Maintenance (`type/chore`, `type/ci`) | `0.5 × size` | necessary, less leverage |
| AI co-authorship | `0` | recorded for transparency, never paid |

## Distribution policy

Three reserves, computed monthly off the prior month's revenue:

| Bucket | Percentage | Source of truth |
|--------|-----------|-----------------|
| Founder reserve | `<TBD lock-PR>` | recognizes early-stage founder risk |
| Operating reserve | `<TBD lock-PR>` | covers Anthropic/Vercel/Neon/Stripe + future hires |
| Contributor pool | `<TBD lock-PR>` | distributed by CU share |

The numbers ship in a separate small "lock-PR" before the first cash distribution. Until then: tracking-only mode — CUs accumulate in the ledger but no money moves.

Distribution math:

```
contributor_share = (contributor_CU / total_CU) × contributor_pool
```

## Anti-gaming locks

1. **Story points freeze at `status/ready`** — changing size after that voids credit unless captain documents the reason.
2. **Self-sponsored issues halve credit** — if the issue creator equals the assignee AND no third party applied `sponsor:<handle>` label or commented `+1 sponsor`, the assignee earns `0.5 × size` not `1.0 × size`.
3. **`Closed-as-not-planned` earns 0 CU.** Even if work happened, the org chose not to ship it.
4. **Monthly cap: 100 CU/person.** Overflow rolls to next month at `0.5×` weight. Prevents sprint farming.
5. **Substance threshold for reviews.** A review with ≤2 review comments OR <50 chars total counts as 0 CU. "LGTM" earns nothing.
6. **PR-author ≠ assignee guard.** If someone other than the assignee opens the PR, they declare it. Undeclared mismatch fails `contribution-declaration.yml`.
7. **False declaration penalty.** A contributor caught with a false Contribution declaration forfeits CU for that PR AND has their monthly cap reduced by 25% the following month.

## How a contributor's CU is calculated

For each repo in `databayt/*` (except `archived`), for each closed issue + merged PR in the report period:

```python
for issue in closed_issues_in_period:
    size = issue.size  # locked at status/ready
    if issue.is_self_sponsored and not issue.has_sponsor_signal:
        size *= 0.5
    if issue.closed_as == "not planned":
        continue

    # Headline credit
    award(issue.assignee, 1.0 * size, "assignee")

    # Issue author (if different)
    if issue.author != issue.assignee:
        award(issue.author, 0.1 * size, "issue-author")

    # PR-level credits
    pr = issue.linked_pr
    if pr is None or not pr.merged:
        continue

    if pr.author != issue.assignee:
        award(pr.author, 0.2 * size, "pr-author")

    decl = parse_contribution_declaration(pr.body)
    if decl.pair and decl.pair != "none":
        award(decl.pair, 0.5 * size, "pair")
    if decl.design and decl.design != "none":
        award(decl.design, 0.2 * size, "design")
    for reviewer in decl.reviewers[:3]:
        if reviewer.substantive_count > 2 and reviewer.total_chars >= 50:
            award(reviewer, 0.1 * size, "review")
```

Apply monthly cap of 100 CU per contributor.

## The ledger

This repo is the public, append-only ledger. Three append-only directories:

- `ledger/YYYY/MM-DD-<slug>.md` — revenue events (signed by founder; reference Stripe/bank/sponsor)
- `distributions/YYYY-MM.md` — distribution events (signed by founder; reference monthly report + revenue ledger entries; 7-day public review window before merge)
- `reports/monthly-report-YYYY-MM.md` — auto-generated CU breakdown

Plus `.snapshot/<YYYY-MM-DD>.json` — nightly aggregate JSON, signed commits, hash chain.

## Disputes

Anyone can open a dispute issue against any monthly report or distribution event. The 7-day review window blocks the distribution PR from merging until disputes resolve.

`distribution-window.yml` workflow enforces the window. Override requires `bypass-window` label + documented reason from founder.

If founder is the disputed party, escalation: jointly resolved by Samia + Ali via signed override commit.

## Versioning

`RULES.md` is versioned by the `version` field at the top. Changes ship as PRs to this file. The CU calculation in `contrib-tally.yml` reads the version at the time of the issue's close — so rule changes are forward-only and don't retroactively affect already-credited work.

Cadence: at most quarterly changes. Drift hardens trust.

---

**Version**: `1.0.0-draft` (locks when first PR merges)
**Effective**: TBD lock-PR
**Authors**: @abdout
