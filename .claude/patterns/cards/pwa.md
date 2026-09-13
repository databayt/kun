# PWA Pattern (installable · offline · push)

The canonical Progressive Web App layout databayt products adopt on Next.js 16. Two lanes: the **hand-rolled** worker for large multi-tenant apps on thin networks (hogwarts), and **Serwist** for small greenfield apps. Both share the manifest, icon, outbox and Web Push shapes.

## Status

| Repo         | PWA state                                                                                                                                     | Maturity  | Canonical |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| **hogwarts** | hand-rolled worker v3, per-tenant Arabic-first manifest, locale offline pages, IndexedDB outbox (LMS + attendance), Web Push on the push cron | canonical | **yes**   |
| mkan         | deferred 2026-09-12 — icons and CSP ready, no manifest/worker; reopen when host messaging has volume                                          | —         | no        |
| souq         | to adopt                                                                                                                                      | —         | no        |
| shifa        | to adopt                                                                                                                                      | —         | no        |

> Update a repo's row as it adopts; record what is actually deployed, not the plan.

## Why these choices

- **The manifest resolves its own tenant.** Middleware matchers exclude dotted paths, so `/manifest.webmanifest` never sees `x-subdomain`/`x-locale`. The route reads `headers().get("host")` and returns the school's name, language, direction and colour. `start_url: "/"` stays relative — fetched on the tenant origin, it already resolves there.
- **Hand-rolled worker for big apps.** A 30 MB app's `_next/static` precache is hostile to Sudan/UAE mobile data; the worker precaches only the offline shell and caches hashed static assets lazily. Navigations and `/api/` are network-only: caching authenticated HTML replays another account's dashboard on a shared school device.
- **Locale-explicit precache.** `/ar/offline` and `/en/offline`, never `/offline`. A redirected response stored by `cache.addAll` is refused for navigations, and the failure is silent.
- **Outbox, not cache, for offline writes.** IndexedDB holds the pending work; the sync route applies every kind idempotently on a natural key and answers `applied | duplicate | rejected`.
- **Push on the existing rails.** The Notification model already carries `channels`, `pushSent`, `pushError` and a queue index; Web Push adds a `PushSubscription` store and a processor on the existing cron. FCM stays a no-op scaffold for a future native app.
- **iOS reality.** No `beforeinstallprompt`; install is Share → Add to Home Screen; Web Push (16.4+) reaches installed apps only. Phase order is therefore install first, push second.

## File Structure (hand-rolled lane)

```
public/
  service-worker.js                       # versioned caches, locale precache, static cache-first,
                                          # network-only HTML + API, push + notificationclick
  icon-72.png icon-96.png icon-192.png icon-512.png apple-touch-icon.png
src/app/
  layout.tsx                              # viewport.themeColor, metadata.appleWebApp, icons.apple
  manifest.ts                             # async, host → tenant → name/lang/dir/theme_color
  [lang]/offline/page.tsx                 # public route, no server data (outbox library)
  api/offline/sync/route.ts               # POST {items[]} → verdict per item
  api/cron/process-push-notifications/route.ts
src/components/providers/service-worker-provider.tsx   # register in production (+ env escape hatch)
src/components/offline/{content,outbox-view,sync-banner,install-card}.tsx
src/lib/offline/{db,outbox,hooks}.ts      # IndexedDB outbox, backoff, useOnlineStatus/useOutbox
src/lib/notifications/push-web.ts         # web-push processor: pull, send, prune 404/410, mark
prisma/models/notifications.prisma        # PushSubscription
scripts/gen-pwa-icons.mjs                 # sharp: 512 master → every size the manifest names
```

## `src/app/manifest.ts`

```ts
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSubdomainFromHost } from "@/lib/root-domain";
import { getSchoolBySubdomain } from "@/lib/subdomain-actions";

const HOUSE_ICONS: MetadataRoute.Manifest["icons"] = [
  {
    src: "/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host") ?? "";
  const sub = getSubdomainFromHost(host);
  const res = sub ? await getSchoolBySubdomain(sub) : null;
  const school = res?.success ? res.data : null;
  const lang = (school?.preferredLanguage ?? "ar") as "ar" | "en";
  const name = (lang === "ar" ? school?.name : school?.nameEn) ?? "بلقلم";
  return {
    name,
    short_name: name.slice(0, 12),
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: school?.branding?.primaryColor ?? "#3b82f6",
    icons: [
      ...HOUSE_ICONS,
      ...(school?.logoUrl
        ? [{ src: school.logoUrl, sizes: "any", type: "image/png" }]
        : []),
    ],
    shortcuts: [
      {
        name: "التحضير السريع",
        url: "/attendance", // the quick surface is the attendance index
        icons: [{ src: "/icon-96.png", sizes: "96x96" }],
      },
    ],
    prefer_related_applications: false,
  };
}
```

