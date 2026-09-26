---
domain: next-16
severity: warn
paths: ["**/middleware.ts", "**/proxy.ts", "next.config.ts"]
since: "Next.js 16.0"
---

# Request interception lives in `proxy.ts` — and it only does optimistic checks

Next 16 deprecated the `middleware` file and export and renamed both to `proxy` (`skipMiddlewareUrlNormalize` became `skipProxyUrlNormalize`). Proxy runs on the Node.js runtime only — no `runtime` export — so keep a `middleware.ts` only for a lane that genuinely needs the edge runtime. Put it at the root or in `src/`, beside `app/`. Proxy is not the security boundary: it runs on prefetches too, so read the session cookie for redirects and never hit the database there. Every page, action and route re-checks `auth()` — the 2026 proxy-bypass advisories (May, July) got past exactly the apps that trusted it.

## Good

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/auth.config"; // __Secure- prefixed on HTTPS

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE); // cookie only, no DB
  if (!hasSession && request.nextUrl.pathname.includes("/dashboard"))
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
```

## Bad

```ts
// middleware.ts — deprecated file and export name, edge runtime, DB call
export const runtime = "edge";
export async function middleware(request: NextRequest) {
  const user = await db.user.findUnique({ where: { id: getId(request) } }); // on every prefetch
  if (!user?.isAdmin) return NextResponse.redirect(new URL("/", request.url));
}
```

## Fix

`mv middleware.ts proxy.ts`, rename the export to `proxy`, drop the `runtime` export and any database work, and keep the real `auth()` check in the page, action or route.

> Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy · https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional
