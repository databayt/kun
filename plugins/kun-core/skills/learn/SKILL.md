---
name: learn
description: Learn — Organizational Intelligence
---

# Learn — Organizational Intelligence

Extract patterns, conventions, team dynamics, and company knowledge from git history and code.

## Usage
- `/learn` — Full org scan (all databayt repos)
- `/learn hogwarts` — Deep dive into a single repo
- `/learn team` — People patterns and work dynamics
- `/learn conventions` — Code patterns only (candidate rules)
- `/learn health` — Velocity and quality metrics

## Argument: $ARGUMENTS

## Instructions

Parse arguments:
- No args → full org scan
- Repo name → single repo deep dive (hogwarts, souq, mkan, shifa, kun, codebase)
- `team` → people patterns
- `conventions` → code conventions only
- `health` → velocity metrics only

### Mode: Full Org Scan (no args)

1. List all repos:
   ```bash
   gh repo list databayt --limit 50 --json name,pushedAt,isArchived --jq '.[] | select(.isArchived == false)'
   ```

2. For each active repo, extract:
   - Last 200 commits: `gh api repos/databayt/<repo>/commits?per_page=100`
   - Contributors: `gh api repos/databayt/<repo>/contributors`
   - Languages: `gh api repos/databayt/<repo>/languages`
   - Open issues/PRs count

3. Cross-reference patterns:
   - Which repos share the same stack?
   - Which repos have drifted in conventions?
   - Where is activity concentrated?

4. Store insights in memory: `~/.claude/memory/learn_org_<date>.md`

5. Report key findings to the user.

### Mode: Single Repo (`/learn <repo>`)

1. Navigate to repo (local path or clone):
   ```bash
   cd /Users/abdout/<repo>  # or gh repo clone databayt/<repo> /tmp/learn-<repo>
   ```

2. Git history analysis:
   ```bash
   # Recent activity
   git log --oneline -50
   
   # Commit patterns
   git log --format='%s' -100 | head -20
   
   # Hotspot files
   git log --format=format: --name-only -200 | sort | uniq -c | sort -rn | head -20
   
   # Author activity
   git log --format='%an' -200 | sort | uniq -c | sort -rn
   
   # Fix:feature ratio
   git log --oneline -200 | grep -c "feat:" ; git log --oneline -200 | grep -c "fix:"
   ```

3. Structure analysis:
   ```bash
   # Directory layout
   find . -type d -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*'
   
   # Key files
   cat package.json | jq '{name, dependencies, devDependencies}'
   ls -la prisma/schema.prisma 2>/dev/null
   ls .claude/ 2>/dev/null
   ```

4. Convention extraction — read 5-10 representative files:
   - A `page.tsx` — how pages are structured
   - An `actions.ts` — how server actions are written
   - A component — how components are organized
   - A form — how forms handle validation
   - The middleware — how auth works

5. Store in memory: `~/.claude/memory/learn_<repo>.md`

6. Report: conventions found, drift from org patterns, health metrics.

### Mode: Team (`/learn team`)

1. Scan all repos for author patterns:
   ```bash
   for repo in hogwarts souq mkan shifa kun codebase; do
     echo "=== $repo ==="
     cd /Users/abdout/$repo 2>/dev/null && git log --since="3 months ago" --format='%an|%aI' | head -50
     cd /Users/abdout
   done
   ```

2. Build team map:
   - Who works on which repos
   - Peak activity hours
   - Commit frequency trends
   - Expertise areas (most-touched directories)

3. Store in memory: `~/.claude/memory/learn_team.md`

### Mode: Conventions (`/learn conventions`)

1. Sample files across repos — focus on patterns, not people:
   - File naming conventions
   - Import patterns (barrel vs direct)
   - Auth check patterns
   - Validation patterns
   - Component structure
   - i18n handling

2. Output as candidate rules (not memory — rules are actionable):
   ```
   Observed: 94% of server actions follow auth→validate→execute→revalidate
   → Candidate rule: rules/server-actions.md
   
   Observed: 100% use conventional commits
   → Already documented in CLAUDE.md ✓
   
   Observed: 3 repos use barrel imports, 1 doesn't
   → Candidate rule: rules/no-barrel-imports.md (with migration note)
   ```

3. Ask user: "Found N candidate rules. Generate rule files? (Y/n)"

### Mode: Health (`/learn health`)

1. Numbers only — across all repos:
   ```
   | Repo      | Commits/30d | Fix:Feat | Hotspot File            | Last Push  |
   |-----------|-------------|----------|-------------------------|------------|
   | hogwarts  | 89          | 0.3      | src/app/admission/...   | 2 hours    |
   | kun       | 34          | 0.1      | .claude/agents/_index   | 1 day      |
   | souq      | 12          | 0.5      | src/components/cart/...  | 1 week     |
   ```

2. Trends: compare this month to last month.

3. Flags: repos with no activity > 2 weeks, high fix ratio, large commits.

## Memory Storage

All learn outputs go to `~/.claude/memory/` with type `project`:

```markdown
---
name: learn_<scope>
description: Intelligence extracted from <scope> — <date>
type: project
---

<findings>
```

Update existing memory files rather than creating duplicates. Check MEMORY.md first.

## What Learn Never Does

- Modifies code (read-only)
- Creates PRs (that's analyze's job)
- Makes decisions (that's captain's job)
- Generates config (that's analyze's job)

**Rule**: Learn reads everything, remembers what matters, and makes every other agent smarter. Knowledge is the engine's fuel.
