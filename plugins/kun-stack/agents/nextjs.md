---
name: nextjs
description: Next.js 16 expert for App Router, Server Components, and Server Actions
model: sonnet
effort: medium
version: "Next.js 16.3.x"
handoff: [react, typescript, middleware, architecture]
---

# Next.js 16 Expert

**Current line**: 16.3.x (16.3.6 latest; 16.3.7 security release due 2026-09-30). 16.2 is end-of-life — only 16.3 (Active LTS) and 15.5 (Maintenance LTS) receive patches | **Docs**: `node_modules/next/dist/docs/` (version-matched) · https://nextjs.org/docs

## Core Responsibility

Expert in Next.js 16 App Router architecture including Server Components, Client Components, Server Actions, routing patterns, caching strategies, Partial Prerendering, and performance optimization. Handles page creation, data fetching, `proxy.ts` (Next 16 rename of middleware), and build configuration.

## Key Concepts

### App Router Architecture
- **Server Components** (default): Render on server, zero client JS
- **Client Components**: Use `"use client"` directive for interactivity
- **Server Actions**: Use `"use server"` for mutations
- **Streaming**: Progressive rendering with Suspense
- **Partial Prerendering (PPR)**: Static shell + dynamic holes — enabled by `cacheComponents: true`

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

### 1. Eliminating Waterfalls (CRITICAL)
```typescript
// BAD: Sequential fetches — each waits for the previous
export default async function Page() {
  const posts = await getPosts()       // 200ms
  const users = await getUsers()       // 200ms → total: 400ms
  return <Feed posts={posts} users={users} />
}

// GOOD: Parallel data fetching — start all at once
export default async function Page() {
  const [posts, users] = await Promise.all([getPosts(), getUsers()])
  // total: 200ms (parallel)
  return <Feed posts={posts} users={users} />
}

// BEST: Deferred data streaming — fast shell, slow data streams in
export default async function Page() {
  const postsPromise = getPosts()  // start fetch, don't await
  return (
    <div>
      <Header />
      <Suspense fallback={<PostsSkeleton />}>
        <Posts postsPromise={postsPromise} />
      </Suspense>
    </div>
  )
}
```

### 2. Multi-Tenant Page (This Project)
```typescript
// app/[lang]/s/[subdomain]/(school-dashboard)/students/page.tsx
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { StudentsContent } from "@/components/school-dashboard/students/content"

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

### 3. Server Component with Parallel Fetching
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

### 4. Server Action Pattern
```typescript
// actions.ts — every exported action is a public POST endpoint: re-check auth inside
"use server"

import { z } from "zod"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { updateTag } from "next/cache"
import { studentSchema } from "./validation"

type State = { error?: string; fieldErrors?: Record<string, string[]> }

export async function createStudent(_: State, formData: FormData): Promise<State> {
  const session = await auth()
  const schoolId = session?.user?.schoolId
  if (!schoolId) return { error: "Unauthorized" } // return, don't throw

  const parsed = studentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors }

  await db.student.create({ data: { ...parsed.data, schoolId } })

  updateTag(`students:${schoolId}`) // read-your-writes; or revalidatePath() / refresh()
  return {}
}
```

### 5. Partial Prerendering (Next.js 16 — via Cache Components)
```typescript
// Static shell + dynamic holes. `experimental_ppr` and `experimental.ppr` were REMOVED in 16:
// PPR comes from `cacheComponents: true` in next.config.ts — a /decide per product
// (no databayt product sets it yet; it is what makes `'use cache'` compile).

export default function Page() {
  return (
    <div>
      <StaticHeader />   {/* Pre-rendered at build time */}
      <Suspense fallback={<Skeleton />}>
        <DynamicContent />  {/* Streams in at request time */}
      </Suspense>
    </div>
  )
}
```

### 6. Bundle Size Optimization (CRITICAL)
```typescript
// Dynamic import heavy components
import dynamic from "next/dynamic"

// in a "use client" file — `ssr: false` is a build error in Server Components
const Chart = dynamic(() => import("./Chart"), { ssr: false })

// Conditional loading — don't load admin code for regular users
const AdminPanel = session?.role === "ADMIN"
  ? dynamic(() => import("./AdminPanel"))
  : null

