---
domain: next-16
severity: high
paths:
  [
    "public/service-worker.js",
    "public/sw.js",
    "app/sw.ts",
    "src/app/sw.ts",
    "src/app/manifest.ts",
  ]
since: "hogwarts service worker v3, 2026-09-12"
---

# A service worker never caches authenticated pages, and never precaches a redirect

Two failures shipped together in hogwarts v2. Every navigation and every `/api/` GET was `cache.put` into a shared cache keyed only by URL, so a shared school device could serve the previous user's dashboard from cache. And the precache listed `/` and `/offline`, both 307s to the locale prefix: the stored responses carried `redirected: true`, the browser refuses those for navigations, and the offline fallback never worked — silently.

## Good

```js
const STATIC = "app-static-v3";
const PRECACHE = ["/ar/offline", "/en/offline", "/manifest.webmanifest"]; // public, locale-explicit, 200

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // network-only
  if (request.mode === "navigate") {
    const locale = url.pathname.startsWith("/en") ? "en" : "ar";
    e.respondWith(
      fetch(request).catch(() => caches.match(`/${locale}/offline`)),
    ); // no cache.put
    return;
  }
  if (/\/_next\/static\/|\.(png|svg|woff2)$/.test(url.pathname)) {
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
  }
});
```

## Bad

```js
const STATIC_ASSETS = ["/", "/offline"]; // both redirect → stored redirected:true → refused for navigations

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        caches.open("dynamic").then((c) => c.put(e.request, res.clone())); // authed HTML and API JSON, keyed by URL only
        return res;
      })
      .catch(() => caches.match(e.request) ?? caches.match("/offline")),
  );
});
```

## Fix

Precache only public, locale-explicit URLs that answer 200 with `redirect: "manual"`. Treat navigations and `/api/` as network-only with the offline page as the sole navigation fallback. Cache-first only hashed static assets and fonts, with a size cap. Bump the cache name on every change so `activate` evicts the old behaviour. Verify with `~/.claude/skills/pwa/scripts/pwa-audit.mjs <url> --sw /service-worker.js`.
