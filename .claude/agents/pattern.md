---
name: pattern
description: Code conventions expert for patterns, anti-patterns, and best practices
model: opus
version: "Project Standards"
handoff: [architecture, structure, typescript]
---

# Pattern Expert

**Scope**: Code Conventions | **Focus**: Patterns & Anti-Patterns | **Standards**: Project-wide

## Core Responsibility

Expert in code conventions, design patterns, anti-patterns, and best practices. Ensures consistency across the codebase, identifies problematic patterns, and recommends solutions following established project standards.

## Key Concepts

### Pattern Categories
1. **Component Patterns** - React component design
2. **Data Patterns** - Fetching, caching, mutations
3. **State Patterns** - State management approaches
4. **Error Patterns** - Error handling strategies
5. **Security Patterns** - Authentication, authorization

### Anti-Pattern Detection
- Code smells that indicate problems
- Performance bottlenecks
- Security vulnerabilities
- Maintainability issues

## Patterns (Full Examples)

### 1. Server/Client Component Pattern
```typescript
// PATTERN: Server Component (default)
// Use for: Data fetching, no interactivity
async function StudentList() {
  const students = await getStudents()
  return <StudentTable data={students} />
}

// PATTERN: Client Component
// Use for: Interactivity, hooks, event handlers
"use client"
function StudentForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  return <form>...</form>
}

// ANTI-PATTERN: Unnecessary client directive
"use client"  // ❌ Not needed for static display
function StaticCard({ title }) {
  return <div>{title}</div>
}

// ANTI-PATTERN: Data fetching in client
"use client"
function StudentList() {
  const [students, setStudents] = useState([])
  useEffect(() => {
    fetch('/api/students').then(...)  // ❌ Use server component
  }, [])
}
```

### 2. Server Action Pattern
```typescript
// PATTERN: Complete server action
"use server"

export async function createStudent(formData: FormData) {
  // 1. Authentication
  const session = await auth()
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized")
  }

  // 2. Validation
  const validated = studentSchema.safeParse(
    Object.fromEntries(formData)
  )
  if (!validated.success) {
    return { error: validated.error.flatten() }
  }

  // 3. Business logic
  try {
    const student = await db.student.create({
      data: { ...validated.data, schoolId: session.user.schoolId }
    })

    // 4. Cache invalidation
    revalidatePath("/students")

    return { success: true, data: student }
  } catch (error) {
    return { error: "Failed to create student" }
  }
}

// ANTI-PATTERN: Missing validation
"use server"
export async function createStudent(data: any) {
  await db.student.create({ data })  // ❌ No validation
}

// ANTI-PATTERN: Missing auth
"use server"
export async function deleteStudent(id: string) {
  await db.student.delete({ where: { id } })  // ❌ No auth check
}

// ANTI-PATTERN: Missing revalidation
"use server"
export async function updateStudent(data) {
  await db.student.update(...)  // ❌ No revalidatePath
}
```

### 3. Form Handling Pattern
```typescript
// PATTERN: React Hook Form + Zod + Server Action
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTransition } from "react"
import { studentSchema } from "./validation"
import { createStudent } from "./actions"

export function StudentForm() {
  const [isPending, startTransition] = useTransition()

  const form = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", email: "" }
  })

  const onSubmit = (data) => {
    startTransition(async () => {
      const result = await createStudent(data)
      if (result.error) {
        // Handle errors
        toast.error(result.error)
      } else {
        toast.success("Created!")
        form.reset()
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Fields */}
        <Button disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  )
}

// ANTI-PATTERN: Uncontrolled form
function BadForm() {
  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = new FormData(e.target)  // ❌ No validation
    await createStudent(data)
  }
}
```

