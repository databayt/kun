---
name: refine
description: Backlog grooming — apply ICE scoring across all open issues, propose priority changes, dispatch captain decision if shifts are major
argument-hint: "[--repo <repo> | --all]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(jq:*), Edit
context: fork
agent: general-purpose
---

# /refine

The backlog grooming ceremony. Replaces "let's prioritize" meetings with deterministic ICE scoring across the full org backlog.

## Inputs

- All open issues across `databayt/*` repos (registry: `.claude/memory/repositories.json`)
- `.claude/memory/runway.json` for current weeks-remaining (urgency multiplier)
- `.claude/memory/revenue.json` for revenue-correlated impact
- `.claude/memory/pilot-king-fahad.json` for pilot-correlated impact

## ICE scoring

Each open issue receives:

| Factor | Scale | Source |
|--------|-------|--------|
| **I**mpact | 1–10 | revenue, pilot, blocker count, customer-facing |
| **C**onfidence | 1–10 | how well-scoped, owner experience, prior similar work |
| **E**ase | 1–10 | inverse of est_hours; small tasks = high ease |

Score = I × C × E (max 1000).

Bonus rules:
- +20% if labeled `pilot` AND pilot stage ≠ live
- +30% if labeled `report` AND opened by paying customer
- +50% if blocks another P0
- −30% if not on current sprint plan

## Procedure

### Step 1: Snapshot current backlog

```bash
for repo in databayt/{kun,hogwarts,mkan,souq,shifa,marketing,swift-app}; do
  gh issue list --repo "$repo" --state open --limit 100 \
    --json number,title,labels,assignees,createdAt,updatedAt \
    | jq --arg r "$repo" 'map(. + {repo: $r})'
done | jq -s 'add'
```

Save to `.claude/refine-snapshot-{date}.json` for diff against next refinement.

### Step 2: Score

For each issue, captain reads body + comments and assigns I, C, E scores. Cache by issue + content-hash so re-runs are cheap (haiku is enough — see cost routing).

### Step 3: Propose priority changes

Diff current `priority:P0/P1/P2` labels vs new ICE-derived priority:

| Current | New | Issues |
|---------|-----|--------|
| P1 → P0 | promotions | issue list |
| P0 → P1 | demotions | issue list |
| (none) → P0 | new urgents | issue list |

### Step 4: Dispatch decision if shifts are major

If > 5 issues change priority, OR any pilot-related issue is demoted, OR any P0 is demoted:

`/dispatch --priority decision --deadline 24h "Refine: {n} priority changes proposed"`

Captain attaches the proposed change list + ICE rationale to the dispatch.

### Step 5: Apply non-controversial changes

For changes that don't trigger Step 4's dispatch threshold (small refinements, new label additions, label removals):

```bash
gh issue edit {n} --remove-label P1 --add-label P0 --repo {repo}
```

Update `.claude/refine-{date}.md` with the applied diff.

## Output

- `.claude/refine-snapshot-{date}.json` — full backlog snapshot for diffing
- `.claude/refine-{date}.md` — human-readable change report
- Captain dispatch — only if Step 4 threshold tripped

## Cadence

- Weekly (Wednesday is the conventional time, halfway through sprint)
- Or on demand when captain detects "many issues opened, priorities unclear"

## Definition of Done

- [ ] Snapshot file exists for today
- [ ] Refine report written with rationale per change
- [ ] All non-controversial label changes applied
- [ ] Captain dispatched if threshold tripped

## When NOT to use this skill

- Mid-sprint task swap (use direct `gh issue edit`)
- Architectural priorities (escalate to tech-lead)

## Reference

- Captain matrix: `.claude/captain/decision-matrix.yaml`
- Sprint plan: `/sprint-plan`
- Product agent (owns long-term roadmap): `.claude/agents/product.md`
