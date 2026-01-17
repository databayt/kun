# Next.js 16 Patterns

Apply latest Next.js patterns to code.

## Patterns Applied

### Async APIs
```tsx
// All dynamic APIs must be awaited
const { lang } = await props.params;
const searchParams = await props.searchParams;
const cookieStore = await cookies();
```

### Server Components (default)
- No "use client" unless needed
- Data fetching in components
- Streaming with Suspense

### Server Actions
```tsx
"use server"
export async function createItem(formData: FormData) {
  // Validate, mutate, revalidate
}
```

### Proxy (middleware.ts → proxy.ts)
- Auth checks
- i18n routing
- Node.js runtime only

### Caching
- `unstable_cache` for data
- `revalidatePath` / `revalidateTag`

## Usage
```
/nextjs          # Apply to current file
/nextjs migrate  # Migrate old patterns
```

Apply Next.js 16 patterns: $ARGUMENTS