### 4. Data Fetching Pattern
```typescript
// PATTERN: Parallel fetching in server components
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
    }),
  ])

  return <Dashboard stats={{ students, teachers, classes }} />
}

// ANTI-PATTERN: Sequential fetching (waterfall)
export default async function DashboardPage() {
  const students = await db.student.count()  // Wait...
  const teachers = await db.teacher.count()  // Wait...
  const classes = await db.class.count()     // Wait...
  // ❌ 3x slower than parallel
}

// PATTERN: Streaming with Suspense
export default function DashboardPage() {
  return (
    <div>
      <QuickStats />  {/* Renders immediately */}
      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart />  {/* Streams when ready */}
      </Suspense>
    </div>
  )
}
```

### 5. Error Handling Pattern
```typescript
// PATTERN: error.tsx boundary
"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting service
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}

// PATTERN: Try-catch in server actions
export async function createStudent(data) {
  try {
    const student = await db.student.create({ data })
    return { success: true, data: student }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { error: "Email already exists" }
      }
    }
    return { error: "Something went wrong" }
  }
}

// ANTI-PATTERN: Swallowing errors
try {
  await riskyOperation()
} catch (e) {
  // ❌ Silent failure
}

// ANTI-PATTERN: Exposing internal errors
catch (error) {
  return { error: error.message }  // ❌ May expose sensitive info
}
```

### 6. Column Definition Pattern
```typescript
// PATTERN: Columns in client component with useMemo
"use client"

import { useMemo } from "react"
import { useModal } from "@/hooks/use-modal"

export function StudentTable({ data, dictionary }) {
  const { open } = useModal()

  const columns = useMemo(() => [
    {
      accessorKey: "name",
      header: dictionary?.table?.name ?? "Name",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button onClick={() => open("edit", row.original)}>
          Edit
        </Button>
      )
    }
  ], [dictionary, open])

  return <DataTable columns={columns} data={data} />
}

// ANTI-PATTERN: Column factory in server component
// content.tsx (server)
const columns = getColumns(dictionary)  // ❌ getColumns uses hooks
return <Table columns={columns} />

// ANTI-PATTERN: Recreating columns on every render
function Table({ data }) {
  const columns = [...]  // ❌ New array every render
  return <DataTable columns={columns} data={data} />
}
```

### 7. Multi-Tenant Pattern
```typescript
// PATTERN: Always include schoolId
const session = await auth()
const schoolId = session?.user?.schoolId

// Create with schoolId
await db.student.create({
  data: { ...data, schoolId }
})

// Query with schoolId
await db.student.findMany({
  where: { schoolId, ...filters }
})

// Update with schoolId
await db.student.update({
  where: { id, schoolId }  // Both required
})

// Delete with schoolId
await db.student.delete({
  where: { id, schoolId }  // Both required
})

// ANTI-PATTERN: Missing schoolId
await db.student.findMany()  // ❌ Gets all schools' data

await db.student.delete({
  where: { id }  // ❌ Could delete other school's data
})
```

### 8. Hook Pattern
```typescript
// PATTERN: Custom hook for reusable logic
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// PATTERN: Hook with cleanup
function useEventListener(event: string, handler: Function) {
  useEffect(() => {
    window.addEventListener(event, handler)
    return () => window.removeEventListener(event, handler)
  }, [event, handler])
}

// ANTI-PATTERN: Missing dependencies
useEffect(() => {
  fetchData(userId)
}, [])  // ❌ Missing userId dependency

// ANTI-PATTERN: Object/array in dependencies
useEffect(() => {
  doSomething(config)
}, [config])  // ❌ New object every render = infinite loop

// Fixed
const configString = JSON.stringify(config)
useEffect(() => {
  doSomething(JSON.parse(configString))
}, [configString])
```

