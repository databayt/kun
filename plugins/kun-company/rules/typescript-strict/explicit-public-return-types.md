---
domain: typescript-strict
severity: warn
applies-to: ["**/actions.ts", "**/lib/**/*.ts", "**/data/**/*.ts", "**/*.ts"]
since: "TypeScript 5.0"
---

# Explicit return types on exported functions

Exported functions are module-boundary contracts. Inferred returns drift
silently when the body changes; an explicit annotation makes the contract
the source of truth and surfaces breaks at the function, not at every caller.

## Good

```tsx
type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function enrollStudent(input: unknown): Promise<ActionResult> {
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const row = await db.enrollment.create({
    data: { ...parsed.data, schoolId },
  });
  return { ok: true, id: row.id };
}
```

## Bad

```tsx
// return type inferred — adding an early `return null` silently widens
// the contract to `... | null` and every caller's narrowing rots
export async function enrollStudent(input: unknown) {
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) return null;
  return db.enrollment.create({ data: { ...parsed.data, schoolId } });
}
```

## Fix

Annotate the return type (e.g. `Promise<ActionResult>`) on every exported function.
