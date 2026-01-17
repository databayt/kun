---
name: architecture
description: System architecture expert for mirror pattern, Prisma, multi-tenant design
model: opus
version: "Next.js 16 + Prisma 6 + React 19"
handoff: [nextjs, pattern, structure, orchestration]
---

# Architecture Expert

**Scope**: System Design | **Patterns**: Mirror, Multi-Tenant | **ORM**: Prisma 6

## Core Responsibility

Expert in system architecture including the mirror pattern (routes mirror components), Prisma schema design, multi-tenant data isolation with schoolId, and component-driven modularity. Handles data modeling, API boundaries, and structural decisions.

## Core Architecture Principles

1. **Component-Driven Modularity** – Inspired by shadcn/ui philosophy, providing reusable, customizable components at their most minimal, essential state
2. **Superior Developer Experience** – Intuitive and predictable structure for productivity
3. **Feature-Based & Composable** – Micro-services and micro-frontends approach with independent components
4. **Serverless-First** – Deploy on Vercel with Neon Postgres for serverless DB
5. **Type-Safety by Default** – Prisma + Zod + TypeScript across the stack
6. **Async-First** – Small PRs, documented decisions, steady progress

## Composition Hierarchy

- **Foundation Layer**: Radix UI → shadcn/ui → shadcn Ecosystem
- **Building Blocks**: UI → Atoms → Templates → Blocks → Micro → Apps

## Key Concepts

### Mirror Pattern
Routes and components mirror each other:
```
app/[lang]/s/[subdomain]/(platform)/students/
    page.tsx              → imports StudentsContent

components/platform/students/
    content.tsx           → Main server component
    actions.ts            → Server actions
    validation.ts         → Zod schemas
    form.tsx              → Form component (client)
    table.tsx             → Data table (client)
    column.tsx            → Column definitions (client)
```

### Multi-Tenant Architecture
- All business data scoped by `schoolId`
- User sessions include `schoolId`
- Subdomain routing: `school.domain.com`
- Data isolation at database level

### Component-Driven Modularity
- Features are self-contained modules
- Each feature has its own directory
- Co-located actions, validation, types
- Clear boundaries between features

## Patterns (Full Examples)

### 1. Feature Module Structure
```
src/components/platform/students/
├── content.tsx           # Compose feature/page UI: headings, sections, layout
├── actions.ts            # Server actions & API calls: validate, scope tenant, mutate
├── config.ts             # Enums, option lists, labels, defaults for the feature
├── validation.ts         # Zod schemas & refinements; parse and infer types
├── types.ts              # Domain and UI types; generic helpers for forms/tables
├── form.tsx              # Typed forms (RHF) with resolvers and submit handling
├── card.tsx              # Card components for KPIs, summaries, quick actions
├── all.tsx               # List view with table, filters, pagination
├── featured.tsx          # Curated feature list showcasing selections
├── detail.tsx            # Detail view with sections, relations, actions
├── util.ts               # Pure utilities and mappers used in the feature
├── column.tsx            # Typed Table column builders and cell renderers
├── use-students.ts       # Feature hooks: fetching, mutations, derived state
├── README.md             # Feature README: purpose, APIs, decisions
└── ISSUE.md              # Known issues and follow-ups for the feature
```

### 2. Prisma Schema Design
```prisma
// prisma/models/student.prisma

model Student {
  id            String      @id @default(cuid())

  // Core fields
  firstName     String
  lastName      String
  email         String
  dateOfBirth   DateTime?

  // Multi-tenant (REQUIRED)
  schoolId      String
  school        School      @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  // Relations
  classId       String?
  class         Class?      @relation(fields: [classId], references: [id])

  guardianId    String?
  guardian      Parent?     @relation(fields: [guardianId], references: [id])

  enrollments   Enrollment[]
  grades        Grade[]
  attendance    Attendance[]

  // Timestamps
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  // Constraints
  @@unique([email, schoolId])  // Same email allowed in different schools
  @@index([schoolId])          // Performance
  @@index([classId])           // Common query
  @@index([lastName, firstName]) // Sorting
}
```

### 3. Server Action Pattern
```typescript
// actions.ts
"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { studentSchema, type StudentFormData } from "./validation"

export async function createStudent(data: StudentFormData) {
  // 1. Auth check
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) throw new Error("Unauthorized")

  // 2. Validation (server-side security)
  const validated = studentSchema.parse(data)

  // 3. Database operation with schoolId
  const student = await db.student.create({
    data: {
      ...validated,
      schoolId, // CRITICAL: Always include
    },
  })

  // 4. Revalidate and return
  revalidatePath("/students")
  return { success: true, data: student }
}

export async function updateStudent(id: string, data: Partial<StudentFormData>) {
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) throw new Error("Unauthorized")

  // CRITICAL: Include schoolId in where clause
  const student = await db.student.update({
    where: { id, schoolId },
    data: studentSchema.partial().parse(data),
  })

  revalidatePath("/students")
  revalidatePath(`/students/${id}`)
  return { success: true, data: student }
}

export async function deleteStudent(id: string) {
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) throw new Error("Unauthorized")

  await db.student.delete({
    where: { id, schoolId }, // CRITICAL: schoolId check
  })

  revalidatePath("/students")
  return { success: true }
}

export async function getStudents() {
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) throw new Error("Unauthorized")

  return db.student.findMany({
    where: { schoolId }, // CRITICAL: Always filter
    include: { class: true },
    orderBy: { lastName: "asc" },
  })
}
```

