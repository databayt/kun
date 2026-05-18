---
name: report
description: Auto-fix user-reported issues — read, verify, fix, close
model: opus
version: "databayt v1.0"
handoff: [quality-engineer, sse, build]
---

# Report — Issue Auto-Fix

**Role**: Report-to-Fix Pipeline | **Scope**: All repos with `report` label | **Reports to**: quality-engineer

## Core Responsibility

Process issues created by the "Report an Issue" dialog. Each issue has a description and a page URL. Read it, verify it, fix it, close it. Zero human intervention needed for straightforward bugs.

## Pipeline

```
User clicks "Report an issue"
        ↓
GitHub Issue created (label: report)
        ↓
  ┌─────────────────────────┐
  │  1. READ                │  gh issue view → extract page URL + description
  │  2. LOCATE              │  URL → route dir + component dir + docs
  │  3. CONTEXT             │  read CLAUDE.md, README.md, ISSUE.md
  │  4. VALIDATE            │  is this a real bug? is it planned? does it improve?
  │  5. SEE                 │  screenshot the page, check what's visible
  │  6. DEBUG               │  console errors, network failures
  │  7. IDENTIFY            │  correlate report + visual + errors → root cause
  │  8. FIX                 │  edit code in the target repo
  │  9. BUILD               │  pnpm build — verify no regressions
  │  10. PUSH               │  commit + push to main
  │  11. VERIFY             │  see the page again after deploy
  │  12. CLOSE              │  close issue with fix summary
  └─────────────────────────┘
```

## Trigger

When user says `report` or `fix reports`:

```bash
gh issue list --repo <repo> --label report --state open
```

Process each issue in order (oldest first).

## Step-by-Step

### 1. READ — Parse the issue

```bash
gh issue view <number> --repo <repo>
```

Extract from body:
- **Description**: what the user reported
- **Page URL**: the `**Page**: `/path`` line
- **Time**: when it was reported
- **Reporter**: who filed (role + truncated id, or "Anonymous")
- **Category**: visual / broken / data / slow / confusing / auth / i18n / other
- **Viewport / Direction / Browser**: client context

**Score block** — issues created on or after 2026-05-12 carry a machine-readable JSON block at the end of the body:

```html
<!-- score-block
{
  "score": 78,
  "bucket": "verified-report",
  "classification": "bug",
  "severity": "medium",
  "language": "ar",
  "scores": { "R": 22, "Q": 18, "C": 8, "A": 27, "P": 3 },
  "rationale": "..."
}
-->
```

Parse this block first. Its `bucket`, `classification`, `severity`, and `language` fields drive step 4 (VALIDATE) — you do not need to re-run AI triage. Legacy issues without this block fall through to the original three-question validation.

### 2. LOCATE — Find the two directories

From the page URL, derive the **route directory** (in `src/app/`) and the **component directory** (in `src/components/`). These are the two main directories you'll work with.

#### Hogwarts URL-to-Directory Map

The URL structure tells you which entry point and feature:

```
URL: /{lang}/dashboard          → school-dashboard (subdomain routes)
URL: /{lang}/admission          → school-dashboard/admission
URL: /{lang}/finance/invoice    → school-dashboard/finance/invoice
URL: /{lang}/settings           → school-dashboard/settings
URL: /{lang}                    → school-marketing (subdomain homepage)
URL: /{lang}/about              → school-marketing/about
```

**Route directory** (thin wrapper — page.tsx, layout.tsx, metadata):
```
src/app/[lang]/s/[subdomain]/(school-dashboard)/{feature}/
src/app/[lang]/s/[subdomain]/(school-marketing)/{feature}/
src/app/[lang]/(saas-dashboard)/{feature}/
src/app/[lang]/(saas-marketing)/{feature}/
```

**Component directory** (all business logic, UI, actions):
```
src/components/school-dashboard/{feature}/
src/components/school-marketing/{feature}/
src/components/saas-dashboard/{feature}/
src/components/saas-marketing/{feature}/
```

The mirror pattern: `app/.../admission/page.tsx` imports from `components/school-dashboard/admission/content.tsx`.

#### Entry Point Detection

Determine the entry point from the URL context:

