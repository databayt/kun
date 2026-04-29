<!--
  Pull Request — databayt/kun

  Every PR closes an issue. If you don't have an issue yet, run `/issue` first.
  The Contribution declaration block at the bottom is parsed by the revenue tally.
  False declarations forfeit credit for this PR.
-->

## Summary

<!-- 1-3 bullets. What changed and why. The diff shows what was changed; this block tells the reader why. -->

-
-

## Linked issue

Closes #<!-- issue number; required for revenue attribution -->

<!-- For partial work, use `Refs #N` and keep the issue open. -->

## Test plan

<!-- How a reviewer verifies this works. Concrete steps + expected output, or screenshot pairs for UI. -->

- [ ]
- [ ]

## Screenshots

<!-- Required for UI changes. Before/after pair. -->

| Before | After |
| ------ | ----- |
|        |       |

## Checklist

- [ ] I read CLAUDE.md and CONTRIBUTING.md
- [ ] Branch name follows `<type>/<issue#>-<slug>` (e.g. `feat/9-unified-workflow`)
- [ ] Every commit follows Conventional Commits — `pnpm exec commitlint --from origin/main --to HEAD` passes
- [ ] Every commit is signed (`git log --show-signature -1` shows `gpg/ssh: Good`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (if applicable)
- [ ] `pnpm build` passes
- [ ] No secrets, API keys, or credentials in the diff
- [ ] CLA acknowledged (SSPL-1.0 + commercial license grant — see CONTRIBUTING.md)

## Contribution declaration

<!--
  Auto-filled by /pr from the linked issue. Edit only the pair / design lines.
  Parsed by .github/workflows/contribution-declaration.yml — false claims fail the check.
-->

Closes #<issue> (size: <points>)

- Author: @<handle>
- Pair (50% of size): @<handle> | none
- Reviewers (10% each, max 3): _GitHub will list reviewers automatically_
- Design credit (20% of size): @<handle> | none — link: <figma/RFC URL>
- AI co-author: claude-opus-4-7 | claude-sonnet-4 | none

By opening this PR I confirm the credits above are accurate. False declarations
forfeit Contribution Units for this PR and reduce the contributor's monthly cap by 25%.
See `databayt/revenue/RULES.md` for the CU model.
