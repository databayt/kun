---
domain: react-19
severity: info
paths: ["**/*.tsx", "**/components/**/*.tsx"]
since: "React 19.0"
---

# Read promises and context with use()

When a client component must consume a server promise or context, call `use()` under a `<Suspense>` boundary instead of resolving it through a `useEffect` + `useState` waterfall. Unlike other hooks it may sit in a condition or loop, with three limits from the React docs: create the promise in a Server Component and pass it down — `use(fetch(...))` in a client render makes a new promise on every retry; never wrap `use` in `try/catch` (it throws to suspend — use an error boundary); and never skip it by reading `promise.status`/`promise.value` (React 19.3 adds a dev warning for exactly that).

## Good

```tsx
// page.tsx (Server Component) — start the query, pass the promise, don't await
export default async function Page() {
  const { schoolId } = await requireTenant();
  const students = db.student.findMany({ where: { schoolId } });
  return (
    <Suspense fallback={<Skeleton />}>
      <Roster students={students} />
    </Suspense>
  );
}
```

```tsx
// roster.tsx
"use client";
import { use } from "react";

export function Roster({ students }: { students: Promise<Student[]> }) {
  const rows = use(students); // suspends until resolved
  return <StudentTable rows={rows} />;
}
```

## Bad

```tsx
"use client";
export function Roster() {
  const [rows, setRows] = useState<Student[] | null>(null);
  useEffect(() => {
    getStudents().then(setRows);
  }, []); // waterfall after hydration + flicker
  return rows ? <StudentTable rows={rows} /> : <Skeleton />;
}
```

## Fix

Start the fetch on the server, pass the unawaited promise as a prop, and read it with `use(promise)` inside `<Suspense>` plus an error boundary.

> Source: https://react.dev/reference/react/use
