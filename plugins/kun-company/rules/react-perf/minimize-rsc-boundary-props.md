---
domain: react-perf
severity: warn
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "reduces data transfer size"
since: "2026-07-10"
---

# Pass only consumed fields across the RSC boundary

Every prop crossing the Server→Client boundary is serialized into the HTML response and later RSC payloads — a 50-field Prisma row passed for one displayed field ships 50 fields of page weight on every load. Destructure to exactly what the client component reads before handing it over.

## Good

```tsx
async function Page() {
  const user = await fetchUser();
  return <Profile name={user.name} />; // serializes 1 field
}

// profile.tsx
("use client");
export function Profile({ name }: { name: string }) {
  return <div>{name}</div>;
}
```

## Bad

```tsx
async function Page() {
  const user = await fetchUser(); // 50 fields
  return <Profile user={user} />; // serializes all 50
}

// profile.tsx
("use client");
export function Profile({ user }: { user: User }) {
  return <div>{user.name}</div>; // uses 1
}
```

## Fix

Narrow the client component's props to the fields it renders and pass those primitives from the server component (pairs with prisma-6/select-not-overfetch at the query layer).

> Source: vercel-labs/agent-skills · react-best-practices
