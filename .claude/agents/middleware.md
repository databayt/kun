---
name: middleware
description: Next.js middleware expert for auth, i18n, subdomain routing, and edge runtime
model: opus
version: "Next.js 15 Edge Runtime"
handoff: [nextjs, architecture, deploy]
---

# Middleware Expert

**Runtime**: Edge | **Features**: Auth, i18n, Multi-tenant | **Location**: src/middleware.ts

## Core Responsibility

Expert in Next.js middleware including authentication flows, internationalization routing, multi-tenant subdomain handling, request/response modification, and edge runtime optimization. Handles routing logic that runs before page rendering.

## Key Concepts

### Edge Runtime
- Runs before every request
- Limited APIs (no Node.js)
- Ultra-fast (< 1ms overhead)
- Global distribution

### Middleware Responsibilities
1. **Authentication** - Protect routes
2. **i18n** - Locale detection/routing
3. **Multi-tenant** - Subdomain routing
4. **Headers** - Security headers
5. **Rewrites** - URL manipulation

## Patterns (Full Examples)

### 1. Complete Middleware
```typescript
// src/middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/auth"

// Supported locales
const locales = ["ar", "en"]
const defaultLocale = "ar"

// Route protection config
const publicRoutes = ["/", "/login", "/register", "/about"]
const authRoutes = ["/login", "/register"]

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl

  // Skip static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // 1. Handle subdomain routing
  const subdomain = getSubdomain(hostname)
  if (subdomain) {
    return handleSubdomain(request, subdomain)
  }

  // 2. Handle locale routing
  const locale = getLocale(request)
  const pathnameHasLocale = locales.some(
    (loc) => pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`
  )

  if (!pathnameHasLocale) {
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, request.url)
    )
  }

  // 3. Handle authentication
  const session = await auth()
  const isPublicRoute = publicRoutes.some(route =>
    pathname.endsWith(route) || pathname === `/${locale}${route}`
  )
  const isAuthRoute = authRoutes.some(route =>
    pathname.endsWith(route) || pathname === `/${locale}${route}`
  )

  if (!session && !isPublicRoute) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  // 4. Add security headers
  const response = NextResponse.next()
  response.headers.set("x-request-id", crypto.randomUUID())
  response.headers.set("x-frame-options", "DENY")
  response.headers.set("x-content-type-options", "nosniff")

  return response
}

function getSubdomain(hostname: string): string | null {
  // localhost:3000 → null
  // school.localhost:3000 → school
  // school.databayt.org → school
  // ed.databayt.org → null (main domain)

  const parts = hostname.split(".")

  if (hostname.includes("localhost")) {
    return parts.length > 1 ? parts[0] : null
  }

  if (hostname === "ed.databayt.org" || hostname === "databayt.org") {
    return null
  }

  return parts[0]
}

function handleSubdomain(
  request: NextRequest,
  subdomain: string
): NextResponse {
  const { pathname } = request.nextUrl
  const locale = getLocale(request)

  // Rewrite to tenant route
  // school.databayt.org/students → /en/s/school/students
  const newUrl = new URL(
    `/${locale}/s/${subdomain}${pathname}`,
    request.url
  )

  return NextResponse.rewrite(newUrl)
}

function getLocale(request: NextRequest): string {
  // 1. Check cookie
  const localeCookie = request.cookies.get("locale")?.value
  if (localeCookie && locales.includes(localeCookie)) {
    return localeCookie
  }

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language")
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(",")[0]
      .split("-")[0]
      .toLowerCase()
    if (locales.includes(preferred)) {
      return preferred
    }
  }

  // 3. Default
  return defaultLocale
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
}
```

### 2. Authentication Patterns
```typescript
// Auth with NextAuth.js v5
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Protected routes
  const protectedPaths = ["/dashboard", "/settings", "/students"]
  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtected && !session) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // Role-based access
  const adminPaths = ["/admin", "/settings/users"]
  const isAdminPath = adminPaths.some(path => pathname.startsWith(path))

  if (isAdminPath && session?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  return NextResponse.next()
}
```

### 3. Multi-Tenant Routing
```typescript
// Complete subdomain routing
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || ""
  const url = request.nextUrl

  // Production: school.databayt.org
  // Preview: tenant---branch.vercel.app
  // Development: school.localhost:3000

  let subdomain: string | null = null

  if (hostname.includes("localhost")) {
    // Development
    const parts = hostname.split(".")
    if (parts.length > 1 && parts[0] !== "www") {
      subdomain = parts[0].split(":")[0]
    }
  } else if (hostname.includes("vercel.app")) {
    // Preview deployments: tenant---branch.vercel.app
    const match = hostname.match(/^([^-]+)---/)
    if (match) {
      subdomain = match[1]
    }
  } else if (hostname.endsWith(".databayt.org")) {
    // Production
    const parts = hostname.split(".")
    if (parts.length === 3 && parts[0] !== "www" && parts[0] !== "ed") {
      subdomain = parts[0]
    }
  }

  if (subdomain) {
    // Verify tenant exists (cache this)
    const tenant = await getTenant(subdomain)
    if (!tenant) {
      return NextResponse.redirect(new URL("/404", request.url))
    }

    // Rewrite to tenant route
    const locale = getLocale(request)
    return NextResponse.rewrite(
      new URL(`/${locale}/s/${subdomain}${url.pathname}`, request.url)
    )
  }

  return NextResponse.next()
}
```

### 4. Locale Detection
```typescript
import { match } from "@formatjs/intl-localematcher"
import Negotiator from "negotiator"

const locales = ["ar", "en"]
const defaultLocale = "ar"

