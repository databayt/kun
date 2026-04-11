# Action Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | factory (createFormAction + per-feature) | production | 35 | **yes** |
| codebase | per-block | partial | 5 | no |
| mkan | mixed (centralized + co-located) | development | 19 | no |
| shifa | mixed (centralized + co-located) | development | 14 | no |
| souq | REST API routes (no server actions) | production | 15 | no |

## Canonical: hogwarts

### Architecture

Every server action follows the same pipeline:

```
Auth → Tenant → Validate → Execute → Revalidate → Return ActionResponse<T>
```

**Factory pattern** at `src/components/form/actions.ts`:
```typescript
export async function createFormAction<TInput, TOutput>(
  schema: ZodSchema<TInput>,
  handler: (data: TInput, schoolId: string) => Promise<TOutput>
): Promise<(prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>>
```

**Per-feature actions.ts** follows:
```typescript
"use server"

import { getTenantContext } from "@/lib/tenant-context"
import { ActionResponse } from "@/components/form"

export async function createStudent(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const { schoolId, session } = await getTenantContext()
  // 1. Parse and validate with Zod
  // 2. Execute Prisma mutation
  // 3. Revalidate path
  // 4. Return { success: true, data }
}
```

### Key Types

```typescript
interface ActionResponse<T = unknown> {
  success: boolean
  data?: T
  errors?: Record<string, string[]>  // per-field errors
  message?: string
}

// Factory helpers
createFormAction(schema, handler)      // Create with Zod + FormData
createGenericAction(schema, handler)   // Generic create
updateGenericAction(schema, handler)   // Generic update
deleteGenericAction(handler)           // Generic delete
findGenericAction(handler)             // Generic find
mapZodErrors(zodError)                 // Convert Zod errors to Record<string, string[]>
createRevalidator(paths)               // Revalidate multiple paths
```

### Usage Example

```typescript
"use server"

import { createFormAction, type ActionResponse } from "@/components/form"
import { StudentSchema } from "./validation"

export const createStudent = await createFormAction(
  StudentSchema,
  async (data, schoolId) => {
    const student = await prisma.student.create({
      data: { ...data, schoolId }
    })
    revalidatePath("/students")
    return student
  }
)
```

**Client-side with useActionStateBridge:**
```tsx
const { form, isPending, handleSubmit } = useActionStateBridge({
  schema: StudentSchema,
  action: createStudent,
  onSuccess: () => toast.success("Created"),
})
```

## Clone

```
/clone pattern:action
/clone hogwarts:src/components/form/actions.ts
```

## Migration

**From mixed pattern (mkan/shifa):**
1. Install form block (includes actions.ts factory)
2. Replace manual auth checks with getTenantContext() or equivalent
3. Standardize return type to ActionResponse<T>
4. Move inline Zod validation to dedicated validation.ts files

**From REST API (souq):**
1. Convert API routes to server actions with "use server"
2. Keep REST routes only for external API consumers