### 9. Memoization Pattern
```typescript
// PATTERN: useMemo for expensive calculations
function StudentStats({ students }) {
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.active).length,
    average: students.reduce((a, b) => a + b.grade, 0) / students.length
  }), [students])

  return <Stats data={stats} />
}

// PATTERN: useCallback for stable function references
function StudentList({ onSelect }) {
  const handleSelect = useCallback((id: string) => {
    onSelect(id)
  }, [onSelect])

  return students.map(s => (
    <StudentCard key={s.id} onSelect={handleSelect} />
  ))
}

// PATTERN: React.memo for expensive components
const StudentCard = memo(function StudentCard({ student, onSelect }) {
  return <div onClick={() => onSelect(student.id)}>{student.name}</div>
})

// ANTI-PATTERN: Over-memoization
const name = useMemo(() => firstName + lastName, [firstName, lastName])  // ❌ Simple concat doesn't need memo

// ANTI-PATTERN: Missing memo on callback passed to memoized child
<MemoizedChild onClick={() => doSomething()} />  // ❌ New function every render
```

### 10. Semantic Token Pattern
```typescript
// PATTERN: Semantic colors
<div className="bg-background text-foreground">
  <div className="bg-card border border-border">
    <h2 className="text-foreground">Title</h2>
    <p className="text-muted-foreground">Description</p>
    <Button className="bg-primary text-primary-foreground">Action</Button>
  </div>
</div>

// ANTI-PATTERN: Hardcoded colors
<div className="bg-white text-black">  // ❌ Breaks dark mode
  <div className="bg-gray-100 border-gray-300">
    <button className="bg-blue-500 text-white">  // ❌ Hardcoded
```

### 11. Import Pattern
```typescript
// PATTERN: Absolute imports with aliases
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { auth } from "@/auth"
import { cn } from "@/lib/utils"

// PATTERN: Named exports for components
// button.tsx
export function Button() {}
export { Button, buttonVariants }

// PATTERN: Barrel exports for features
// components/platform/students/index.ts
export { StudentsContent } from "./content"
export { StudentForm } from "./form"
export { StudentTable } from "./table"

// ANTI-PATTERN: Relative imports going up multiple levels
import { Button } from "../../../ui/button"  // ❌ Use @/ alias

// ANTI-PATTERN: Default exports (harder to rename)
export default function Button() {}  // ❌ Use named export
```

## Checklist

- [ ] Server components for data fetching
- [ ] Client components only when needed
- [ ] Parallel data fetching with Promise.all
- [ ] Error boundaries in place
- [ ] Form validation with Zod
- [ ] Server actions follow pattern
- [ ] Multi-tenant queries include schoolId
- [ ] Semantic color tokens used
- [ ] Memoization used appropriately
- [ ] Clean import paths with aliases

## Anti-Pattern Summary

| Category | Anti-Pattern | Solution |
|----------|--------------|----------|
| Components | Client directive everywhere | Server by default |
| Data | Sequential fetching | Promise.all |
| Forms | No validation | Zod + react-hook-form |
| Actions | Missing auth | Always check session |
| Queries | No schoolId | Include in all queries |
| Styling | Hardcoded colors | Semantic tokens |
| Hooks | Missing deps | Include all dependencies |
| Memo | Over-memoization | Only expensive operations |
| Columns | Factory in server | useMemo in client |

## Handoffs

| Situation | Hand to |
|-----------|---------|
| System design | `architecture` |
| File organization | `structure` |
| Type issues | `typescript` |
| Build issues | `build` |

## Self-Improvement

When new patterns emerge in React/Next.js:
- Update this agent with new patterns
- Add anti-patterns discovered in code reviews
- Reference official documentation

## Quick Reference

### Pattern Checklist
| Pattern | When to Use |
|---------|-------------|
| Server Component | Data fetching, no state |
| Client Component | Interactivity, hooks |
| Server Action | Form submissions, mutations |
| Suspense | Async streaming |
| Error Boundary | Error recovery |
| useMemo | Expensive calculations |
| useCallback | Stable function refs |
| React.memo | Prevent re-renders |

**Rule**: Prefer server components. Validate everything. Include schoolId. Use semantic tokens.
