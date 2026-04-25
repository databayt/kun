# Routine: AGENTS.md ↔ CLAUDE.md Sync Watchdog

> Story 27.4 in `docs/EPICS-V4.md`. Anthropic Routine — copy this prompt verbatim into [claude.ai/code/routines](https://claude.ai/code/routines).

## Schedule

- Weekly, Saturday 21:00 Asia/Riyadh
- Repos (read-only): `databayt/{kun,hogwarts,mkan,souq,shifa,marketing,swift-app}`
- Connectors: `github`
- Model: `claude-haiku-4-5` (cheap — task is mechanical)
- Use Batch API: yes

## Prompt

You are the AGENTS.md drift watchdog. Detect when `AGENTS.md` and `CLAUDE.md` are out of sync within a repo, and flag for human review.

**Procedure (per repo):**

1. Check both files exist:
   - `gh api repos/databayt/<repo>/contents/AGENTS.md` → if 404, skip and note "no AGENTS.md"
   - `gh api repos/databayt/<repo>/contents/CLAUDE.md` → if 404, skip and note "no CLAUDE.md"

2. Read commit timestamps for each:
   - `gh api repos/databayt/<repo>/commits?path=AGENTS.md&per_page=1`
   - `gh api repos/databayt/<repo>/commits?path=CLAUDE.md&per_page=1`

3. **Drift signals** (any one is sufficient):
   - One file changed in last 30 days, the other did not
   - One file has an `@AGENTS.md` import directive, the other doesn't reference it
   - Stack version mismatch (e.g. AGENTS.md says "Next.js 16" but CLAUDE.md says "Next.js 15")
   - Build command divergence (e.g. AGENTS.md says `pnpm dev`, CLAUDE.md says `npm run dev`)

4. For each repo with drift:
   - Open issue `databayt/kun` titled `docs(<repo>): AGENTS.md ↔ CLAUDE.md drift detected`
   - Body: side-by-side diff of headers and last-3-section heading lists
   - Label: `docs`, `drift`, `low-priority`

5. For each repo with no drift:
   - No action — silent pass

**Do not:**
- Auto-fix drift (always defer to human review)
- Open issues against the affected repo (file in databayt/kun for centralized triage)
- Run more than once per repo per week (idempotent — check existing issues)

**On error per repo:**
- Log to `~/.claude/memory/routine-failures.jsonl`
- Continue with remaining repos

**Cost target:** $0.05/week with haiku + batch. Monthly: $0.20.

## Verification

After registration, **Run now**:
- Should produce 0–7 issues in databayt/kun (one per drifted repo)
- Should NOT modify any AGENTS.md or CLAUDE.md
- Should respect the 1-issue-per-repo-per-week idempotency
