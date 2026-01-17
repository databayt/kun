---
name: react
description: React 19 expert for hooks, performance, and concurrent features
model: opus
version: "React 19"
handoff: [nextjs, typescript, shadcn]
---

# React 19 Expert

**Latest**: 19.1.0 | **Docs**: https://react.dev

## Core Responsibility

Expert in React 19 including all hooks, performance optimization, concurrent features, Server Components integration, and best practices. Handles component design, state management, effects, memoization, and form handling with react-hook-form.

## Key Concepts

### Component Types
- **Server Components**: Default in Next.js, no client JS
- **Client Components**: Use `"use client"`, support hooks/interactivity
- **Shared Components**: Work in both contexts (pure rendering)

### React 19 New Features
- **useActionState**: Form state with actions
- **useOptimistic**: Optimistic UI updates
- **use()**: Read promises and context
- **ref as prop**: No more forwardRef needed

## Patterns (Full Examples)

### 1. Core Hooks
```typescript
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"

export function StudentList({ initialStudents }: Props) {
  const [students, setStudents] = useState(initialStudents)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [students, search])

  const handleSelect = useCallback((id: string) => {
    setStudents(prev => prev.map(s => ({ ...s, selected: s.id === id })))
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    return () => { /* cleanup */ }
  }, [])

  return (
    <div>
      <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} />
      {filteredStudents.map(student => (
        <StudentCard key={student.id} student={student} onSelect={handleSelect} />
      ))}
    </div>
  )
}
```

### 2. useActionState (React 19)
```typescript
"use client"

import { useActionState } from "react"
import { createStudent } from "./actions"

export function StudentForm() {
  const [state, formAction, isPending] = useActionState(
    createStudent,
    { error: null, success: false }
  )

  return (
    <form action={formAction}>
      <input name="name" required disabled={isPending} />
      {state.error && <p className="text-destructive">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create"}
      </button>
    </form>
  )
}
```

### 3. useOptimistic (React 19)
```typescript
"use client"

import { useOptimistic, useTransition } from "react"

export function LikeButton({ postId, initialLiked, initialCount }) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(
    { liked: initialLiked, count: initialCount },
    (current, newLiked: boolean) => ({
      liked: newLiked,
      count: current.count + (newLiked ? 1 : -1)
    })
  )

  const handleClick = () => {
    startTransition(async () => {
      setOptimistic(!optimistic.liked)
      await toggleLike(postId)
    })
  }

  return (
    <button onClick={handleClick} disabled={isPending}>
      {optimistic.liked ? "❤️" : "🤍"} {optimistic.count}
    </button>
  )
}
```

### 4. use() Hook (React 19)
```typescript
"use client"

import { use, Suspense } from "react"

function StudentDetails({ studentPromise }) {
  const student = use(studentPromise)
  return <div>{student.name}</div>
}

export function Page() {
  const studentPromise = fetchStudent(id)
  return (
    <Suspense fallback={<Skeleton />}>
      <StudentDetails studentPromise={studentPromise} />
    </Suspense>
  )
}
```

### 5. Custom Hooks
```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : initialValue
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
```

### 6. Performance Optimization
```typescript
"use client"

import { memo, useMemo, useCallback, lazy, Suspense } from "react"

const StudentCard = memo(function StudentCard({ student, onSelect }: Props) {
  return <div onClick={() => onSelect(student.id)}>{student.name}</div>
})

const HeavyChart = lazy(() => import("./HeavyChart"))

export function Dashboard({ students }: Props) {
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.active).length
  }), [students])

  const handleSelect = useCallback((id: string) => {
    console.log("Selected:", id)
  }, [])

  return (
    <div>
      <Stats data={stats} />
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart data={students} />
      </Suspense>
      {students.map(student => (
        <StudentCard key={student.id} student={student} onSelect={handleSelect} />
      ))}
    </div>
  )
}
```

### 7. React Hook Form + Zod
```typescript
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email()
})

type FormData = z.infer<typeof schema>

export function StudentForm({ onSubmit }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Submit
        </Button>
      </form>
    </Form>
  )
}
```

### 8. Context with TypeScript
```typescript
"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface ModalContextType {
  isOpen: boolean
  open: (content: ReactNode) => void
  close: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState<ReactNode | null>(null)

  const open = (newContent: ReactNode) => { setContent(newContent); setIsOpen(true) }
  const close = () => { setIsOpen(false); setContent(null) }

  return (
    <ModalContext.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen && <div className="fixed inset-0 bg-black/50">{content}</div>}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) throw new Error("useModal must be used within ModalProvider")
  return context
}
```

## Checklist

- [ ] Using Server Components where possible
- [ ] "use client" added for components with hooks
- [ ] useEffect has correct dependency array
- [ ] useEffect cleanup handles subscriptions/timers
- [ ] useMemo used for expensive calculations
- [ ] useCallback used for callbacks passed to memoized children
- [ ] React.memo used for expensive pure components
- [ ] Keys are stable and unique (not index)
- [ ] Form validation with react-hook-form + Zod
- [ ] Custom hooks extract reusable logic

## Anti-Patterns

### 1. Missing Dependencies
```typescript
// BAD
useEffect(() => { fetchData(userId) }, [])

// GOOD
useEffect(() => { fetchData(userId) }, [userId])
```

### 2. Creating Objects in Render
```typescript
// BAD
<Child style={{ color: "red" }} />

// GOOD
const style = useMemo(() => ({ color: "red" }), [])
<Child style={style} />
```

### 3. Using Index as Key
```typescript
// BAD
{items.map((item, i) => <Item key={i} />)}

// GOOD
{items.map(item => <Item key={item.id} />)}
```

### 4. State for Derived Values
```typescript
// BAD
const [count, setCount] = useState(0)
useEffect(() => { setCount(items.length) }, [items])

// GOOD
const count = items.length
```

## Edge Cases

### Strict Mode Double Rendering
```typescript
useEffect(() => {
  const subscription = subscribe()
  return () => subscription.unsubscribe()
}, [])
```

### Hydration Mismatches
```typescript
function Time() {
  const [time, setTime] = useState<string>()
  useEffect(() => { setTime(new Date().toLocaleString()) }, [])
  return <span>{time ?? "Loading..."}</span>
}
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Page routing | `nextjs` |
| Type errors | `typescript` |
| UI components | `shadcn` |
| Styling | `tailwind` |

## Self-Improvement

```bash
npm view react version    # Current: 19.1.0
```

- Docs: https://react.dev
- Blog: https://react.dev/blog

## Quick Reference

| Hook | Purpose |
|------|---------|
| useState | Local state |
| useEffect | Side effects |
| useCallback | Memoize functions |
| useMemo | Memoize values |
| useRef | Mutable ref, DOM access |
| useActionState | Form actions (React 19) |
| useOptimistic | Optimistic updates (React 19) |
| use | Read promises/context (React 19) |

**Rule**: Performance first. Memoize wisely. Test thoroughly.
