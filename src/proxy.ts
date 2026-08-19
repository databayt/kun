import { NextResponse, type NextRequest } from "next/server";

// The outer wall. Every route below ALSO does its own `auth()` check in the
// page — this is defence in depth, not a replacement for the gate on the door.
// If this file is deleted, the pages still refuse.
//
// Next 16 renamed the `middleware` file convention to `proxy`; the default
// export is the entry point. Proxy always runs on the Node
// runtime, which is what makes calling `auth()` here viable at all — verifying
// the session pulls in node:crypto via lib/password.ts, which edge cannot load.
// It also means a `runtime` segment export is rejected outright; don't add one.

export default async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // Imported lazily so the auth graph is only pulled in for matched routes.
  const { auth } = await import("@/auth");
  const session = await auth();
  if (session?.user) return NextResponse.next();

  // Preserve the locale so the bounce lands on the right login.
  const lang = request.nextUrl.pathname.split("/")[1] || "en";
  return NextResponse.redirect(new URL(`/${lang}/login`, request.url));
}

// The locale segment is spelled out rather than left as `:lang`. A wildcard
// segment matches ANY first segment — including `api` — so `/:lang/social/:path*`
// captured `/api/social/cron`, `/api/social/publish`, and `/api/social/relay`
// and redirected them to `/api/login`. Those three authenticate by bearer token
// and HMAC, so that silently breaks the daily cron and every approval link.
// Keep this list in sync with i18n.locales in components/local/config.ts.
export const config = {
  matcher: ["/(en|ar)/social/:path*", "/(en|ar)/context/:path*"],
};