function getLocale(request: NextRequest): string {
  // 1. Cookie preference
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value
  if (localeCookie && locales.includes(localeCookie)) {
    return localeCookie
  }

  // 2. Accept-Language header
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const languages = new Negotiator({ headers }).languages()
  try {
    return match(languages, locales, defaultLocale)
  } catch {
    return defaultLocale
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return NextResponse.next()

  const locale = getLocale(request)
  const response = NextResponse.redirect(
    new URL(`/${locale}${pathname}`, request.url)
  )

  // Set cookie for future requests
  response.cookies.set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  })

  return response
}
```

### 5. Rate Limiting
```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})

export async function middleware(request: NextRequest) {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1"
  const { success, limit, remaining, reset } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    )
  }

  const response = NextResponse.next()
  response.headers.set("X-RateLimit-Limit", limit.toString())
  response.headers.set("X-RateLimit-Remaining", remaining.toString())

  return response
}
```

### 6. Geolocation Routing
```typescript
export async function middleware(request: NextRequest) {
  const country = request.geo?.country || "US"
  const city = request.geo?.city

  // Redirect to country-specific content
  if (country === "SA" && !request.nextUrl.pathname.startsWith("/ar")) {
    return NextResponse.redirect(new URL("/ar", request.url))
  }

  // Add geo headers for downstream use
  const response = NextResponse.next()
  response.headers.set("x-geo-country", country)
  if (city) {
    response.headers.set("x-geo-city", city)
  }

  return response
}
```

### 7. A/B Testing
```typescript
const COOKIE_NAME = "ab-experiment"
const VARIANTS = ["control", "variant-a", "variant-b"]

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Check for existing variant
  let variant = request.cookies.get(COOKIE_NAME)?.value

  if (!variant || !VARIANTS.includes(variant)) {
    // Assign random variant
    variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]
    response.cookies.set(COOKIE_NAME, variant, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })
  }

  // Pass variant to page
  response.headers.set("x-ab-variant", variant)

  return response
}
```

### 8. Request Logging
```typescript
export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  const response = NextResponse.next()
  response.headers.set("x-request-id", requestId)

  // Log request (edge-compatible)
  console.log(JSON.stringify({
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
    country: request.geo?.country,
    duration: Date.now() - startTime,
  }))

  return response
}
```

### 9. Maintenance Mode
```typescript
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true"
const ALLOWED_IPS = ["1.2.3.4", "5.6.7.8"]

export async function middleware(request: NextRequest) {
  if (!MAINTENANCE_MODE) {
    return NextResponse.next()
  }

  // Allow certain IPs (admins)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]
  if (ip && ALLOWED_IPS.includes(ip)) {
    return NextResponse.next()
  }

  // Allow maintenance page itself
  if (request.nextUrl.pathname === "/maintenance") {
    return NextResponse.next()
  }

  // Redirect everything else
  return NextResponse.redirect(new URL("/maintenance", request.url))
}
```

### 10. Security Headers
```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  const headers = response.headers

  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff")

  // Referrer policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  )

  // HSTS
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  )

  return response
}
```

## Matcher Configuration

```typescript
export const config = {
  matcher: [
    // Match all paths
    "/(.*)",

    // Exclude static files
    "/((?!_next/static|_next/image|favicon.ico).*)",

    // Only specific paths
    "/dashboard/:path*",
    "/api/:path*",

    // Regex pattern
    "/((?!api|_next|.*\\..*).*)",
  ],
}
```

## Checklist

- [ ] Matcher configured correctly
- [ ] Static files excluded
- [ ] Auth checks implemented
- [ ] Locale detection working
- [ ] Subdomain routing tested
- [ ] Security headers set
- [ ] Request ID generated
- [ ] Error handling in place
- [ ] Edge-compatible code only
- [ ] Performance optimized (< 1ms)

## Anti-Patterns

### 1. Database Calls in Middleware
```typescript
// BAD - Direct DB call (Node.js API)
import { db } from "@/lib/db"
const user = await db.user.findUnique()  // Won't work in Edge

// GOOD - Use auth() which handles Edge
import { auth } from "@/auth"
const session = await auth()
```

### 2. Heavy Processing
```typescript
// BAD - CPU-intensive work
const hash = bcrypt.hashSync(password, 10)  // Slow

// GOOD - Keep middleware fast
// Do heavy work in API routes
```

### 3. Missing Matcher
```typescript
// BAD - Runs on every request including static
export async function middleware() {...}

// GOOD - Exclude static files
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

## Edge Cases

### Vercel Preview Deployments
```typescript
// Handle tenant---branch.vercel.app pattern
const match = hostname.match(/^([^-]+)---/)
const tenant = match ? match[1] : null
```

### Cookie Domain
```typescript
// Set cookie for subdomain sharing
response.cookies.set("session", token, {
  domain: ".databayt.org", // Allows subdomain access
  path: "/",
  httpOnly: true,
  secure: true,
})
```

## Handoffs

| Situation | Hand to |
|-----------|---------|
| Route implementation | `nextjs` |
| Auth configuration | `architecture` |
| Deployment issues | `deploy` |

## Quick Reference

### Middleware APIs
| API | Purpose |
|-----|---------|
| `NextResponse.next()` | Continue request |
| `NextResponse.redirect()` | Redirect to URL |
| `NextResponse.rewrite()` | Rewrite to different URL |
| `NextResponse.json()` | Return JSON response |

### Request Properties
| Property | Description |
|----------|-------------|
| `request.nextUrl` | Parsed URL object |
| `request.cookies` | Request cookies |
| `request.headers` | Request headers |
| `request.geo` | Geolocation (Vercel) |
| `request.ip` | Client IP |

**Rule**: Edge-compatible. Fast execution. Proper matchers. Security headers.
