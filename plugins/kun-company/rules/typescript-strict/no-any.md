---
domain: typescript-strict
severity: error
paths: ["**/actions.ts", "**/validation.ts", "**/*.ts", "**/*.tsx"]
since: "TypeScript 5.0"
---

# No `any` — narrow from `unknown`

`any` disables every check downstream and silently leaks through Server Action
boundaries. Use `unknown` and narrow, or pull a precise type from Zod/Prisma.

## Good

```tsx
export async function createStudent(raw: unknown) {
  const parsed = studentSchema.safeParse(raw); // Zod narrows unknown → Student
  if (!parsed.success) return { error: parsed.error.flatten() };
  const data = parsed.data; // fully typed, no `any`
  return db.student.create({ data: { ...data, schoolId } });
}
```

## Bad

```tsx
export async function createStudent(raw: any) {
  // raw.name, raw.gpa — no checks, schoolId could be undefined, ships broken
  return db.student.create({ data: { ...raw, schoolId } });
}
```

## Fix

Type the input as `unknown`, then narrow with `schema.safeParse()` (or a type guard) before use.
