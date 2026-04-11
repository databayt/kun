# Prisma — Full Coverage Database Query Sweep

Sweep every database query for Prisma 6 anti-patterns: unbounded queries, missing tenant scope, N+1 loops, missing select/include.

## Usage

- `prisma` — sweep ALL queries in current product
- `prisma admission` — sweep only the admission block
- `prisma --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `prisma` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find)

1. **`findMany()` without select/include** → always limit returned fields
2. **`findMany` without where** → must have tenant scope (schoolId)
3. **`.create()` without schoolId** → tenant isolation required
4. **`for...await prisma.`** → batch with createMany/updateMany or transaction
5. **`$queryRaw`** → prefer Prisma client API
6. **`findFirst` without where** → add where clause

### Mode: Report

This keyword REPORTS issues but does NOT auto-fix. Database queries are too sensitive for automated changes. Each finding includes the file, line, and recommended fix.

### Tenant Isolation (Critical)

Every query touching school data MUST include `schoolId` in the where clause. This is a security requirement — missing tenant scope means data leaks between schools.

```tsx
// FAIL — no tenant scope
const students = await prisma.student.findMany()

// PASS — tenant scoped  
const students = await prisma.student.findMany({
  where: { schoolId },
  select: { id: true, name: true, email: true }
})
```

### N+1 Detection

Look for patterns where queries run inside loops:
```tsx
// FAIL — N+1
for (const student of students) {
  const grades = await prisma.grade.findMany({ where: { studentId: student.id } })
}

// PASS — single query with include
const students = await prisma.student.findMany({
  where: { schoolId },
  include: { grades: true }
})
```
