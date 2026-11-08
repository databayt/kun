# Pricing reset: every student from the first, one free month

**ID**: D-20261108-pricing-one-month-trial
**Date**: 2026-11-08
**Decided by**: founder (Abdout), in the interim-CEO session
**Type**: 1 (a public price; schools quote it back to us, and changing it twice burns trust)
**Status**: executed
**Reviewed-by**: 2026-12-20 (the day after Al-Ibda's first payment is due)
**Tags**: #pricing #hogwarts #revenue #drive #alibda

## Decision

1. **Stop "first 100 students free forever".** Every student counts from the first: **24 SAR (= $6.40) per
   student per year**, the rate set on 2026-10-09.
2. **Every new school gets one free month** (`TRIAL_MONTHS = 1`), replacing the 3- and 6-month pilot offers.
3. **Al-Ibda keeps the 3 months it joined under, counted from setup on 09-19.** Its first bill is
   **2026-12-19**: 48 students → $307.20 a year, $153.60 first, then 4 × $38.40.
4. **Sudan pays in SDG for a USD price.** The price is fixed in USD and paid in SDG at the bank rate on the
   payment day, by Bankak, to an account Abdout names.
5. **The schedule is unchanged:** 50% when the free month ends, then 12.5% at months 3, 6, 9 and 12. Each
   payment counts the students enrolled on its date.

## Context

- Production on 2026-11-08: Al-Ibda (client #1) had 48 students and King Fahad 14. Under the free-100 rule
  both were free forever, so the first real schools could never pay.
- The 10-09 rationale was "6,000 SAR for a 250-student school", which is 24 × 250. The free 100 broke it:
  the formula gave 3,600.
- The docs quoted six other prices, and the pilot was 3 months on some pages and 6 on others.
- Runway was estimated at 3–5 months. R-005 ("no paying customer") triggers on 11-12.
- On 09-17 the team argued price in «المدرسة 2.0»:
  - Abobaker proposed $5 per student a year.
  - Abdout noted that global prices weigh on Sudanese schools.
  - The competitor average is about $6.

## Premortem

- *"It failed because Al-Ibda balked once money was named."* Mitigation:
  - The amount is small ($25.60 a month).
  - The 3 free months honour what they joined under.
  - The contract is one page.
  - Abdout presents it personally.
- *"It failed because the SDG rate moved between invoice and payment."* Mitigation: the price is fixed in
  USD and converted on the day.
- *"It failed because the team kept quoting old prices."* Mitigation:
  - One pricing page, and the stale pages deleted.
  - The chatbot reads `rates.ts`.
  - The outreach emails were fixed.
- *"It failed because small schools can't reach break-even."* At $6.40, break-even is about 940 paying
  students. Mitigation: chains first (Alqabs has 15+ branches), and Al-Ibda's Dammam branch.

## Expected outcome

- **Success:** Al-Ibda signs by 11-20 and pays $153.60 by 12-31. Two more schools start their free month in
  Sprint 2.
- **Failure:** no signature by 11-30, or a school disputes the price it was shown.
- **Probability of success:** 0.65.

## Alternatives considered

1. **Keep the free 100.** Rejected: client #1 would pay nothing.
2. **Bill for a minimum of 100 students (2,400 SAR a year).** Rejected by Abdout: he chose the per-student
   rate from student 1.
3. **A fixed SDG price, reviewed each term.** Rejected: the SDG loses value between reviews.
4. **Do nothing until more schools join.** Rejected by the Drive (cash first).

## Where it lives

- hogwarts `src/components/saas-marketing/pricing/rates.ts`: `FREE_STUDENTS = 0`, `TRIAL_MONTHS = 1`.
- `content/docs-*/pricing.mdx` (the team page) and `support/pricing.mdx` (customers).
- The chatbot prompt (`chatbot/prompts.ts`) and the outreach emails.
