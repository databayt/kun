---
name: authjs
description: Auth.js v5 (NextAuth) expert - JWT, OAuth, sessions
model: opus
---

# Auth.js v5 Expert (NextAuth)

**Version**: next-auth 5.0.0-beta.29

## Setup

### Configuration (auth.ts)
```typescript
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        const { email, password } = credentials

        const user = await db.user.findUnique({
          where: { email: email as string }
        })

        if (!user || !user.password) return null

        const valid = await bcrypt.compare(
          password as string,
          user.password
        )

        if (!valid) return null

        return user
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.schoolId = user.schoolId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.schoolId = token.schoolId as string
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
    error: "/auth/error"
  }
})
```

### Route Handler (app/api/auth/[...nextauth]/route.ts)
```typescript
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

### Middleware (middleware.ts)
```typescript
import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isProtected = req.nextUrl.pathname.startsWith("/dashboard")

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
}
```

## Authentication

### Server Component
```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return <Dashboard user={session.user} />
}
```

### Client Component
```typescript
"use client"

import { useSession } from "next-auth/react"

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <Skeleton />
  }

  if (!session) {
    return <LoginButton />
  }

  return <span>{session.user.name}</span>
}
```

### Server Action
```typescript
"use server"

import { auth } from "@/auth"

export async function createPost(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  // Create post with session.user.id
}
```

## Sign In / Sign Out

### Server Action Sign In
```typescript
"use server"

import { signIn, signOut } from "@/auth"

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function loginWithCredentials(formData: FormData) {
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/dashboard"
  })
}

export async function logout() {
  await signOut({ redirectTo: "/" })
}
```

### Client Component Sign In
```typescript
"use client"

import { signIn, signOut } from "next-auth/react"

export function LoginButton() {
  return (
    <button onClick={() => signIn("google")}>
      Sign in with Google
    </button>
  )
}

export function LogoutButton() {
  return (
    <button onClick={() => signOut()}>
      Sign out
    </button>
  )
}
```

## Type Extensions

```typescript
// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      schoolId: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: string
    schoolId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    schoolId: string
  }
}
```

## Multi-Tenant Authentication

```typescript
// Get school-scoped session
const session = await auth()
const schoolId = session?.user?.schoolId

if (!schoolId) {
  throw new Error("No school context")
}

// All queries must include schoolId
const students = await db.student.findMany({
  where: { schoolId }
})
```

## Role-Based Access Control

```typescript
// Check role in server component
async function AdminPage() {
  const session = await auth()

  if (session?.user?.role !== "ADMIN") {
    redirect("/unauthorized")
  }

  return <AdminDashboard />
}

// Role guard helper
export async function requireRole(role: string) {
  const session = await auth()

  if (session?.user?.role !== role) {
    throw new Error(`Required role: ${role}`)
  }

  return session
}

// Usage
export async function deleteUser(userId: string) {
  const session = await requireRole("ADMIN")
  await db.user.delete({ where: { id: userId } })
}
```

## Session Provider

```typescript
// app/layout.tsx
import { SessionProvider } from "next-auth/react"
import { auth } from "@/auth"

export default async function RootLayout({ children }) {
  const session = await auth()

  return (
    <html>
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

## OAuth Providers

```typescript
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Facebook from "next-auth/providers/facebook"

providers: [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  GitHub({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }),
  Facebook({
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  })
]
```

## Environment Variables

```env
# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Auth.js
AUTH_SECRET=          # openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Database
DATABASE_URL=
```

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set AUTH_SECRET securely
- [ ] Validate session on every protected route
- [ ] Include schoolId in all queries (multi-tenant)
- [ ] Hash passwords with bcrypt (cost 12+)
- [ ] Set secure cookie options
- [ ] Implement rate limiting on auth routes
- [ ] Use CSRF protection (built-in)
- [ ] Log authentication events

## Common Issues

### Session not updating
```typescript
// Force session refresh
import { useSession } from "next-auth/react"

const { update } = useSession()
await update() // Refresh session data
```

### Redirect after sign in
```typescript
await signIn("google", {
  redirectTo: "/dashboard"
})

// Or with callback URL
await signIn("google", {
  callbackUrl: "/dashboard"
})
```

### Custom error page
```typescript
// pages/auth/error.tsx or app/auth/error/page.tsx
export default function AuthError({
  searchParams
}: {
  searchParams: { error?: string }
}) {
  return (
    <div>
      <h1>Authentication Error</h1>
      <p>{searchParams.error}</p>
    </div>
  )
}
```

**Rule**: Always verify session. Include schoolId. Secure by default.
