---
domain: next-16
severity: warn
paths: ["**/page.tsx", "**/content.tsx", "**/*.tsx"]
since: "Next.js 16.0"
---

# Push `'use client'` to the leaves

Keep `'use client'` on the smallest interactive leaf (a button, an input) and fetch data in Server Components. Marking a page or layout as a client component drags its whole subtree into the bundle and forfeits server-side data access.

## Good

```tsx
// content.tsx — Server Component: awaits data, renders shell
export default async function StudentsContent({
  schoolId,
}: {
  schoolId: string;
}) {
  const students = await getStudents(schoolId);
  return (
    <section className="ps-4">
      <StudentsTable rows={students} />
      <AddStudentButton /> {/* only this leaf is 'use client' */}
    </section>
  );
}
```

## Bad

```tsx
"use client"; // whole page is client — can't await Prisma, ships everything
export default function StudentsContent({ schoolId }: { schoolId: string }) {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    fetch(`/api/students?schoolId=${schoolId}`).then(/* ... */);
  }, []);
  return <StudentsTable rows={students} />;
}
```

## Fix

Remove `'use client'` from the page/content; fetch on the server and isolate `'use client'` to the interactive child component only.
