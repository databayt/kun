---
name: hogwarts
description: Education SaaS reference - multi-tenant, LMS, SIS, billing patterns
model: opus
version: "Next.js 16 + Prisma 6 + Stripe"
handoff: [architecture, prisma, authjs, stripe]
---

# Hogwarts Reference Agent

**Scope**: Education SaaS | **Patterns**: Multi-Tenant, LMS, Billing | **Repo**: databayt/hogwarts

## When to Use

Trigger when user says:
- `like hogwarts`
- `auth like hogwarts`
- `billing like hogwarts`
- `multi-tenant`
- `school management`
- `LMS` or `SIS`

## Repository Info

| Field | Value |
|-------|-------|
| **URL** | https://github.com/databayt/hogwarts |
| **Stack** | Next.js 16, Prisma 6, NextAuth v5, Stripe |
| **Local** | /Users/abdout/oss/hogwarts (if cloned) |

## Core Patterns

### 1. Multi-Tenant Architecture

```typescript
// Every model has schoolId
model Student {
  id        String   @id @default(cuid())
  schoolId  String
  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@unique([email, schoolId])
}

// Every query filters by schoolId
const students = await db.student.findMany({
  where: { schoolId: session.user.schoolId }
})
```

### 2. Subdomain Routing

```
app/
  [lang]/
    s/
      [subdomain]/           # School subdomain
        (platform)/          # Authenticated routes
          layout.tsx         # Platform layout with sidebar
          students/
          teachers/
          classes/
        (public)/            # Public school pages
          page.tsx           # School landing page
```

### 3. Role-Based Access Control

```typescript
// User roles per school
model UserSchool {
  userId    String
  schoolId  String
  role      SchoolRole  // OWNER, ADMIN, TEACHER, STUDENT, PARENT

  @@id([userId, schoolId])
}

// Check permissions
const canEdit = await checkPermission(userId, schoolId, "students:write")
```

### 4. Stripe Billing Integration

```typescript
// Subscription per school
model Subscription {
  id        String   @id @default(cuid())
  schoolId  String   @unique
  stripeId  String   @unique
  status    SubscriptionStatus
  plan      Plan

  school    School   @relation(fields: [schoolId], references: [id])
}

// Usage-based billing
const studentCount = await db.student.count({ where: { schoolId } })
await stripe.subscriptionItems.createUsageRecord(itemId, {
  quantity: studentCount,
  timestamp: Math.floor(Date.now() / 1000),
})
```

### 5. LMS Patterns

```prisma
model Course {
  id          String   @id @default(cuid())
  schoolId    String
  title       String
  description String?

  modules     Module[]
  enrollments CourseEnrollment[]
}

model Module {
  id       String   @id @default(cuid())
  courseId String
  title    String
  order    Int

  lessons  Lesson[]
  course   Course   @relation(fields: [courseId], references: [id])
}

model Lesson {
  id       String   @id @default(cuid())
  moduleId String
  title    String
  content  String?  // MDX content
  videoUrl String?
  order    Int

  progress LessonProgress[]
}
```

### 6. SIS (Student Information System)

```prisma
model Student {
  id           String   @id @default(cuid())
  schoolId     String
  firstName    String
  lastName     String
  dateOfBirth  DateTime?

  // Relations
  classId      String?
  class        Class?     @relation(fields: [classId], references: [id])
  guardianId   String?
  guardian     Parent?    @relation(fields: [guardianId], references: [id])

  enrollments  Enrollment[]
  grades       Grade[]
  attendance   Attendance[]
}
```

## Reference Checklist

When implementing features "like hogwarts":

- [ ] All models have `schoolId` field
- [ ] Unique constraints include `schoolId` (e.g., `@@unique([email, schoolId])`)
- [ ] Subdomain routing with `[subdomain]` parameter
- [ ] Role-based permissions per school
- [ ] Stripe subscription tied to school
- [ ] Usage-based billing for students/teachers count

## Files to Reference

| Pattern | Path in hogwarts |
|---------|------------------|
| Auth config | `src/auth.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Middleware | `src/middleware.ts` |
| Stripe webhooks | `src/app/api/webhooks/stripe/route.ts` |
| Platform layout | `src/app/[lang]/s/[subdomain]/(platform)/layout.tsx` |
| Student CRUD | `src/components/platform/students/` |

## Access Commands

```bash
# Clone locally
git clone https://github.com/databayt/hogwarts ~/oss/hogwarts

# Reference via MCP
mcp__github__get_file_contents(owner="databayt", repo="hogwarts", path="src/auth.ts")
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Database schema | `prisma` |
| Auth implementation | `authjs` |
| Billing setup | `stripe` (if available) |
| Architecture questions | `architecture` |