## `public/service-worker.js` (skeleton)

```js
const STATIC = "app-static-v3";
const PRECACHE = [
  "/ar/offline",
  "/en/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
];
const NEVER_CACHE = ["/api/offline/", "/api/"]; // API is network-only
const STATIC_CAP = 150;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(
          ks.filter((k) => k !== STATIC).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.headers.has("range")
  )
    return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;
  if (/\.(js|css|png|svg|webp|woff2?)$/.test(url.pathname)) {
    // static: cache-first, capped
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((r) => {
            if (r.ok && r.type === "basic")
              caches.open(STATIC).then((c) => c.put(request, r.clone()));
            return r;
          }),
      ),
    );
    return;
  }
  if (request.mode === "navigate") {
    // HTML: network, offline fallback, no put
    const locale = url.pathname.startsWith("/en") ? "en" : "ar";
    e.respondWith(
      fetch(request).catch(() => caches.match(`/${locale}/offline`)),
    );
  }
});
self.addEventListener("push", (e) => {
  const d = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(d.title ?? "", {
      body: d.body,
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      tag: d.tag,
      data: { url: d.url },
    }),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((cs) => {
      const c = cs.find((x) => x.url.startsWith(self.location.origin));
      return c
        ? c.focus().then(() => c.navigate(url))
        : self.clients.openWindow(url);
    }),
  );
});
```

Bump `STATIC` on every change. Root `layout.tsx` exports `viewport: { themeColor }` and `metadata: { appleWebApp: { capable: true }, icons: { apple: "/apple-touch-icon.png" } }`.

## Serwist lane (greenfield, small apps)

`pnpm add @serwist/turbopack serwist` + `esbuild` (dev). `next.config` wrapped with `withSerwist`, `app/sw.ts` with `defaultCache` + `/~offline` fallback, `app/serwist/[path]/route.ts` exporting `createSerwistRoute({ swSrc: "app/sw.ts", additionalPrecacheEntries })`, `<SerwistProvider swUrl="/serwist/sw.js">` in the root layout, `public/sw*` gitignored. Works under Turbopack on Next 16.

## Gotchas (from the hogwarts rollout)

- Precache locale-explicit URLs only; verify each with `redirect: "manual"`.
- The dispatcher must request `"push"` and a cron schedule must route to the processor, or the lane is silent.
- Verify the processor with a bogus endpoint and a valid P-256 key (prune path); real delivery needs a phone.
- `prisma db execute`: `--schema` locally, `--url` for prod — never both.
- Custom-domain tenants get the default manifest until the host resolver knows the domain.
- The install sheet is one tap, never a decorative icon: replay `beforeinstallprompt` when
  captured, otherwise `navigator.share({ title, url })` from the tap (Web Share needs the gesture;
  on iPhone Add to Home Screen is one of the sheet's actions). The picture is the whole
  explanation. Detect the platform with `useSyncExternalStore`
  — the React Compiler lint rejects `setState` inside the effect. Style: an accent eyebrow over the app name, ONE
  picture (a mock of the share list with Add to Home Screen lit up), one big Continue in the brand
  green — no footnote, no guide, no Not now — presented as an iOS bottom sheet (the shadcn `Drawer`: rounded top over the dimmed
  page, grabber, round close, swipe to dismiss) — never a full-screen takeover; the app icon is a
  brand-colour box with the glyph at ~56 % so one artwork serves iOS, maskable and the tab
  (hogwarts 2026-09-13).

## Verification

`node ~/.claude/skills/pwa/scripts/pwa-audit.mjs <url> --sw /service-worker.js` → 0 FAIL; browser offline emulation renders the locale offline page; an offline write drains and replays as `duplicate`; a push round-trip through the cron lands and deep-links.

## Clone

`/clone pattern:pwa` — or say _"make balqalam installable"_ / _"attendance should work offline"_ / _"push notifications for parents"_.
