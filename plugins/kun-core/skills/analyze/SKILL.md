---
name: analyze
description: Analyze — Repo Config Generator
---

# Analyze — Repo Config Generator

Analyze any repo's patterns and generate a complete `.claude/` configuration as a pull request.

## Usage
- `/analyze hogwarts` — analyze hogwarts, create config PR
- `/analyze databayt/souq` — analyze from GitHub
- `/analyze .` — analyze current directory
- `/analyze hogwarts --dry-run` — preview without creating PR
- `/analyze hogwarts --update` — refresh existing config
- `/analyze hogwarts --profile core` — generate for specific profile

## Argument: $ARGUMENTS

## Instructions

Parse arguments:
- First arg = repo (name, path, or GitHub URL)
- `--dry-run` = output to stdout, no PR
- `--update` = diff against existing `.claude/`, update stale config
- `--profile <name>` = generate for specific profile (core, security, developer, full)

### The Clean GitHub Cycle

Every analyze run follows this workflow:

```
Issue → Branch → Analyze → Commit → Push → PR → Review → Merge → Close
```

### Step 1: Resolve Repo

```bash
# Local repo
if [ -d "/Users/abdout/$REPO" ]; then
  cd /Users/abdout/$REPO
# GitHub repo  
elif echo "$REPO" | grep -q "/"; then
  gh repo clone $REPO /tmp/analyze-$REPO
  cd /tmp/analyze-$REPO
fi
```

### Step 2: Create Tracking Issue

```bash
gh issue create \
  --repo databayt/$REPO \
  --title "chore: generate repo config from pattern analysis" \
  --body "Automated analysis of repository patterns to generate \`.claude/\` configuration.

## What will be generated
- \`CLAUDE.md\` — project instructions
- \`agents/\` — relevant agent subset
- \`rules/\` — extracted conventions
- \`commands/\` — mapped skills

Triggered by \`/analyze\` command."
```

### Step 3: Create Branch

```bash
git checkout -b chore/analyze-config
```

### Step 4: Run Analysis Pipeline

#### 4a. Stack Detection

```bash
cat package.json | jq '{
  name: .name,
  deps: (.dependencies // {} | keys),
  devDeps: (.devDependencies // {} | keys)
}'
```

Map to technologies:
- `next` → Next.js (check version)
- `react` → React (check version)
- `prisma` → Prisma (check version)
- `tailwindcss` → Tailwind
- `@radix-ui/*` → Radix/shadcn
- `next-auth` → Auth.js
- `zod` → Zod validation

#### 4b. Structure Detection

```bash
# App Router or Pages Router?
ls app/ 2>/dev/null && echo "App Router" || echo "Pages Router"

# src directory?
ls src/ 2>/dev/null && echo "src/ prefix"

# Component organization
find . -path '*/components/*' -name '*.tsx' -not -path '*/node_modules/*' | head -20

# Prisma schema
cat prisma/schema.prisma 2>/dev/null | head -30
```

#### 4c. Convention Sampling

Read 10 representative files and extract patterns:

1. **3 page files** → how routes are structured
2. **2 server actions** → auth/validation/execution pattern
3. **2 components** → naming, structure, imports
4. **1 form** → validation approach
5. **1 middleware** → auth/routing logic
6. **1 layout** → metadata, providers, guards

For each file, note:
- Imports (barrel vs direct, package choices)
- Patterns (auth checks, error handling, data fetching)
- Naming (files, variables, functions, components)
- Structure (export style, organization)

#### 4d. Git Pattern Analysis

```bash
# Commit convention
git log --oneline -20

# Most active areas
git log --format=format: --name-only -100 | sort | uniq -c | sort -rn | head -10

# Recent focus
git log --oneline --since="2 weeks ago"
```

### Step 5: Generate Config

Create `.claude/` directory and files:

#### CLAUDE.md

```markdown
# <Repo Name>

## Stack
<detected technologies with versions>

## Conventions
<extracted patterns — only what's actually observed>

## Structure
<directory layout conventions>

## Keywords
<relevant subset from Kun's keyword map>
```

**Keep under 200 lines.** Concise beats comprehensive.

#### agents/ (selective)

Only include agents the repo needs. Use this mapping:

| Detected | Agents |
|----------|--------|
| Next.js | nextjs, react, middleware |
| TypeScript | typescript, build |
| Prisma | prisma, architecture |
| Tailwind/shadcn | tailwind, shadcn, semantic |
| Auth.js | authjs, guardian |
| i18n | internationalization |
| Tests | test |
| Components dir | atom, template, block |
| Vercel deploy | deploy, ops |
| Git/GitHub | git, github |

Create a minimal `_index.md` listing selected agents with reasons.

#### rules/ (from observations)

Each rule = one observed convention worth enforcing:

```markdown
# rules/<convention>.md
<what the convention is>
<evidence: "observed in N/M sampled files">
```

Only create rules for patterns with >80% consistency. Inconsistent patterns get flagged as suggestions, not rules.

#### commands/ (relevant subset)

Only commands that match the repo's workflow. Always include: `dev`, `build`. Conditionally include based on detected stack.

### Step 6: Commit + PR

```bash
# Stage all generated config
git add .claude/

# Commit
git commit -m "chore: generate repo config from pattern analysis

Analyzed N commits, M files across K directories.
Extracted P conventions, selected Q agents, created R rules.

Closes #<issue-number>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Push
git push -u origin chore/analyze-config

# Create PR
gh pr create \
  --title "chore: generate repo config from pattern analysis" \
  --body "$(cat <<'EOF'
## Summary
Auto-generated `.claude/` configuration from repository pattern analysis.

### Analysis scope
- **Commits analyzed**: <N>
- **Files sampled**: <M>
- **Conventions extracted**: <P>

### Generated config
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions (<lines> lines) |
| `agents/` | <N> agents selected (of 44 available) |
| `rules/` | <N> rules from observed patterns |
| `commands/` | <N> skills mapped to workflow |

### Detected conventions
<bulleted list of key findings>

### Recommended profiles
- **core**: <list> — daily development
- **security**: <list> — auth and validation focus
- **full**: <list> — everything relevant

> Review each file. This is a starting point, not gospel.

Closes #<issue-number>

🤖 Generated with [Kun Engine](https://github.com/databayt/kun)
EOF
)"
```

### --dry-run Mode

Skip steps 2, 3, 6. Output generated config to stdout with clear section headers. No files written, no PR created.

### --update Mode

1. Read existing `.claude/` config
2. Run analysis pipeline
3. Diff generated vs existing
4. Only include changes in PR (new conventions, removed stale rules, updated agents)
5. PR title: `chore: update repo config — N conventions added, M stale removed`

### --profile Mode

Filter generated config to only include agents, rules, and commands relevant to the specified profile.

## Quality Gates

Before creating PR:
- [ ] CLAUDE.md is valid markdown, under 500 lines
- [ ] Agent frontmatter has name, description, model
- [ ] Rules reference actual observed patterns (not aspirational)
- [ ] No secrets in generated config (scan for tokens, keys, passwords)
- [ ] Commands reference valid skill patterns

**Rule**: The best config is the one the team was already following. Analyze just makes it explicit, reviewable, and enforceable.
