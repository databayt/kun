---
domain: react-perf
severity: warn
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "prevents concurrency bugs and request data leaks"
since: "2026-07-10"
---

# No mutable module-level state for request data

Server renders run concurrently in one process — module scope is process-wide shared memory, not request-local storage. A mutable module variable holding session or tenant data lets overlapping requests overwrite each other: one user's (or one school's) data rendered into another's response. Keep request-scoped data flowing through props, arguments, or `React.cache()`.

## Good

```tsx
export default async function Page() {
  const user = await auth();
  return <Dashboard user={user} />; // request data stays in the render tree
}

function Dashboard({ user }: { user: User | null }) {
  return <div>{user?.name}</div>;
}
```

## Bad

```tsx
let currentUser: User | null = null; // process-wide, shared by all requests

export default async function Page() {
  currentUser = await auth(); // request B overwrites while A still renders
  return <Dashboard />;
}

async function Dashboard() {
  return <div>{currentUser?.name}</div>; // may show another user's data
}
```

## Fix

Delete the module-level variable; pass request data down as props/arguments (immutable static config and deliberately keyed caches remain fine at module scope).

> Source: vercel-labs/agent-skills · react-best-practices
