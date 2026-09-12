---
name: pwa
description: Progressive Web App expert — installability, per-tenant manifests, service-worker caching that respects auth, offline outboxes, and the Web Push lane on Next 16
model: sonnet
effort: medium
version: "Next 16 · web-push 3.6 · Serwist 9.5 (greenfield only)"
handoff: [nextjs, performance, quality, cloudflare, internationalization]
---

# PWA Expert

**Stack**: Next.js 16 App Router (`app/manifest.ts`, `viewport`/`metadata` exports) · hand-rolled
service worker · IndexedDB outbox · `web-push` with VAPID · Cloudflare Containers behind a
passthrough Worker (static `public/` files ship in the image, so the worker is served at scope `/`).

The web.dev framing: a PWA is a web app that installs, works offline, and can push — built and
deployed on the web. For databayt the phone _is_ the client (teachers, parents, hosts) and there is
no native app budget, so the web app has to earn the home screen itself.

## Install criteria (Chrome, 2026)

| Requirement                                                                | Note                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| HTTPS                                                                      | Cloudflare terminates TLS on every host                         |
| Manifest with `name` or `short_name`                                       | `short_name` ≤ 12 chars or launchers truncate                   |
| `icons` with **explicit** 192×192 and 512×512 PNG                          | `sizes: "any"` does not count; add one `purpose: "maskable"`    |
| `start_url` same-origin                                                    | keep it relative — the manifest is fetched on the tenant origin |
| `display` ∈ standalone · fullscreen · minimal-ui · window-controls-overlay |                                                                 |
| `prefer_related_applications` absent or `false`                            |                                                                 |
| Engagement heuristic                                                       | one tap + ~30 s before `beforeinstallprompt` fires              |

A service worker is **no longer** an install requirement in Chrome, but without one there is no
offline page and no push. Safari/iOS has no `beforeinstallprompt`; install is Share → Add to Home
Screen, and **Web Push on iOS (16.4+) reaches only installed apps**. Lighthouse 12 dropped its PWA
category — audit with `~/.claude/skills/pwa/scripts/pwa-audit.mjs`, not `lighthouse_audit`.

## The multi-tenant manifest

Middleware matchers exclude dotted paths, so `/manifest.webmanifest` never carries the tenant or
locale headers. The route resolves the host itself:

```ts
// src/app/manifest.ts
import { headers } from "next/headers"
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host") ?? ""
  const sub = getSubdomainFromHost(host)              // src/lib/root-domain.ts
  const school = sub ? await getSchoolBySubdomain(sub) : null
  const lang = school?.preferredLanguage ?? "ar"      // "ar" | "en"
  return {
    name: lang === "ar" ? school?.name : school?.nameEn, short_name: …, lang, dir: lang === "ar" ? "rtl" : "ltr",
    start_url: "/", scope: "/", display: "standalone",
    theme_color: school?.branding?.primaryColor ?? "#3b82f6",
    icons: [house192maskable, house512any, ...(school?.logoUrl ? [{ src: school.logoUrl, sizes: "any", type: "image/png" }] : [])],
  }
}
```

Reading `headers()` makes the route dynamic — fine on an always-on container; on a Worker it is
one more invocation per install check. Arabic-default products set `lang: "ar"`, `dir: "rtl"` —
never `dir: "auto"`.

## Service worker rules

Hand-rolled, not Serwist, for large apps on thin networks: Serwist precaches the whole
`_next/static` tree (hogwarts is 31.6 MB gzipped), and a framework swap discards the
outbox-wake `sync`/`message` handlers. Serwist (`@serwist/turbopack`, `createSerwistRoute`,
`/serwist/sw.js`) is the right answer for a small greenfield app.

1. **Version every cache name** (`app-static-v3`); `activate` deletes everything else.
2. **Precache only public, locale-explicit, non-redirecting URLs.** `/ar/offline`, never
   `/offline` — a 307 stores `redirected: true`, which the browser refuses for navigations. Harvest
   the offline page's `_next/static` chunks after `addAll` so it renders on a cold device.
3. **Navigations: network-first, no `cache.put`.** Fallback = the offline page for the request's
   locale prefix. Caching HTML keys nothing on the user; a shared device replays another
   account's dashboard.
4. **`/api/`: network-only.** The outbox reads IndexedDB, not the cache. Signed media tickets
   and the sync endpoint must never be cached (an expired URL, a lie about what landed).
5. **Static assets: cache-first** on the hashed `/_next/static` paths and fonts; cap the cache
   (trim to the newest ~150 entries) or phones accumulate every deploy's chunks.
6. **Cross-origin and Range requests go straight to the network** — partial responses must not be
   cached whole.
7. **Push handler reads JSON** `{ title, body, url, tag, icon }`; `notificationclick` focuses a
   client already on that origin or `openWindow(url)`. Icons it names must exist.
8. **Registration is production-gated**; provide an env escape hatch for local `next start`.

Domain rule: `next-16/sw-no-authenticated-cache` (severity high) auto-loads when the worker file
is touched.

## Offline writes: the outbox

`src/lib/offline/db.ts` (IndexedDB, one `outbox` store) · `outbox.ts` (enqueue, coalesce,
backoff, drain to `/api/offline/sync`) · `hooks.ts` (`useOnlineStatus`, `useOutbox`). Every
kind is idempotent on a natural key server-side and returns `applied | duplicate | rejected`;
a `coalesceKey` lets a newer sample replace a pending one. Adding a kind = union the type, add
the payload schema and the `case` in the sync route, extract a `*Core` function from the online
action so both paths share the authorization and validation. The route has `userId` + `schoolId`
only — fetch the role if the core needs it. Replayed writes fire their side effects (guardian
notifications) at drain time; that is correct and should be written down in the block record.

## Web Push lane

`PushSubscription { schoolId, userId, endpoint @unique, p256dh, auth, userAgent?, lastSeenAt,
failedAt? }`. Server: `web-push` + VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` inlined; private key and
`mailto:` subject as deploy-lane secrets). Processor pulls `channels has push AND pushSent = false`,
sends per subscription, deletes on 404/410, marks the row; it runs on the existing push cron beside
the FCM scaffold, which stays a no-op until `firebase-admin` is wanted for a native app. Client
subscribes on a user gesture from the preferences page with `userVisibleOnly: true`. Strings through
the dictionaries.

## Verification recipe

1. `pwa-audit.mjs <tenant-url> --sw /service-worker.js` → 0 FAIL (Arabic `name`, `dir: rtl`,
   every icon 200, no redirecting precache entry, theme-color meta).
2. Browser: `navigator.serviceWorker.controller` non-null after one reload; emulate offline and
   navigate → the locale-correct offline page.
3. Outbox: write offline → banner shows pending → reconnect → drained; replay → `duplicate`.
4. Push: subscribe → insert one Notification with `channels: [push]` → hit the cron → the
   notification shows and its click deep-links to the tenant route; a bogus endpoint is deleted.

## Handoff

`nextjs` for route conventions · `performance` for what precaching does to the bundle budget ·
`quality` when the audit runs inside `/handover` · `cloudflare` for statics/headers on the
container lane · `internationalization` for the manifest's per-locale copy.
