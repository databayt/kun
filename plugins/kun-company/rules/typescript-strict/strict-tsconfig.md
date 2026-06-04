---
domain: typescript-strict
severity: error
paths: ["tsconfig.json", "**/tsconfig.json", ".github/workflows/*.yml"]
since: "TypeScript 5.0"
---

# Strict tsconfig + `tsc --noEmit` in CI

`strict: true` turns on null-safety and friends; `noUncheckedIndexedAccess`
makes `arr[i]` and `record[key]` return `T | undefined`, catching the
off-by-one and missing-key bugs that crash Server Components at runtime.
CI must fail the build when types break.

## Good

```tsx
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  }
}
// .github/workflows/ci.yml
//   - run: pnpm tsc --noEmit
const first = students[0]; // typed Student | undefined
if (!first) return notFound();
```

## Bad

```tsx
// tsconfig.json — strict off, indexed access unchecked, no CI gate
{ "compilerOptions": { "strict": false } }
const first = students[0]; // typed Student, but undefined at runtime → crash
return <h1>{first.name}</h1>;
```

## Fix

Set `strict: true` and `noUncheckedIndexedAccess: true`, then add `pnpm tsc --noEmit` as a CI step.
