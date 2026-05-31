# Validation Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | schema-factory with i18n ValidationHelper | production | 30 | **yes** |
| codebase | centralized (2 files) | partial | 2 | no |
| mkan | scattered (mixed locations) | development | 12 | no |
| shifa | scattered (mixed locations) | development | 5 | no |
| souq | centralized (Zod v4) | development | 5 | no |

## Canonical: hogwarts

### Architecture

Each feature has a dedicated `validation.ts` with i18n-aware schema factories:

```typescript
// validation.ts
import { z } from "zod"

// i18n factory (preferred)
export const createStudentSchema = (dictionary?: ValidationDictionary) => {
  const msg = getValidationMessages(dictionary)
  return z.object({
    firstName: z.string().min(1, msg.required),
    lastName: z.string().min(1, msg.required),
    email: z.string().email(msg.invalidEmail),
    grade: z.string().min(1, msg.required),
    birthDate: z.date({ required_error: msg.required }),
  })
}

// Type inference
export type StudentInput = z.infer<ReturnType<typeof createStudentSchema>>
```

### File Convention

```
feature/
  validation.ts     # Zod schemas — always a dedicated file, never inline
  form.tsx          # Imports schema for zodResolver
  actions.ts        # Imports schema for server-side validation
```

### Usage Example

```typescript
// In form.tsx (client)
const schema = createStudentSchema(dictionary?.validation)
const form = useForm({ resolver: zodResolver(schema) })

// In actions.ts (server)
const schema = createStudentSchema()
const result = schema.safeParse(data)
```

## Clone

```
/clone pattern:validation
```

## Migration

**From scattered validation (mkan/shifa):**
1. Create dedicated `validation.ts` per feature
2. Move inline Zod schemas from action files to validation.ts
3. Convert static schemas to i18n factory functions
4. Export type inference: `type XInput = z.infer<ReturnType<typeof createXSchema>>`
