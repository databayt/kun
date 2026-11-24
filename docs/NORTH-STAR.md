# North Star

> One metric. Every weekly review tracks it. Every quarterly OKR ladders up to it.
> It serves **the Drive**: cash flow first, break-even or bust (`CONSTITUTION.md`, the governing article). The metric is how the Drive is measured; the Drive is why the metric matters.

---

## The metric

**Active paying schools using Hogwarts.**

- **Active** = the school has logged at least 5 student records, taken at least 1 attendance, OR generated at least 1 invoice in the last 30 days.
- **Paying** = the school has paid an invoice covering the current month or a future month. Pilot/free/trial schools do not count.
- **Hogwarts** = the deployed Hogwarts product (any subdomain on databayt.org or self-hosted instance verified active).

---

## Why this metric

Three reasons:

1. **It collapses the question of product-market fit into one boolean per school.** A school that pays and uses is a school that hired Databayt for a real job. A school that paid but didn't use, or used but didn't pay, is a signal to investigate.
2. **It concentrates focus on the pilot path.** Five products, one north star. Souq/Mkan/Shifa/Swift-app are tracked, but they don't move this number. That is the strategic point — we are not a multi-product company yet; we are a school-software company with adjacencies.
3. **It is countable by anyone.** No formulas, no funnel math. Open the Hogwarts database, count `Tenant` rows where `subscription_status = 'active'` AND `last_active_at > NOW() - 30 days`. The team, the contributors, and Abdout all see the same number.

Alternative metrics rejected:

- **MRR** — too abstract; one school paying $200/mo looks the same as four schools paying $50/mo, which is strategically very different.
- **Active contributors on databayt repos** — measures ecosystem health, not customer health. Without paying customers, ecosystem health is a vanity.
- **Students touched** — aspirational and mission-pull, but un-countable when no schools are live, and gameable when they are.

---

## Targets

| Horizon                  | Target | Why                                                                                                                       |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Today** (2026-11-24)   | 0      | Al-Ibda is client #1: active (81 students) but unsigned and unpaid. Re-baselined 2026-11-24.                              |
| **Q3 2026** (Sep)        | 1      | **Missed (actual 0).** King Fahad Schools was the assumed first payer; it went dormant and never took attendance.        |
| **Q4 2026** (Dec)        | 1 (stretch 2) | Revised 2026-11-24. Committed: Al-Ibda signs and pays. Stretch: a second school (Alqabs, King Fahad, Bakri's school). |
| **12 months** (May 2027) | 3      | Count target kept. The old "$300-450 MRR covers ~85% of burn" no longer holds at 24 SAR per student: 3 schools of 81 students are ~$130/mo. |
| **24 months** (May 2028) | 10     | Count target kept. $1K-1.5K MRR needs ~190-280 students per school on average; at 81 it is ~$430 MRR.                      |
| **5 years** (2031)       | 50     | The vision target. At 81 students per school it is ~$2.2K MRR; the $5-10K claim is unreconciled.                          |

These targets are gates, not goalposts. A miss triggers a review (premortem, pivot, persevere). A beat triggers an investment decision (where to deploy the slack).

## The "enough" line

**Break-even** was written as "paying schools x price/mo >= $500/mo burn", 4-5 schools at $99-149/mo. That pricing was replaced on 2026-11-08 (D-20261108) and 2026-11-17 (D-20261117): one rate of 24 SAR ($6.40) per student per year. On the unverified $500/mo burn, break-even is about **940 paying students** (~12 schools the size of Al-Ibda); on the full cost quoted in D-20261117 ($2,700-4,000/mo) it is about 5,000-7,500 students. The cost base is itself unverified (see `runway.json`). This line is the _Company of One_ discipline (adopted 2026-07-10): growth that adds complexity without moving the paying-school count toward it gets refused by default.

---

## How it's tracked

- **Source**: `/Users/abdout/kun/.claude/memory/north_star.json` — updated weekly by the captain.
- **Update routine**: Monday 08:00 Asia/Riyadh — the `weekly-captain-cycle` routine reads from the Hogwarts production database (via the `neon` MCP) and writes the count + delta.
- **Visible in**: every weekly review, every monthly review, every quarterly OKR check-in, every investor update.
- **Owner**: Captain (writes), Abdout (approves changes to the definition).

---

## When this metric changes

It changes only at the annual strategy off-site (or in an exceptional `decisions/<date>-amend-north-star.md`). The metric is supposed to be uncomfortable; you don't change it just because the number is moving slowly.

**Pre-conditions to change**:

- Hogwarts hits 10+ paying schools AND
- A second product (Souq, Mkan, Shifa) reaches Beta + first paying customer AND
- The team decides Databayt is now a portfolio company, not a school-software company.

Until all three are true, this metric stays.

---

## Last reviewed

2026-05-12 — Founding metric for Databayt.
2026-11-24 — Targets revised (Q3 marked missed, Q4 re-set to 1 + stretch 2, break-even restated per student); definition unchanged. Open: `north_star.json` and this file define "active/paying" differently (see its `definition_conflict_note`).