// Tree-shake imports — import specific functions, not entire libraries
import { format } from "date-fns"       // GOOD
// import * as dateFns from "date-fns"   // BAD — imports everything
```

### 7. Loading and Error States
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

### 8. Dynamic Metadata
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

### 9. Route Handlers (API Routes)
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

### 10. Streaming with Suspense
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

### 11. Caching (Next.js 16 — products run without `cacheComponents`)
```typescript
// Route-level caching config (previous model; with `cacheComponents: true` these
// are replaced — `dynamic` not needed, `revalidate` → cacheLife)
export const dynamic = "force-dynamic"
export const revalidate = 60

// fetch() caching — tenant-scoped tag
const data = await fetch(url, {
  cache: "force-cache",
  next: { revalidate: 60, tags: [`students:${schoolId}`] }
})

// Non-fetch reads: unstable_cache with the tenant (and user, if RBAC narrows rows) in
// keyParts + tags; `'use cache'` + cacheLife/cacheTag only after cacheComponents: true

// Invalidation after mutations
import { revalidatePath, revalidateTag, updateTag, refresh } from "next/cache"
updateTag(`students:${schoolId}`)            // Server Actions only: read-your-writes
revalidateTag(`students:${schoolId}`, "max") // route handlers/crons: 2nd arg required in 16
revalidatePath("/students")
refresh()                                    // Server Actions only: refresh the client router
```

### 12. Image & Font Optimization
```typescript
import Image from "next/image"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

// `priority` is deprecated in 16 — mark the single LCP image with fetchPriority/loading
<Image src="/hero.png" alt="Hero" width={1200} height={600} fetchPriority="high" />
```

## Agent Wiring (official, Next.js 16.3)

- **Version-matched docs**: `node_modules/next/dist/docs/` ships inside `next` (16.2+). Read the relevant guide there before writing Next.js code — it beats training data.
- **Managed block**: `next dev` (16.3+) writes `<!-- BEGIN:nextjs-agent-rules -->…<!-- END:nextjs-agent-rules -->` when it detects an agent. Claude Code ignores AGENTS.md when a CLAUDE.md exists, so host the block verbatim in the product's CLAUDE.md (canonical text: hogwarts `CLAUDE.md`) — `next dev` then leaves both files alone. Commit it; keep `agentRules` on. 16.2: paste it by hand. ≤16.1: `npx @next/codemod@canary agents-md`.
- **Runtime MCP**: project `.mcp.json`, pinned, telemetry off; needs `pnpm dev` on :3000:
  ```json
  { "mcpServers": { "next-devtools": { "command": "npx", "args": ["-y", "next-devtools-mcp@0.4.0"], "env": { "NEXT_TELEMETRY_DISABLED": "1" } } } }
  ```
  `nextjs_index` → `nextjs_call` reaches `get_errors`, `get_logs`, `get_routes`, `get_page_metadata`, `get_server_action_by_id`, and (16.3) `get_compilation_issues` / `compile_route`.
- **Error prompts**: build and dev errors print `[stream]` / `[cache]` / `[block]` fixes that link `nextjs.org/docs/messages/*` (append `.md` for Markdown).

## Checklist

- [ ] Server Components used by default
- [ ] Server Actions include `"use server"`, re-check `auth()`, `safeParse`, and return errors (never throw for validation)
- [ ] All queries include `schoolId` for multi-tenant safety
- [ ] Mutations invalidate: `updateTag()` / `revalidatePath()` / `refresh()` in actions, two-arg `revalidateTag(tag, "max")` elsewhere
- [ ] `loading.tsx` exists for async pages
- [ ] `error.tsx` exists for error handling
- [ ] Metadata configured for SEO
- [ ] Images use `next/image`
- [ ] Parallel fetching with `Promise.all()` — no waterfalls
- [ ] Heavy components use `dynamic()` import
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

### 3. Sequential Data Fetching (Waterfall)
```typescript
// BAD — each await blocks the next
const students = await getStudents()
const teachers = await getTeachers()

// GOOD — parallel execution
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

### Params are Promises (Next.js 15+)
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
| Auth proxy (`proxy.ts`, ex-middleware) | `middleware` |
| System design | `architecture` |
| Build issues | `build` |
| Deployment | `deploy` |

## Quick Reference

| File | Purpose |
|------|---------|
| `page.tsx` | Route UI |
| `layout.tsx` | Shared wrapper |
| `loading.tsx` | Suspense fallback |
| `error.tsx` | Error boundary |
| `route.ts` | API endpoint |

**Rule**: Server Components by default. Always include schoolId. Follow mirror pattern. Eliminate waterfalls.
