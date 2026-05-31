---
domain: react-19
severity: warn
applies-to:
  ["**/page.tsx", "**/layout.tsx", "**/content.tsx", "**/components/**/*.tsx"]
since: "React 19.0"
---

# Server Components by default; 'use client' only for interactivity

In the App Router every component is a Server Component until you opt out. Add `'use client'` only when a file needs hooks, event handlers, or browser APIs — pushing it down keeps data fetching on the server and shrinks the client bundle.

## Good

```tsx
// content.tsx — Server Component: fetches with tenant scope, no directive
import { auth } from "@/auth";
import { InteractiveFilter } from "./filter"; // 'use client' lives only here

export async function StudentsContent() {
  const session = await auth();
  const students = await db.student.findMany({
    where: { schoolId: session!.user.schoolId },
  });
  return (
    <>
      <InteractiveFilter />
      <StudentTable rows={students} />
    </>
  );
}
```

## Bad

```tsx
"use client"; // forces the whole page to the client just to fetch
import { useEffect, useState } from "react";

export function StudentsContent() {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then(setStudents);
  }, []);
  return <StudentTable rows={students} />;
}
```

## Fix

Drop `'use client'` from the data/layout component, fetch with `auth()` + Prisma on the server, and isolate `'use client'` to the small interactive child.
