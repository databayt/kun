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
since: "hogwarts service worker v3, 2026-09-12; namespaced pages v6, 2026-09-13"
---

# A service worker never serves one person's pages to another, and never precaches a redirect

Two failures shipped together in hogwarts v2. Every navigation and every `/api/` GET was `cache.put` into a shared cache keyed only by URL, so a shared school device could serve the previous user's dashboard from cache. And the precache listed `/` and `/offline`, both 307s to the locale prefix: the stored responses carried `redirected: true`, the browser refuses those for navigations, and the offline fallback never worked — silently.

Signed-in pages MAY be cached (hogwarts v6 does, so the dashboard is explorable offline) under one condition: the cache is **namespaced by a session key the server puts on the response**, and a response carrying a different key — or none — deletes every other namespace before anything is served. The key is a truncated HMAC-style hash of the user id (`x-session-key` from the proxy), so the worker never sees a user id and never keys on the URL alone. `/api/` stays network-only regardless: a cached signed-media ticket is an expired URL and a cached sync response is a lie about what landed.

## Good

```js
const STATIC = "app-static-v6";
const PAGES = "app-pages-v6-"; // + session key
const PRECACHE = ["/ar/offline", "/en/offline", "/manifest.webmanifest"]; // public, locale-explicit, 200

async function adopt(key) {
  // a new person (or nobody): the previous person's pages go first
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((n) => n.startsWith(PAGES) && n !== PAGES + key)
      .map((n) => caches.delete(n)),
  );
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // network-only, always
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then(async (res) => {
          const key = res.headers.get("x-session-key"); // set by the proxy
          await adopt(key);
          if (res.ok && key && !res.redirected)
            (await caches.open(PAGES + key)).put(request, res.clone());
          return res;
        })
        .catch(async () => {
          const key = await currentKey(); // read from a meta cache
          const saved =
            key && (await (await caches.open(PAGES + key)).match(request));
          return saved ?? caches.match(offlinePageFor(url.pathname));
        }),
    );
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

Precache only public, locale-explicit URLs that answer 200 with `redirect: "manual"`. Keep `/api/` network-only. Cache signed-in pages only in a namespace named by the server's session-key header, dropping every other namespace the moment a response carries a different key or none; never serve a saved page from any namespace but the current one. When a saved copy is shown because the network was slow rather than gone, tell the page (a message the offline strip renders) — a teacher must not take a saved attendance page for a live one. Cache-first only hashed static assets and fonts, with a size cap. Bump the cache name on every change so `activate` evicts the old behaviour. Verify with `~/.claude/skills/pwa/scripts/pwa-audit.mjs <url> --sw /service-worker.js`, then offline emulation on a signed-in session: an opened page renders, an unopened one gets the offline page, and signing in as someone else empties the previous namespace.
