---
domain: authjs
severity: error
paths:
  ["**/layout.tsx", "**/page.tsx", "**/actions.ts", "**/middleware.ts"]
since: "Auth.js 5.0"
---

# Guard at the server boundary

Resolve `auth()` in a server context (layout, page, or Server Action) and redirect/throw when unauthenticated. Client-only guards (hidden buttons, `useSession` checks) are cosmetic — the route handler and action still run for anyone who calls them directly.

## Good

```tsx
// app/[lang]/(platform)/dashboard/layout.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
```

## Bad

```tsx
"use client";
import { useSession } from "next-auth/react";

export default function DashboardLayout({ children }) {
  const { data: session } = useSession();
  if (!session) return null; // markup hidden, but the route + its actions still execute server-side
  return <>{children}</>;
}
```

## Fix

Move the `auth()` check into the server layout/page and `redirect()` on failure — never gate access purely from a `"use client"` component.
