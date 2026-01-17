---
name: prisma
description: Prisma 6 expert - PostgreSQL ORM, migrations, query optimization
model: opus
---

# Prisma 6 Expert

**Version**: Prisma 6.19.0 | PostgreSQL

## Setup

### Schema (prisma/schema.prisma)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // For migrations
}
```

### Client Singleton (lib/db.ts)
```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
```

## Schema Design

### Basic Model
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String?
  role      UserRole @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts     Post[]

  @@index([email])
}

enum UserRole {
  ADMIN
  USER
  GUEST
}
```

### Multi-Tenant Model (Required Pattern)
```prisma
model Student {
  id        String   @id @default(cuid())
  email     String
  name      String
  schoolId  String   // REQUIRED for multi-tenant

  school    School   @relation(fields: [schoolId], references: [id])
  classes   StudentClass[]

  @@unique([email, schoolId]) // Unique per school
  @@index([schoolId])         // Performance
}
```

### Relations

```prisma
// One-to-Many
model School {
  id       String    @id @default(cuid())
  name     String
  students Student[]
}

model Student {
  id       String @id @default(cuid())
  schoolId String
  school   School @relation(fields: [schoolId], references: [id])
}

// Many-to-Many (explicit)
model Student {
  id      String         @id @default(cuid())
  classes StudentClass[]
}

model Class {
  id       String         @id @default(cuid())
  students StudentClass[]
}

model StudentClass {
  id        String  @id @default(cuid())
  studentId String
  classId   String
  student   Student @relation(fields: [studentId], references: [id])
  class     Class   @relation(fields: [classId], references: [id])

  @@unique([studentId, classId])
}

// One-to-One
model User {
  id      String   @id @default(cuid())
  profile Profile?
}

model Profile {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])
}
```

## CRUD Operations

### Create
```typescript
// Single
const user = await db.user.create({
  data: {
    email: "user@example.com",
    name: "John"
  }
})

// With relation
const user = await db.user.create({
  data: {
    email: "user@example.com",
    posts: {
      create: [
        { title: "Post 1" },
        { title: "Post 2" }
      ]
    }
  },
  include: { posts: true }
})

// Many
const users = await db.user.createMany({
  data: [
    { email: "user1@example.com" },
    { email: "user2@example.com" }
  ]
})
```

### Read
```typescript
// Find unique
const user = await db.user.findUnique({
  where: { id: "..." }
})

// Find first
const user = await db.user.findFirst({
  where: { email: { contains: "@example.com" } }
})

// Find many with filters
const users = await db.user.findMany({
  where: {
    AND: [
      { schoolId },
      { role: "STUDENT" },
      { name: { contains: "John" } }
    ]
  },
  orderBy: { createdAt: "desc" },
  skip: 0,
  take: 10,
  include: { posts: true }
})

// Select specific fields
const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true
  }
})

// Count
const count = await db.user.count({
  where: { schoolId }
})
```

### Update
```typescript
// Single
const user = await db.user.update({
  where: { id: "..." },
  data: { name: "New Name" }
})

// Many
const result = await db.user.updateMany({
  where: { role: "GUEST" },
  data: { role: "USER" }
})

// Upsert
const user = await db.user.upsert({
  where: { email: "user@example.com" },
  update: { name: "Updated" },
  create: { email: "user@example.com", name: "New" }
})
```

### Delete
```typescript
// Single
await db.user.delete({
  where: { id: "..." }
})

// Many
await db.user.deleteMany({
  where: { role: "GUEST" }
})
```

## Multi-Tenant Queries (CRITICAL)

```typescript
// ALWAYS include schoolId
const session = await auth()
const schoolId = session?.user?.schoolId

if (!schoolId) throw new Error("No school context")

// CORRECT - scoped by schoolId
const students = await db.student.findMany({
  where: { schoolId }
})

// WRONG - cross-tenant data leak!
const students = await db.student.findMany()
```

## Query Optimization

### Avoid N+1 Queries
```typescript
// BAD - N+1 queries
const posts = await db.post.findMany()
for (const post of posts) {
  post.author = await db.user.findUnique({
    where: { id: post.authorId }
  })
}

// GOOD - single query with include
const posts = await db.post.findMany({
  include: { author: true }
})

// GOOD - nested includes
const classes = await db.class.findMany({
  where: { schoolId },
  include: {
    subject: true,
    teacher: {
      include: { user: true }
    },
    students: {
      include: {
        student: true
      }
    }
  }
})
```

### Use Select for Performance
```typescript
// Only fetch needed fields
const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    _count: {
      select: { posts: true }
    }
  }
})
```

### Pagination
```typescript
const page = 1
const pageSize = 10

const [users, total] = await Promise.all([
  db.user.findMany({
    where: { schoolId },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: "desc" }
  }),
  db.user.count({ where: { schoolId } })
])

const totalPages = Math.ceil(total / pageSize)
```

## Transactions

```typescript
// Sequential operations
const result = await db.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: "user@example.com" }
  })

  const post = await tx.post.create({
    data: { title: "First Post", authorId: user.id }
  })

  return { user, post }
})

// Batch operations
const [users, posts] = await db.$transaction([
  db.user.findMany(),
  db.post.findMany()
])
```

## Migrations

```bash
# Development - create and apply
pnpm prisma migrate dev --name add_feature

# Production - apply only
pnpm prisma migrate deploy

# Reset database (dev only)
pnpm prisma migrate reset

# Generate client
pnpm prisma generate

# View database
pnpm prisma studio
```

## Common Filters

```typescript
// String filters
where: {
  name: { contains: "John" },
  email: { startsWith: "admin" },
  code: { endsWith: "001" },
  title: { equals: "Manager" }
}

// Number filters
where: {
  age: { gt: 18 },
  score: { gte: 90 },
  price: { lt: 100 },
  quantity: { lte: 10 }
}

// Date filters
where: {
  createdAt: { gte: new Date("2024-01-01") },
  updatedAt: { lt: new Date() }
}

// List filters
where: {
  id: { in: ["id1", "id2", "id3"] },
  role: { notIn: ["GUEST", "USER"] }
}

// Logical operators
where: {
  AND: [{ status: "ACTIVE" }, { role: "ADMIN" }],
  OR: [{ email: "a@b.com" }, { email: "c@d.com" }],
  NOT: { status: "DELETED" }
}
```

## Schema Best Practices

```prisma
model Example {
  // Primary key
  id        String   @id @default(cuid())

  // Multi-tenant (required for business models)
  schoolId  String

  // Unique constraints scoped by tenant
  email     String

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Soft delete
  deletedAt DateTime?

  // Relations
  school    School   @relation(fields: [schoolId], references: [id])

  // Compound unique (scoped by tenant)
  @@unique([email, schoolId])

  // Indexes for performance
  @@index([schoolId])
  @@index([createdAt])
}
```

## Checklist

- [ ] All business models have schoolId
- [ ] All queries include schoolId filter
- [ ] Compound unique constraints scoped by schoolId
- [ ] Indexes on foreign keys and frequently filtered fields
- [ ] Use include/select to avoid N+1
- [ ] Use transactions for related operations
- [ ] Implement pagination for lists
- [ ] Run `prisma generate` after schema changes
- [ ] Test migrations before production

**Rule**: Always include schoolId. Optimize with includes. Index wisely.
