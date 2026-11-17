# Pricing: the agreed SAR anchors, charged in proportion to students

**ID**: D-20261117-pricing-proportional-sar
**Date**: 2026-11-17
**Decided by**: founder (Abdout), after the Temp group (Ali, Ibrahim Omer) on 2026-11-15
**Type**: 1 (public price; it goes into the first signed contract)
**Status**: executing
**Supersedes**: D-20261108-pricing-one-month-trial (keeps its one free month and its payment shares)
**Reviewed-by**: 2027-01-15
**Tags**: #pricing #hogwarts #revenue #drive #alibda

## Decision

1. **The anchors from the 2026-10-09 rationale stay as agreed.** 250 students cost 6,000 SAR a year,
   500 students 10,000 SAR and 1,000 students 17,000 SAR. The price is quoted in riyal.
2. **A school pays in proportion to its students, with no flat bands.** The rate is graduated, so the total
   has no cliff at the anchors.
   - Students 1–250: 24 SAR each.
   - Students 251–500: 16 SAR each.
   - Students 501 and up: 14 SAR each. Over 1,000 the school gets its own contract.
   - Example: 48 students cost 1,152 SAR, and 300 students cost 6,800 SAR.
3. **No free allowance at any size.** The only offer is a 1-month free trial, and every school pays after it.
4. **Payment.**
   - 50% is due at signing, or when the trial ends.
   - The rest is paid in 4 instalments of 12.5%, the last one by the end of the school year.
   - The contract year follows the school year, as Ibrahim advised.
   - Each payment counts the students enrolled on its date.
5. **Currency.** KSA pays in SAR by bank transfer, with no VAT line. Sudan pays the SAR price in SDG at the
   bank rate on the day, by Bankak.
6. **Live classes have a fair-use allowance.** A school of up to 250 students gets 100 hours a month, up to
   500 gets 200, and above that 400. Extra hours are quoted.
7. **Contract changes from Ibrahim's review on 11-15.**
   - Data is kept while the contract is in force, plus 3 months after it ends for export. Then it is
     deleted.
   - The contract states how it ends.
   - Service details move to a Technical Annex.
8. **Al-Ibda.** It has 48 students and is in Dammam. It already used its free period, so it pays from
   signing: 1,152 SAR a year, which is 576 SAR, then 4 × 144 SAR ending June 2027.

## Context

- On 11-15 Ali wrote that the price we approved was 6,000 SAR a year and that the $6.40 contract looked
  wrong. On 11-17 Abdout decided to keep that rate but make the charge proportional, so that no flat band
  charges a small school 60 SAR per student.
- Effect: the base rate (24 SAR = $6.40) is the same as on 11-08. What is new is the volume tiers above 250
  students, SAR as the quoting currency, and the contract terms.

## Premortem

- *"It failed because the price is too low for small schools to fund the team."* At about 24 SAR per
  student, full cost (about $2,700–4,000 a month) needs about 5,000–7,500 students. Mitigation: chains and
  Al-Ibda's Dammam branch, and offers only as a % off for a set time.
- *"It failed because the docs, site and contract disagreed again."* Mitigation:
  - hogwarts `rates.ts` and marketing `billing/terms.ts` share the same tier table.
  - Tests pin the anchors.

## Expected outcome

Al-Ibda signs by 11-30 and pays 576 SAR by 12-15. **Probability of success:** 0.7.
