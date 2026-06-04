---
domain: typescript-strict
severity: info
paths:
  [
    "**/validation.ts",
    "**/actions.ts",
    "**/form.tsx",
    "**/columns.tsx",
    "**/types.ts",
  ]
since: "TypeScript 5.0"
---

# Derive types from Zod / Prisma, don't hand-duplicate

A hand-written `interface` that mirrors a Zod schema or Prisma model drifts
the moment the schema changes — the duplicate compiles fine while lying.
Derive with `z.infer` and `Prisma.X` so one edit propagates everywhere.

## Good

```tsx
// validation.ts
export const studentSchema = z.object({ name: z.string(), gpa: z.number() });
export type StudentInput = z.infer<typeof studentSchema>;

// row type straight from Prisma's generated client
type StudentRow = Prisma.StudentGetPayload<{
  select: { id: true; name: true };
}>;

export function StudentForm({ defaults }: { defaults: StudentInput }) {
  /* ... */
}
```

## Bad

```tsx
export const studentSchema = z.object({ name: z.string(), gpa: z.number() });

// duplicated by hand — add `email` to the schema and this silently rots
interface StudentInput {
  name: string;
  gpa: number;
}
```

## Fix

Replace the hand-written shape with `z.infer<typeof schema>` (input) or `Prisma.XGetPayload` (rows).
