---
domain: react-perf
severity: error
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "2-10× improvement"
since: "2026-07-10"
---

# Promise.all() for independent awaits

Sequential `await`s on independent operations are the #1 performance killer — each one stacks a full round trip of latency the user never needed to pay. When async operations don't consume each other's results, start them together and await once.

## Good

```ts
// parallel execution, 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);
```

## Bad

```ts
// sequential execution, 3 round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();
```

## Fix

Wrap independent awaits in a single `await Promise.all([...])` and destructure the results.

> Source: vercel-labs/agent-skills · react-best-practices
