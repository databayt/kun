---
name: package
description: Package Management Command
---

# Package Management Command

Audit, update, and align dependencies across all databayt repositories.

## Usage
- `/package` - Full audit: scan all 7 repos, compare against latest npm versions, report gaps
- `/package audit` - Quick consistency check across repos (no npm lookups)
- `/package update <repo>` - Update all deps in one repo (e.g., `/package update hogwarts`)
- `/package update <package>` - Update one package across all repos (e.g., `/package update next`)
- `/package sync` - Align all shared packages to target versions across all repos
- `/package align <package>` - Align one package to highest version across repos

## Argument: $ARGUMENTS

## Instructions

### Repository Paths
- kun: `/Users/abdout/kun`
- hogwarts: `/Users/abdout/hogwarts`
- souq: `/Users/abdout/souq`
- mkan: `/Users/abdout/mkan`
- shifa: `/Users/abdout/shifa`
- codebase: `/Users/abdout/codebase`
- marketing: `/Users/abdout/marketing`

### If argument is empty — Full Audit

1. **Scan** — Read `package.json` from all 7 repos in parallel using Agent tool
2. **Lookup** — Check latest versions via `npm view <pkg> version` for all shared packages
3. **Compare** — Build cross-repo version matrix
4. **Classify** gaps:
   - **Critical**: Major version behind (e.g., Next 15 vs 16, Zod 3 vs 4)
   - **Inconsistent**: Same package at different versions across repos
   - **Risky**: `latest` tags, stale betas, misplaced deps, duplicates
   - **Outdated**: Minor/patch versions behind
5. **Report** — Structured table with priority actions

### If argument is "audit" — Quick Check

1. Read all `package.json` files in parallel
2. Compare shared packages across repos (no npm lookups)
3. Report inconsistencies and risks only

### If argument starts with "update" — Update Mode

**Single repo** (e.g., `update hogwarts`):
1. `cd /Users/abdout/<repo>`
2. `pnpm outdated` — see what's behind
3. `pnpm update` — apply safe updates (minor/patch)
4. `pnpm build` — verify nothing broke
5. Report what changed

**Single package** (e.g., `update lucide-react`):
1. Find all repos using that package
2. `npm view <package> version` — get latest
3. For each repo: update package.json, run `pnpm install`
4. For each repo: `pnpm build` — verify
5. Report results per repo

### If argument is "sync" — Full Alignment

1. Build target version map for all shared packages
2. Update each repo to target versions
3. Build-verify each repo
4. Report successes and failures

### If argument starts with "align" — Single Package Alignment

1. Find highest version of that package across all repos
2. Update all repos to that version
3. Build-verify each repo

### Shared Packages (MUST be aligned)

**Exact alignment required:**
- next, react, react-dom, typescript, tailwindcss
- @prisma/client, prisma, zod
- next-auth, @auth/prisma-adapter

**Minor alignment required (same major.minor):**
- lucide-react, class-variance-authority, clsx, tailwind-merge
- framer-motion, sonner, cmdk, vaul, embla-carousel-react
- date-fns, bcryptjs, uuid, react-hook-form, @hookform/resolvers
- resend, geist, next-themes, react-day-picker
- vitest, @playwright/test, @testing-library/react

### Safety Rules

1. **Always build after updating** — `pnpm build` must pass
2. **Never force major upgrades** — Propose a plan, get approval
3. **Never update one repo and leave others behind** on shared packages
4. **Never use `latest` tag** in package.json
5. **Pin framework packages** — next, react, react-dom should use exact versions (no ^)
6. **Run `prisma generate`** after any Prisma update
7. **Check peer dependencies** before updating Radix/shadcn packages

### Output Format

```
## Package Health — YYYY-MM-DD

### Critical (Action Required)
| Package | Repo | Current | Latest | Migration |
|---------|------|---------|--------|-----------|

### Inconsistencies
| Package | Versions Found | Target |
|---------|---------------|--------|

### Risks
| Issue | Repo | Fix |
|-------|------|-----|

### Available Updates
| Package | From → To | Repos | Safe? |
|---------|----------|-------|-------|

### Recommended Actions
1. ...
```
