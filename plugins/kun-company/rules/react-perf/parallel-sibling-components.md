---
domain: react-perf
severity: error
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "eliminates server-side waterfalls"
since: "2026-07-10"
---

# Compose sibling Server Components so fetches run in parallel

An `await` in a parent Server Component blocks its children from even starting — nested async components execute as a sequential waterfall. Give each data need its own async component and render them as siblings; React fetches them concurrently.

## Good

```tsx
async function Header() {
  const data = await fetchHeader();
  return <div>{data}</div>;
}

async function Sidebar() {
  const items = await fetchSidebarItems();
  return <nav>{items.map(renderItem)}</nav>;
}

export default function Page() {
  return (
    <div>
      <Header /> {/* both fetch simultaneously */}
      <Sidebar />
    </div>
  );
}
```

## Bad

```tsx
export default async function Page() {
  const header = await fetchHeader(); // Sidebar can't start until this resolves
  return (
    <div>
      <div>{header}</div>
      <Sidebar /> {/* fetches only after Page's await */}
    </div>
  );
}
```

## Fix

Move each `await` into its own async component and render them as siblings (or pass children through a layout) instead of awaiting in the parent above them.

> Source: vercel-labs/agent-skills · react-best-practices
