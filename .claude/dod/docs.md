# Definition of Done — Docs

Story 26.5 in `docs/EPICS-V4.md`.

Documentation work is "done" only when ALL of the following are true:

## Accuracy

- [ ] Every code snippet in the doc actually compiles / runs (manually verified)
- [ ] Every file path referenced exists (run `bash scripts/inventory.sh` after to confirm)
- [ ] Every count claim (e.g. "12 rules") matches `kun-inventory.json` — or uses the `<EngineCounts />` component
- [ ] Every link resolves (no 404s)

## Voice

- [ ] Arabic-first when audience is Saudi/Sudanese/MENA
- [ ] English voice: prescriptive imperative ("Do X. Don't Y.") — Vercel AGENTS.md style
- [ ] No marketing fluff
- [ ] Consistent terminology with the rest of `docs/` and `content/docs/`

## Structure

- [ ] If this doc is canonical (in `docs/`): version-stamped header (Version: X.Y, Date: YYYY-MM-DD)
- [ ] If this doc is published (in `content/docs/`): frontmatter has `title` + `description`
- [ ] Section headings hierarchical (H1 → H2 → H3, no skips)
- [ ] Tables preferred over long bullet lists for structured data

## Drift

- [ ] If the doc references files in `.claude/`: the files exist
- [ ] If `docs/` and `content/docs/` cover the same topic: both updated in this PR
- [ ] No claims about phase status that contradict `EPICS-V4.md`

## Engagement

- [ ] If the doc is for a new feature: example is realistic (not foo/bar)
- [ ] If the doc is procedural: each step has a verifiable outcome
- [ ] If the doc is for a skill: links to `paths` frontmatter so it auto-loads contextually

## Captain awareness

- [ ] Captain journal mentions docs work only if it changes external-facing surface
- [ ] If this doc supersedes another, the old one is marked deprecated or deleted in this PR
