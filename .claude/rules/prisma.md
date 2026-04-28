---
paths:
  - "prisma/**"
  - "src/**/queries.ts"
  - "src/**/actions.ts"
  - "src/lib/db.ts"
description: Prisma 6 — schema, queries, migrations, tenant scoping, N+1 prevention
---

# Prisma Rules

Active in schema, queries, and actions paths. Prisma 6 + PostgreSQL (Neon).

## Schema conventions

Every tenant-owned model has `schoolId` + relation:

```prisma
model Student {
  id        String   @id @default(cuid())
  schoolId  String
  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  // ...
  @@index([schoolId])
}
```

Every model has `createdAt` and `updatedAt`:

```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

CUIDs for IDs, never auto-increment ints. Cascade deletes on parent → child relations.

## Queries — always select, never default

Every query lists fields explicitly. No bare `findMany()` returning the whole row:

```ts
// ❌ Bad
const students = await db.student.findMany({ where: { schoolId } });

// ✅ Good
const students = await db.student.findMany({
  where: { schoolId },
  select: { id: true, name: true, gradeLevel: true },
  orderBy: { name: "asc" },
});
```

Include relations narrowly — use `include` only when joining is cheaper than a second query.

## Tenant scoping is mandatory

`where` clause includes `schoolId` on every read AND every write to a tenant-owned model. No exceptions.

```ts
// Read
const x = await db.student.findFirst({ where: { id, schoolId } });

// Write
await db.student.update({
  where: { id, schoolId }, // composite — Prisma supports it via @@unique
  data: { name },
});
```

For complex multi-tenant joins, use `getTenantContext()` once per action, then thread `schoolId` through.

## N+1 prevention

Loops with awaited DB calls are forbidden. Use one query with `include` or batch via `where: { id: { in: ids } }`:

```ts
// ❌ Bad
const enriched = await Promise.all(
  students.map(async s => ({
    ...s,
    classes: await db.class.findMany({ where: { studentId: s.id } }),
  }))
);

// ✅ Good
const studentIds = students.map(s => s.id);
const classes = await db.class.findMany({
  where: { studentId: { in: studentIds }, schoolId },
  select: { id: true, studentId: true, name: true },
});
const enriched = students.map(s => ({
  ...s,
  classes: classes.filter(c => c.studentId === s.id),
}));
```

## Migrations

```bash
pnpm prisma migrate dev --name <descriptive-name>
```

Names use snake_case. One concern per migration. Don't squash without explicit captain approval. Never edit a migration file after it's committed.

## Connection pooling

Use Neon's pooled URL for runtime, direct URL for migrations:

```env
DATABASE_URL="postgres://...neon.tech/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgres://...neon.tech/db?sslmode=require"
```

`schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## Transactions

Use `db.$transaction()` only for atomic multi-write. Don't wrap a single write in a transaction.

```ts
await db.$transaction([
  db.student.update({ where: { id, schoolId }, data: { ... } }),
  db.audit.create({ data: { ... } }),
]);
```

## Never

- `findMany()` without `select` or explicit field list
- Query a tenant-owned model without `schoolId`
- `await` inside `.map()` over a query result
- Edit a committed migration file
- Use `prisma db push` outside of `dev` against a tenant database
- Cross the pooled/direct URL boundary

## Reference

- Agent: `.claude/agents/prisma.md`
- Sweep: `/prisma` (mode: report)
- Pattern: `.claude/patterns/cards/action.md`
