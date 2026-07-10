---
domain: react-perf
severity: warn
paths: ["**/*.tsx", "**/*.ts"]
impactDescription: "faster initial paint"
since: "2026-07-10"
---

# Suspense boundaries around slow data, not awaits in the shell

Awaiting data at the top of a page blocks the entire layout — sidebar, header, footer all wait on a fetch only one section needs. Move the `await` into the child component and wrap it in `<Suspense>` so the shell streams immediately and the slow part fills in. Skip this for SEO-critical above-the-fold content or where the loading→content jump would cause layout shift.

## Good

```tsx
function Page() {
  return (
    <div>
      <Sidebar />
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay /> {/* only this section waits */}
      </Suspense>
      <Footer />
    </div>
  );
}

async function DataDisplay() {
  const data = await fetchData(); // blocks only this component
  return <div>{data.content}</div>;
}
```

## Bad

```tsx
async function Page() {
  const data = await fetchData(); // blocks the entire page
  return (
    <div>
      <Sidebar />
      <Header />
      <DataDisplay data={data} />
      <Footer />
    </div>
  );
}
```

## Fix

Push the `await` down into the component that consumes it and wrap that component in `<Suspense fallback={...}>`; to share one fetch across siblings, start the promise in the parent and read it with `use()` (see react-19/use-hook-for-promises).

> Source: vercel-labs/agent-skills · react-best-practices
