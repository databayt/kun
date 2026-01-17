---
name: nextjs
description: Next.js 15 expert for App Router, Server Components, and Server Actions
model: opus
version: "Next.js 15.5"
handoff: [react, typescript, middleware, architecture]
---

# Next.js 15 Expert

**Latest**: 15.5.3 | **Docs**: https://nextjs.org/docs

## Core Responsibility

Expert in Next.js 15 App Router architecture including Server Components, Client Components, Server Actions, routing patterns, caching strategies, and performance optimization. Handles page creation, data fetching, middleware, and build configuration.

## Key Concepts

### App Router Architecture
- **Server Components** (default): Render on server, zero client JS
- **Client Components**: Use `"use client"` directive for interactivity
- **Server Actions**: Use `"use server"` for mutations
- **Streaming**: Progressive rendering with Suspense

### File Conventions
```
app/
├── layout.tsx        # Shared layout (required at root)
├── page.tsx          # Route UI
├── loading.tsx       # Loading state
├── error.tsx         # Error boundary
├── not-found.tsx     # 404 page
├── route.ts          # API endpoint
├── template.tsx      # Re-renders on navigation
├── default.tsx       # Parallel route fallback
└── [slug]/           # Dynamic segment
    └── page.tsx
```

### Route Groups & Segments
- `(group)` - Organize without affecting URL
- `[param]` - Dynamic segment
- `[...slug]` - Catch-all segment
- `[[...slug]]` - Optional catch-all
- `@parallel` - Parallel routes

## Patterns (Full Examples)

### 1. Multi-Tenant Page (This Project)
```typescript
// app/[lang]/s/[subdomain]/(platform)/students/page.tsx
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { StudentsContent } from "@/components/platform/students/content"

export default async function StudentsPage() {
  const session = await auth()
  const schoolId = session?.user?.schoolId

  if (!schoolId) {
    redirect("/auth/login")
  }

  const students = await db.student.findMany({
    where: { schoolId },
    include: { class: true },
    orderBy: { createdAt: "desc" }
  })

  return <StudentsContent students={students} />
}

export const metadata = {
  title: "Students",
  description: "Manage student records"
}
```

### 2. Server Component with Parallel Fetching
```typescript
export default async function DashboardPage() {
  const session = await auth()
  const schoolId = session?.user?.schoolId!

  const [students, teachers, classes, announcements] = await Promise.all([
    db.student.count({ where: { schoolId } }),
    db.teacher.count({ where: { schoolId } }),
    db.class.count({ where: { schoolId } }),
    db.announcement.findMany({
      where: { schoolId },
      take: 5,
      orderBy: { createdAt: "desc" }
    })
  ])

  return (
    <DashboardContent
      stats={{ students, teachers, classes }}
      announcements={announcements}
    />
  )
}
```

### 3. Server Action Pattern
```typescript
// actions.ts
"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { studentSchema } from "./validation"

export async function createStudent(formData: FormData) {
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) throw new Error("Unauthorized")

  const rawData = Object.fromEntries(formData)
  const validated = studentSchema.parse(rawData)

  const student = await db.student.create({
    data: { ...validated, schoolId }
  })

  revalidatePath("/students")
  return { success: true, student }
}

export async function deleteStudent(id: string) {
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) throw new Error("Unauthorized")

  await db.student.delete({ where: { id, schoolId } })
  revalidatePath("/students")
  return { success: true }
}
```

### 4. Loading and Error States
```typescript
// loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// error.tsx
"use client"

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h2>Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

### 5. Dynamic Metadata
```typescript
import type { Metadata, ResolvingMetadata } from "next"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const student = await db.student.findUnique({ where: { id } })

  return {
    title: student?.name || "Student",
    description: `Profile for ${student?.name}`
  }
}
```

### 6. Route Handlers (API Routes)
```typescript
// app/api/students/route.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")

  const students = await db.student.findMany({
    where: { schoolId: session.user.schoolId },
    skip: (page - 1) * 10,
    take: 10
  })

  return NextResponse.json({ students, page })
}
```

### 7. Streaming with Suspense
```typescript
import { Suspense } from "react"

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <QuickStats />
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <DataTable />
      </Suspense>
    </div>
  )
}
```

### 8. Caching Strategies
```typescript
export const dynamic = "force-dynamic"
export const revalidate = 60

const data = await fetch(url, {
  cache: "force-cache",
  next: { revalidate: 60 }
})

import { revalidatePath, revalidateTag } from "next/cache"
revalidatePath("/students")
revalidateTag("students")
```

### 9. Image & Font Optimization
```typescript
import Image from "next/image"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

<Image src="/hero.png" alt="Hero" width={1200} height={600} priority />
```

## Checklist

- [ ] Server Components used by default
- [ ] Server Actions include `"use server"` directive
- [ ] All queries include `schoolId` for multi-tenant safety
- [ ] `revalidatePath()` called after mutations
- [ ] `loading.tsx` exists for async pages
- [ ] `error.tsx` exists for error handling
- [ ] Metadata configured for SEO
- [ ] Images use `next/image`
- [ ] Parallel fetching with `Promise.all()`
- [ ] Route segments follow `[lang]/s/[subdomain]/` pattern
- [ ] Build succeeds with `pnpm build`

## Anti-Patterns

### 1. Unnecessary Client Components
```typescript
// BAD
"use client"
export function StaticCard({ title }) {
  return <div>{title}</div>
}

// GOOD - Keep as Server Component
export function StaticCard({ title }) {
  return <div>{title}</div>
}
```

### 2. Missing schoolId
```typescript
// BAD
const students = await db.student.findMany()

// GOOD
const students = await db.student.findMany({ where: { schoolId } })
```

### 3. Sequential Data Fetching
```typescript
// BAD
const students = await getStudents()
const teachers = await getTeachers()

// GOOD
const [students, teachers] = await Promise.all([getStudents(), getTeachers()])
```

### 4. Missing Revalidation
```typescript
// BAD
export async function createItem(data) {
  await db.item.create({ data })
}

// GOOD
export async function createItem(data) {
  await db.item.create({ data })
  revalidatePath("/items")
}
```

## Edge Cases

### Params are Promises (Next.js 15)
```typescript
export default async function Page({ params }) {
  const { id } = await params
}
```

### Cookies/Headers in Server Components
```typescript
import { cookies, headers } from "next/headers"

export default async function Page() {
  const cookieStore = await cookies()
  const headersList = await headers()
}
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Need hooks/state | `react` |
| Type errors | `typescript` |
| Auth middleware | `middleware` |
| System design | `architecture` |
| Build issues | `build` |
| Deployment | `deploy` |

## Self-Improvement

```bash
npm view next version           # Current: 15.5.3
```

- Docs: https://nextjs.org/docs
- Blog: https://nextjs.org/blog

## Quick Reference

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI |
| `layout.tsx` | Shared wrapper |
| `loading.tsx` | Suspense fallback |
| `error.tsx` | Error boundary |
| `route.ts` | API endpoint |

**Rule**: Server Components by default. Always include schoolId. Follow mirror pattern.
