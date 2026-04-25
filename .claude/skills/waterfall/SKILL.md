---
name: waterfall
description: Waterfall — Full Coverage Data Fetching Sweep
paths: ["src/**/page.tsx","src/**/layout.tsx","src/**/queries.ts"]
---

# Waterfall — Full Coverage Data Fetching Sweep

Sweep every server component and action for sequential data fetching that should be parallel. The single highest-impact performance fix (2-10x improvement).

## Usage

- `waterfall` — sweep ALL files in current product
- `waterfall admission` — sweep only the admission block
- `waterfall --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `waterfall` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **Sequential awaits** — two or more independent `await` calls in sequence
2. **`for...await` loops** — sequential async iteration
3. **`forEach(async` pattern** — broken parallel attempt (doesn't await)

### Mode: Fix

This keyword finds AND fixes waterfalls.

```tsx
// FAIL — sequential (2x latency)
const user = await getUser(id)
const posts = await getPosts(id)
const comments = await getComments(id)

// PASS — parallel (1x latency)
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id),
])
```

### Important

Not all sequential awaits are waterfalls. Only parallelize when the calls are **independent** (second doesn't need the result of the first):

```tsx
// This is NOT a waterfall — posts depends on user.id
const user = await getUser(id)
const posts = await getPosts(user.id)  // depends on user
```

When unsure, check if the second call uses any value from the first. If yes, keep sequential. If no, parallelize.