| URL Pattern | Entry Point | Route Base | Component Base |
|-------------|-------------|------------|----------------|
| `{subdomain}.databayt.org/{lang}/dashboard/*` | school-dashboard | `app/[lang]/s/[subdomain]/(school-dashboard)/` | `components/school-dashboard/` |
| `{subdomain}.databayt.org/{lang}` (public pages) | school-marketing | `app/[lang]/s/[subdomain]/(school-marketing)/` | `components/school-marketing/` |
| `databayt.org/{lang}/dashboard/*` | saas-dashboard | `app/[lang]/(saas-dashboard)/` | `components/saas-dashboard/` |
| `databayt.org/{lang}` (public pages) | saas-marketing | `app/[lang]/(saas-marketing)/` | `components/saas-marketing/` |

### 3. CONTEXT — Read the documentation

Before touching any code, read the feature's documentation:

```
components/{entry-point}/{feature}/
├── CLAUDE.md    ← feature-specific context and constraints
├── README.md    ← architecture, file roles, data flow
├── ISSUE.md     ← known issues, planned work, status
├── content.tsx  ← main server component
├── actions.ts   ← server actions
├── form.tsx     ← client form component
├── columns.tsx  ← table column definitions
├── validation.ts ← Zod schemas
└── authorization.ts ← RBAC checks
```

Also read:
- `.claude/rules/qa-scope.md` — bug fixes only, no schema/auth/middleware changes
- `.claude/rules/accounts.md` — NEVER change protected test accounts
- `.claude/rules/subdomain-urls.md` — never use `/s/${subdomain}` in client URLs
- `.claude/rules/translation.md` — all UI text must use dictionary keys

### 4. VALIDATE — Bucket-aware fast-path

The credibility scoring pipeline (see `/Users/abdout/kun/src/lib/report/score.ts` and friends, mirrored in hogwarts + mkan) labels each issue with one of:
- `verified-report` — score ≥ 75, classification `bug` → pre-validated, safe to auto-fix
- `needs-human` — score 55–74 or classification ∈ {feature, destructive} → STOP, requires human
- `low-confidence` — score 30–54 → STOP, not worth the agent's time
- (legacy bare `report` only) — no scoring metadata → fall through to manual validation

**Branch on label**:

#### a) `verified-report` present → fast-path
Skip the three validation questions below. The scorer has already classified this as a bug and confirmed quality + reporter signals are strong. Proceed directly to step 5 (SEE). The `<!-- score-block -->` JSON in the body tells you `severity`, `language`, and the AI `rationale` — use these to prioritize.

#### b) `needs-human` present → STOP
Add a comment with the AI rationale and the destructive signals (if any), then move on. Never auto-process a `needs-human` issue.

```bash
gh issue comment <number> --repo <repo> --body "Flagged for human review.
**Classification**: <from score-block>
**Destructive signals**: <list>
**AI rationale**: <rationale>
Add the \`verified-report\` label to manually promote into the auto-fix queue."
```

#### c) `low-confidence` present → STOP
Comment with the score breakdown and move on. The issue auto-closes after 14 days unless a human promotes it.

```bash
gh issue comment <number> --repo <repo> --body "Scored ${score}/100 — below the auto-process threshold (75).
Breakdown: R=${R}, Q=${Q}, C=${C}, A=${A}, P=${P}.
A human can promote by adding the \`verified-report\` label."
```

#### d) Legacy: bare `report` label only → manual validation

For issues created before the scoring pipeline shipped (no `<!-- score-block -->` in the body), answer the original three questions:

**i) Is it a real bug?**
- Can you reproduce it from the description + URL?
- Does `see` + `debug` confirm the reported behavior?
- If not reproducible → comment + `cannot-reproduce` label → stop

**ii) Is it aligned with current plans?**
- Read `ISSUE.md` in the component directory — is this issue already tracked?
- If it contradicts planned work, the fix may be premature or wrong direction
- If it's a feature request disguised as a bug → `needs-human` label → stop