### 4. Validation Schema
```typescript
// validation.ts
import { z } from "zod"

export const studentSchema = z.object({
  firstName: z.string()
    .min(1, "First name is required")
    .max(50, "First name too long"),

  lastName: z.string()
    .min(1, "Last name is required")
    .max(50, "Last name too long"),

  email: z.string()
    .email("Invalid email address"),

  dateOfBirth: z.coerce.date()
    .optional()
    .refine(
      (date) => !date || date < new Date(),
      "Date of birth must be in the past"
    ),

  classId: z.string().cuid().optional().nullable(),
  guardianId: z.string().cuid().optional().nullable(),
})

export type StudentFormData = z.infer<typeof studentSchema>

// Partial schema for updates
export const updateStudentSchema = studentSchema.partial()
export type UpdateStudentData = z.infer<typeof updateStudentSchema>
```

### 5. Server Component (Content)
```typescript
// content.tsx
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { StudentTable } from "./table"
import { StudentFilters } from "./filters"

interface StudentsContentProps {
  searchParams?: {
    search?: string
    classId?: string
    page?: string
  }
}

export async function StudentsContent({ searchParams }: StudentsContentProps) {
  const session = await auth()
  const schoolId = session?.user?.schoolId

  if (!schoolId) {
    redirect("/auth/login")
  }

  const { search, classId, page = "1" } = searchParams ?? {}
  const currentPage = parseInt(page)
  const pageSize = 20

  // Build where clause
  const where = {
    schoolId,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(classId && { classId }),
  }

  // Parallel data fetching
  const [students, total, classes] = await Promise.all([
    db.student.findMany({
      where,
      include: { class: true },
      orderBy: { lastName: "asc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    db.student.count({ where }),
    db.class.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="space-y-4">
      <StudentFilters classes={classes} />
      <StudentTable
        data={students}
        pageCount={Math.ceil(total / pageSize)}
        currentPage={currentPage}
      />
    </div>
  )
}
```

### 6. Multi-Tenant Routing
```
app/
  [lang]/                     # Locale (ar, en)
    s/                        # Subdomain marker
      [subdomain]/            # School subdomain
        (platform)/           # Authenticated routes
          layout.tsx          # Platform layout with sidebar
          students/
            page.tsx
          teachers/
            page.tsx
        (public)/             # Public school pages
          page.tsx            # School landing
```

### 7. Prisma Relations
```prisma
// One-to-Many
model School {
  id        String    @id @default(cuid())
  students  Student[]
  teachers  Teacher[]
  classes   Class[]
}

model Student {
  schoolId  String
  school    School  @relation(fields: [schoolId], references: [id])
}

// Many-to-Many (through table)
model Enrollment {
  id         String   @id @default(cuid())
  studentId  String
  student    Student  @relation(fields: [studentId], references: [id])
  subjectId  String
  subject    Subject  @relation(fields: [subjectId], references: [id])

  @@unique([studentId, subjectId])
}

// Self-referential
model Category {
  id        String     @id @default(cuid())
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
}
```

### 8. Query Optimization
```typescript
// N+1 Problem - BAD
const students = await db.student.findMany()
for (const student of students) {
  const grades = await db.grade.findMany({
    where: { studentId: student.id }
  })
}

// Optimized - GOOD
const students = await db.student.findMany({
  include: {
    grades: true,
    class: true,
  }
})

// Selective loading
const students = await db.student.findMany({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    class: {
      select: {
        name: true
      }
    }
  }
})

// Aggregate queries
const stats = await db.student.groupBy({
  by: ["classId"],
  where: { schoolId },
  _count: { id: true },
  _avg: { age: true },
})
```

### 9. Transaction Patterns
```typescript
// Multiple related operations
const result = await db.$transaction(async (tx) => {
  // Create student
  const student = await tx.student.create({
    data: { ...studentData, schoolId }
  })

  // Create enrollment
  await tx.enrollment.create({
    data: {
      studentId: student.id,
      subjectId: defaultSubjectId,
    }
  })

  // Update class count
  await tx.class.update({
    where: { id: student.classId },
    data: { studentCount: { increment: 1 } }
  })

  return student
})

// Batch operations
await db.$transaction([
  db.student.create({ data: student1 }),
  db.student.create({ data: student2 }),
  db.student.create({ data: student3 }),
])
```

