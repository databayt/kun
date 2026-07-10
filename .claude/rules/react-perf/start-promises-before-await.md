---
domain: react-perf
severity: error
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "2-10× improvement"
since: "2026-07-10"
---

# Start promises early in route handlers and server actions

In API routes and Server Actions, kick off independent operations immediately — even when a later step needs one of the results, the others shouldn't queue behind it. Chaining every call behind the previous `await` builds a waterfall out of latencies that could have overlapped.

## Good

```ts
export async function GET(request: Request) {
  const sessionPromise = auth(); // starts now
  const configPromise = fetchConfig(); // starts now — doesn't wait for auth
  const session = await sessionPromise;
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id), // only this call truly needed the session
  ]);
  return Response.json({ data, config });
}
```

## Bad

```ts
export async function GET(request: Request) {
  const session = await auth();
  const config = await fetchConfig(); // waited on auth for no reason
  const data = await fetchData(session.user.id); // waited on both
  return Response.json({ data, config });
}
```

## Fix

Assign independent calls to promise variables first; `await` (or `Promise.all`) only at the point each result is actually consumed.

> Source: vercel-labs/agent-skills · react-best-practices