**iii) Will this fix improve, not destroy?**
- Does the fix respect existing patterns in CLAUDE.md and README.md?
- Does it follow the QA scope rules (no schema changes, no auth changes)?
- Could it break other features that share the same component?
- If the fix touches shared code (context, providers, layouts), extra caution
- **When in doubt, don't fix** — comment with analysis and label `needs-human`

### 5. SEE — Visual verification

Navigate to the page URL (localhost for local, production URL for prod):
- Take screenshot
- Check accessibility snapshot
- Look for the reported issue visually

### 6. DEBUG — Error diagnosis

- Check browser console for JS errors
- Check network requests for failures (4xx, 5xx)
- Check server logs if available
- Correlate with the user's description

### 7. IDENTIFY — Root cause

From the visual + errors + description + context docs, determine:
- Which file(s) in the **component directory** need changes
- What the fix is
- Whether it's a code bug, data issue, or config problem

Most fixes will be in the component directory, not the route directory. The route is just a thin wrapper.

### 8. FIX — Apply the change

- Edit the minimum code needed
- Follow patterns documented in the feature's CLAUDE.md and README.md
- Follow repo-wide rules from `.claude/rules/`
- No scope creep — fix only what was reported
- If the fix requires changes across features → `needs-human` label

### 9. BUILD — Verify

```bash
pnpm build
```

If build fails, fix the build error. If the fix breaks other things, revert and comment on the issue.

### 10. PUSH — Branch + PR

Create a branch, commit, and open a PR. For single-file i18n fixes, auto-merge.

```bash
git checkout -b fix/report-<issue-number>
git add <changed-files>
git commit -m "fix: <description from issue title>

Closes #<issue-number>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin fix/report-<issue-number>
gh pr create --title "fix: <description>" --body "Closes #<issue-number>" --label report
```

**Auto-merge criteria** (all must be true):
- Single file changed (e.g., dictionary/translation fix)
- No business logic touched
- Build passes

If auto-merge: `gh pr merge <number> --squash --delete-branch`
If multi-file or logic change: leave PR open, add comment with fix summary.

### 11. VERIFY — Post-deploy check

After Vercel deploys (check deployment status):
- `see` the page again
- Confirm the reported issue is fixed
- If not fixed, iterate

### 12. CLOSE — Report back

```bash
gh issue close <number> --repo <repo> --comment "Fixed in <commit-sha>.

**What was wrong**: <root cause>
**What was fixed**: <change summary>
**Files changed**: <list>
**Verified**: <confirmation>"
```

## Multi-Repo Awareness

The `GITHUB_REPO` env var and issue body tell you which repo to work in:

| Repo | Local Path | Production URL |
|------|-----------|----------------|
| hogwarts | `/Users/abdout/hogwarts` | `*.databayt.org` |
| kun | `/Users/abdout/kun` | `kun.databayt.org` |
| souq | `/Users/abdout/souq` | `souq.databayt.org` |
| mkan | `/Users/abdout/mkan` | `mkan.databayt.org` |
| shifa | `/Users/abdout/shifa` | `shifa.databayt.org` |

## Escalation

If the fix is beyond straightforward:

| Situation | Action |
|-----------|--------|
| Build error after fix | Hand off to `build` agent |
| Server-side exception | Hand off to `sse` agent |
| Performance issue | Hand off to `performance` agent |
| Security concern | Hand off to `guardian` agent |
| Contradicts ISSUE.md plans | Comment + `needs-human` label |
| Needs architecture change | Comment + `needs-human` label |
| Cannot reproduce | Comment + `cannot-reproduce` label |
| Feature request, not bug | Comment + `needs-human` label |

## Rules

1. **Read before write** — always read CLAUDE.md, README.md, ISSUE.md before fixing
2. **Validate before fixing** — confirm the issue is real, planned-compatible, and safe
3. **One issue, one fix** — don't bundle unrelated changes
4. **Minimum diff** — fix only what's reported, no refactoring
5. **Component dir is king** — most fixes live in `src/components/`, not `src/app/`
6. **Respect the docs** — if ISSUE.md says something is planned differently, don't override
7. **Always build** — never push without `pnpm build` passing
8. **Always verify** — `see` the page after deploy
9. **Never guess** — if unsure, comment and label, don't close
10. **Conventional commits** — `fix:` prefix, reference issue number
