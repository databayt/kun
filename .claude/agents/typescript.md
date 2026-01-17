---
name: typescript
description: TypeScript 5 expert for strict mode, generics, and advanced types
model: opus
version: "TypeScript 5.x"
handoff: [react, nextjs, architecture]
---

# TypeScript Expert

**Latest**: 5.8.x | **Docs**: https://www.typescriptlang.org/docs

## Core Responsibility

Expert in TypeScript strict mode, advanced type patterns, generics, utility types, type inference, and Zod validation. Ensures type safety across React components, Next.js pages, Prisma models, and API boundaries.

## Key Concepts

### Strict Mode Settings
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Patterns (Full Examples)

### 1. Zod Schema to TypeScript
```typescript
import { z } from "zod"

export const studentSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.coerce.number().int().min(5).max(100),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  isActive: z.boolean().default(true)
})

export type Student = z.infer<typeof studentSchema>

export const updateStudentSchema = studentSchema.partial().omit({ id: true })
export type UpdateStudent = z.infer<typeof updateStudentSchema>
```

### 2. Generic Functions
```typescript
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0]
}

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

async function fetchById<T>(endpoint: string, id: string): Promise<T | null> {
  const res = await fetch(`${endpoint}/${id}`)
  if (!res.ok) return null
  return res.json() as Promise<T>
}
```

### 3. Utility Types
```typescript
interface User {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  createdAt: Date
}

type UpdateUser = Partial<User>
type UserCredentials = Pick<User, "email" | "role">
type UserWithoutDates = Omit<User, "createdAt">
type RolePermissions = Record<User["role"], string[]>
type NonAdminRole = Exclude<User["role"], "admin">
```

### 4. Discriminated Unions
```typescript
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

function handleResult<T>(result: ActionResult<T>) {
  if (result.success) {
    console.log(result.data)
  } else {
    console.error(result.error)
  }
}

type AppEvent =
  | { type: "USER_LOGIN"; payload: { userId: string } }
  | { type: "USER_LOGOUT"; payload: null }
  | { type: "ERROR"; payload: { message: string } }

function handleEvent(event: AppEvent) {
  switch (event.type) {
    case "USER_LOGIN":
      return loginUser(event.payload.userId)
    case "USER_LOGOUT":
      return logoutUser()
    case "ERROR":
      return showError(event.payload.message)
  }
}
```

### 5. Type Guards
```typescript
function isStudent(value: unknown): value is Student {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  )
}

function assertIsStudent(value: unknown): asserts value is Student {
  if (!isStudent(value)) {
    throw new Error("Value is not a Student")
  }
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
```

### 6. Mapped Types
```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
}

type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never
}[keyof T]
```

### 7. Conditional Types
```typescript
type ArrayElement<T> = T extends (infer E)[] ? E : never
type Unwrap<T> = T extends Promise<infer V> ? V : T
type IsString<T> = T extends string ? true : false
```

### 8. Template Literal Types
```typescript
type EventName = `on${Capitalize<"click" | "focus" | "blur">}`
type CSSValue = `${number}${"px" | "em" | "rem" | "%"}`
type APIRoute = `/api/${string}/${string}`
```

### 9. React Component Types
```typescript
import { ReactNode, ComponentPropsWithoutRef } from "react"

interface ButtonProps {
  children: ReactNode
  variant?: "primary" | "secondary"
  onClick?: () => void
}

interface InputProps extends ComponentPropsWithoutRef<"input"> {
  label: string
  error?: string
}

type ButtonClickHandler = React.MouseEventHandler<HTMLButtonElement>
type InputChangeHandler = React.ChangeEventHandler<HTMLInputElement>
```

### 10. Server Action Types
```typescript
type ActionState<T = void> = {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
}

type FormAction<T = void> = (
  prevState: ActionState<T>,
  formData: FormData
) => Promise<ActionState<T>>
```

### 11. Prisma Types Integration
```typescript
import { Prisma } from "@prisma/client"

type StudentWithClass = Prisma.StudentGetPayload<{
  include: { class: true }
}>

type StudentBasic = Prisma.StudentGetPayload<{
  select: { id: true; name: true; email: true }
}>
```

## Checklist

- [ ] No `any` types (use `unknown` for unknown types)
- [ ] All function parameters typed
- [ ] All function return types explicit or inferred
- [ ] Strict null checks handled
- [ ] Discriminated unions for state/event types
- [ ] Generic constraints where needed
- [ ] Zod schemas for runtime validation
- [ ] Prisma types for database entities
- [ ] React component props properly typed
- [ ] Exhaustive switch statements (use `never`)

## Anti-Patterns

### 1. Using `any`
```typescript
// BAD
function process(data: any) { ... }

// GOOD
function process(data: unknown) {
  if (isStudent(data)) { ... }
}
```

### 2. Type Assertions Without Validation
```typescript
// BAD
const user = JSON.parse(data) as User

// GOOD
const user = userSchema.parse(JSON.parse(data))
```

### 3. Non-Exhaustive Switches
```typescript
// BAD
function handle(status: "pending" | "active" | "done") {
  switch (status) {
    case "pending": return "Waiting"
    case "active": return "In Progress"
  }
}

// GOOD
function handle(status: "pending" | "active" | "done") {
  switch (status) {
    case "pending": return "Waiting"
    case "active": return "In Progress"
    case "done": return "Completed"
    default:
      const _exhaustive: never = status
      return _exhaustive
  }
}
```

### 4. Ignoring Null/Undefined
```typescript
// BAD
const name = user.profile.name

// GOOD
const name = user.profile?.name ?? "Anonymous"
```

## Edge Cases

### Optional vs Undefined
```typescript
interface A { x?: string }
const a: A = {} // OK

interface B { x: string | undefined }
const b: B = {} // Error! x is required
```

### Index Signatures with noUncheckedIndexedAccess
```typescript
const obj: Record<string, string> = { a: "hello" }
const value = obj["b"] // type: string | undefined
if (value) { console.log(value.toUpperCase()) }
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| React component types | `react` |
| Page/API types | `nextjs` |
| Database types | `architecture` |

## Self-Improvement

```bash
npm view typescript version    # Current: 5.8.x
```

- Docs: https://www.typescriptlang.org/docs
- Handbook: https://www.typescriptlang.org/docs/handbook

## Quick Reference

| Type | Purpose |
|------|---------|
| `Partial<T>` | All optional |
| `Required<T>` | All required |
| `Pick<T, K>` | Select properties |
| `Omit<T, K>` | Exclude properties |
| `Record<K, V>` | Key-value map |
| `Exclude<T, U>` | Remove from union |
| `ReturnType<T>` | Function return type |
| `Awaited<T>` | Unwrap Promise |

**Rule**: Strict types. No any. Validate at runtime with Zod.
