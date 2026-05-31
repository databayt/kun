---
domain: react-19
severity: info
applies-to: ["**/*.tsx", "**/components/**/*.tsx"]
since: "React 19.0"
---

# Read promises and context with use()

When a client component must consume a server promise or context, call the `use()` hook (under `<Suspense>`) instead of resolving it through a `useEffect` + `useState` waterfall. It suspends cleanly, keeps the data flow declarative, and unlike other hooks may be called conditionally.

## Good

```tsx
// page.tsx (server) passes the promise down — no await here
export default function Page() {
  const studentsPromise = db.student.findMany({ where: { schoolId } });
  return (
    <Suspense fallback={<Skeleton />}>
      <Roster promise={studentsPromise} />
    </Suspense>
  );
}

// roster.tsx (client)
("use client");
import { use } from "react";
export function Roster({ promise }: { promise: Promise<Student[]> }) {
  const students = use(promise); // suspends until resolved
  return <StudentTable rows={students} />;
}
```

## Bad

```tsx
"use client";
import { useEffect, useState } from "react";
export function Roster() {
  const [students, setStudents] = useState<Student[] | null>(null);
  useEffect(() => {
    getStudents().then(setStudents);
  }, []); // waterfall + flicker
  if (!students) return <Skeleton />;
  return <StudentTable rows={students} />;
}
```

## Fix

Start the fetch on the server, pass the unawaited promise as a prop, and read it with `use(promise)` inside a `<Suspense>` boundary instead of `useEffect`/`useState`.
