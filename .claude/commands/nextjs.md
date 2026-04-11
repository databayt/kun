# Next.js — Full Coverage App Router Sweep

Sweep every file for Next.js 16 anti-patterns: Pages Router leftovers, deprecated APIs, raw HTML instead of Next.js components, client-side data fetching, missing metadata.

## Usage

- `nextjs` — sweep ALL routes in current product
- `nextjs admission` — sweep only the admission block
- `nextjs --status` — show current coverage
- `nextjs migrate` — migrate old patterns (legacy mode, single file)

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `nextjs` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **`from 'next/router'`** → use `next/navigation` (App Router)
2. **`getServerSideProps` / `getStaticProps` / `getInitialProps`** → server components or route handlers
3. **`<img>`** → `next/image` for automatic optimization
4. **`<a href="/">`** → `next/link` for client-side navigation
5. **`useRouter()` from next/router** → `useRouter()` from `next/navigation`
6. **`getSession()`** → `auth()` from next-auth in server components
7. **`useEffect` with fetch** → move data fetching to server component
8. **Non-async page component with await** → make page async

### Mode: Fix

This keyword finds AND fixes Next.js anti-patterns.

### Best Practices Enforced

- Server Components by default — no `"use client"` unless hooks/events needed
- Async params: `const { lang } = await props.params`
- Streaming with Suspense for slow data
- Route groups `(parentheses)` for layout organization
- `loading.tsx` and `error.tsx` for each route segment
- Metadata export in layouts and pages
- Server Actions with `"use server"` for mutations

### Legacy Migrate Mode

`nextjs migrate` applies patterns to a single file (the original behavior):
- Async APIs (params, searchParams, cookies)
- Server component defaults
- Server action patterns
- Proxy/middleware patterns
- Caching patterns