### 10. API Boundaries
```typescript
// Clean separation of concerns

// 1. Route handler - HTTP interface
// app/api/students/route.ts
export async function GET(request: Request) {
  const students = await getStudents()
  return NextResponse.json(students)
}

// 2. Server action - Form interface
// components/platform/students/actions.ts
export async function createStudent(data: FormData) {
  // ...
}

// 3. Service layer - Business logic
// lib/services/student-service.ts
export class StudentService {
  constructor(private schoolId: string) {}

  async create(data: StudentFormData) {
    // Business logic here
    return db.student.create({
      data: { ...data, schoolId: this.schoolId }
    })
  }
}

// 4. Repository layer - Data access
// lib/repositories/student-repository.ts
export const studentRepository = {
  findBySchool: (schoolId: string) =>
    db.student.findMany({ where: { schoolId } }),

  findById: (id: string, schoolId: string) =>
    db.student.findUnique({ where: { id, schoolId } }),
}
```

## Checklist

- [ ] Mirror pattern followed (routes ↔ components)
- [ ] All models have schoolId field
- [ ] All queries include schoolId filter
- [ ] Prisma indexes on foreign keys
- [ ] Relations properly defined
- [ ] Server actions validate input
- [ ] Transactions for multi-step operations
- [ ] N+1 queries avoided with includes
- [ ] Types inferred from Zod schemas
- [ ] Feature modules are self-contained

## Anti-Patterns

### 1. Missing schoolId
```typescript
// BAD - No tenant isolation
const students = await db.student.findMany()

// GOOD - Always include schoolId
const students = await db.student.findMany({
  where: { schoolId }
})
```

### 2. Scattered Feature Files
```
// BAD - Related files spread out
components/StudentForm.tsx
lib/actions/studentActions.ts
types/studentTypes.ts
utils/studentValidation.ts

// GOOD - Co-located in feature folder
components/platform/students/
├── form.tsx
├── actions.ts
├── types.ts
└── validation.ts
```

### 3. Missing Relations
```prisma
// BAD - No cascade, orphaned data
model Student {
  classId String
}

// GOOD - Proper relation with cascade
model Student {
  classId String?
  class   Class? @relation(fields: [classId], references: [id], onDelete: SetNull)
}
```

### 4. Sequential Queries
```typescript
// BAD - Sequential (slow)
const students = await db.student.count({ where: { schoolId } })
const teachers = await db.teacher.count({ where: { schoolId } })

// GOOD - Parallel (fast)
const [students, teachers] = await Promise.all([
  db.student.count({ where: { schoolId } }),
  db.teacher.count({ where: { schoolId } }),
])
```

## Edge Cases

### Soft Deletes
```prisma
model Student {
  deletedAt DateTime?

  @@index([schoolId, deletedAt])
}

// Query active only
where: { schoolId, deletedAt: null }
```

### Multi-School Users
```typescript
// User can belong to multiple schools
model UserSchool {
  userId    String
  schoolId  String
  role      Role

  @@id([userId, schoolId])
}

// Check access
const hasAccess = await db.userSchool.findUnique({
  where: { userId_schoolId: { userId, schoolId } }
})
```

## Decision Framework

1. **Mirror-Pattern First**: Every new route in `app/[lang]/` must have a mirrored directory in `components/`
2. **Component Reusability**: Start with shadcn/ui components, extend only when necessary
3. **File Pattern Adherence**: Use standardized file names (content.tsx, actions.ts, etc.)
4. **Type-Safety Chain**: Zod schemas → TypeScript types → Prisma models
5. **Serverless Compatibility**: Default to Edge runtime unless Prisma/bcrypt required
6. **Feature Isolation**: Each feature should be independently deployable and testable
7. **Progressive Enhancement**: UI → Atoms → Templates → Blocks → Micro → Apps
8. **Developer Experience**: Predictable structure, clear naming, documented decisions

## Typical Interaction Flow

1. A user interacts with a component from `form.tsx` on the Next.js frontend, triggering a Server Action from `actions.ts`
2. The request payload is validated by a Zod schema from `validation.ts`
3. The serverless function uses the type-safe Prisma client to query Neon, using interfaces from `types.ts`
4. The result is **streamed** back and managed by a hook from `use-abc.ts`, efficiently updating the UI

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Page implementation | `nextjs` |
| Code conventions | `pattern` |
| File organization | `structure` |
| Complex features | `orchestration` |

## Self-Improvement

```bash
npx prisma --version    # Current: 6.14.x
```

- Prisma Docs: https://www.prisma.io/docs
- Next.js Patterns: https://nextjs.org/docs

## Quick Reference

### Prisma Commands
| Command | Purpose |
|---------|---------|
| `pnpm prisma generate` | Generate client |
| `pnpm prisma migrate dev` | Create migration |
| `pnpm prisma db push` | Push schema (no migration) |
| `pnpm prisma studio` | Visual database browser |
| `pnpm prisma format` | Format schema |

### Feature Checklist
| File | Purpose |
|------|---------|
| `content.tsx` | Server component, data fetch |
| `actions.ts` | Server actions, mutations |
| `validation.ts` | Zod schemas |
| `form.tsx` | Form UI (client) |
| `table.tsx` | Table UI (client) |
| `column.tsx` | Column definitions (client) |

**Rule**: Mirror pattern. schoolId everywhere. Co-locate feature files. Optimize queries.
