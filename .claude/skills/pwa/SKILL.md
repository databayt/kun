---
name: pwa
description: Progressive Web App lane — audit installability, build the per-tenant manifest + service worker + offline shell, and wire Web Push on a Next 16 product
when_to_use: "Use when a product should install to a phone's home screen, keep working without a connection, or push notifications through the browser — auditing whether a URL is installable, building or repairing the manifest / service worker / offline page, or adding the Web Push lane (VAPID, subscriptions, the push cron). Distinct from /performance (Core Web Vitals), the `fast` keyword (one URL's speed), /handover (the UI verification pass), and the `notifications` block (in-app + email + WhatsApp delivery — this skill adds the browser channel to it). Triggers on: pwa, progressive web app, installable, add to home screen, install prompt, manifest, service worker, offline, works offline, web push, push notification, تطبيق, بدون إنترنت, إشعارات."
argument-hint: "[audit <url>|build|push] [repo]"
allowed-tools: Bash(node *), Bash(curl *), Bash(pnpm *), Bash(npx *), Bash(git *), Bash(gh *)
model: opus
---

# PWA — installable, offline, push

The web.dev definition: capabilities that enable app experiences, built and deployed on the web.
For databayt that means a teacher's phone with a home-screen icon that opens the school directly,
attendance that survives a dropped connection, and an absence push that reaches a parent — with no
app store, no native build, and no per-platform cost. Cash flow first: the paying pilot runs on
the web app, so the web app is the mobile app.

Platform knowledge (install criteria, iOS limits, caching rules, the Web Push protocol) lives in
the **`pwa` agent** (`.claude/agents/pwa.md`). The canonical file layout is the pattern card
`.claude/patterns/cards/pwa.md`. This skill is the runbook.

## Decision record

| Product  | Verdict   | Why                                                                                                                                                                                                                                          |
| -------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hogwarts | **yes**   | Daily field flows on phones (quick attendance, kiosk, parent portal); a half-broken PWA layer already shipped; the notification model already carries the push columns                                                                       |
| mkan     | **defer** | Guests are one-visit and contact-only; hosts have no real message volume yet. Reopen when host messaging moves; fix `SITE_URL` (mk.databayt.org ≠ mkan.sd), `themeColor`, and dictionary every string (the `i18n:scan-hardcoded` gate) first |

Decided 2026-09-12 under Lean Startup (#13/#15): hypothesis = installed app + offline attendance
raise the share of daily attendance submitted from phones; metric = outbox `applied` rate and
attendance rows per week; review after 4 weeks.

## $ARGUMENTS

### `audit <url>` — is it installable, and does offline actually work?

```bash
node ~/.claude/skills/pwa/scripts/pwa-audit.mjs https://kingfahd.balqalam.com --sw /service-worker.js
```

Zero-dependency Node script. It fetches the page, the manifest, every icon (including shortcut
icons) and the service worker, then checks the Chrome install criteria and the traps below.
`FAIL` exits 1. **Lighthouse 12 removed the PWA category — do not reach for `lighthouse_audit`.**

Then the browser half, on a logged-in session (chrome-devtools MCP or `browser`):

1. `evaluate_script` → `navigator.serviceWorker.controller?.scriptURL` — non-null means the
   worker controls the page. Null on a first load is normal; reload once.
2. `emulate` network offline → navigate to an app route → the **locale-correct offline page**
   must render, not the browser's dinosaur. If the page is a raw error, the precache stored a
   redirect (see gotchas).
3. Install: on Android Chrome the `beforeinstallprompt` event fires after ~30 s of engagement
   and one tap; on iOS Safari there is no event — Share → Add to Home Screen is the only path.

Report the audit table + the three browser results. Nothing in this mode edits code.

### `build [repo]` — the house pattern applied to a product

Read the pattern card first. The order of work:

1. **Icons.** `public/icon-{72,96,192,512}.png` + `apple-touch-icon.png` (180, opaque
   background) generated from the 512 master with `sharp` (already a dep in hogwarts/mkan).
   Every icon the manifest or the worker names must return 200 — HEAD them.
2. **Root layout.** `viewport.themeColor`, `metadata.appleWebApp.capable`,
   `metadata.icons.apple`. Tenant layouts may override `icons` with the school logo.
3. **Manifest** at `src/app/manifest.ts` — `async`, reads `(await headers()).get("host")`,
   resolves the tenant and its language, returns `name`/`short_name`/`lang`/`dir`/`theme_color`
   per tenant. Keep the house 192 (maskable) + 512 (any) PNGs as the required entries; a tenant
   logo is an _extra_ entry. `start_url: "/"` stays relative — the manifest is fetched on the
   tenant origin, so `/` already resolves there. `shortcuts` must be inside `scope`.
4. **Service worker** at `public/service-worker.js` — hand-rolled (see the agent for why not
   Serwist on a 30 MB app over Sudan mobile). Versioned cache names; precache only public,
   locale-explicit, non-redirecting URLs; static assets cache-first with a size cap; navigations
   and `/api/` **network-only** with the offline page as the navigation fallback; push +
   notificationclick handlers that read a JSON payload and deep-link.
5. **Registration provider** mounted once in the locale layout, production-gated, with an
   env escape hatch (`NEXT_PUBLIC_SW_DEV=1`) so `next build && next start` can verify locally.
6. **Offline page** under `[lang]/offline` in the public routes list, holding no server data.
7. **Outbox** (`src/lib/offline/{db,outbox,hooks}.ts` + `/api/offline/sync`) for any write that
   must survive offline — every kind idempotent on a natural key, replay returns `duplicate`.

Gate: `pnpm tsc --noEmit && pnpm build`, then `audit` against `next start` on port 3000.
Bump the worker's cache version on every change to it.

### `push [repo]` — the browser channel on the existing notification rails

Prerequisite: `build` shipped — iOS delivers Web Push only to an installed home-screen app
(16.4+), and Android needs the worker registered.

1. **Model.** `PushSubscription { id, schoolId, userId, endpoint @unique, p256dh, auth,
userAgent?, lastSeenAt, failedAt?, createdAt }` next to the Notification models. Prod DDL goes
   through the `deploy` skill's schema-gap step behind a Neon restore point.
2. **Keys.** `npx web-push generate-vapid-keys` once per product. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   is inlined at build; `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (`mailto:`) are secrets and travel
   the deploy lane's secrets path (`scripts/cf-secrets.sh` on Cloudflare). Central `.env` only.
   Never print or reconstruct a private key.
3. **Processor.** `src/lib/notifications/push-web.ts` — pulls Notifications with
   `channels has push` and `pushSent: false`, sends to every subscription of the recipient with
   `web-push`, deletes subscriptions on 404/410, marks `pushSent/pushSentAt/pushError`. Wired
   into the existing push cron beside the FCM scaffold.
4. **Client.** Subscribe on a user gesture in the notification preferences page:
   `Notification.requestPermission()` → `registration.pushManager.subscribe({ userVisibleOnly:
true, applicationServerKey })` → server action stores it tenant-scoped. Show the iOS
   "install first" hint when `display-mode: standalone` is false on iOS.
5. **Payload.** `{ title, body, url, tag }` — `url` is the tenant origin + the deep link so a tap
   lands on the right school and locale.

Gate: subscribe in Chrome → insert one Notification with `channels: [push]` → hit the cron with
`CRON_SECRET` → the notification shows and its click opens the deep link.

## Gotchas — each one cost real time

- **A precached redirect kills offline silently.** `cache.addAll(["/", "/offline"])` on a
  locale-prefixed app follows the 307 and stores a response with `redirected: true`; the browser
  refuses it for a navigation. Precache `/ar/offline` and `/en/offline`, never the bare path.
- **The manifest bypasses the proxy.** Middleware matchers exclude dotted paths, so
  `/manifest.webmanifest` never gets `x-subdomain` or `x-locale`. Resolve the host yourself.
- **Never cache authenticated HTML or API bodies in the worker.** On a shared school device the
  previous user's dashboard comes back from cache. Rule: `next-16/sw-no-authenticated-cache`.
- **`sizes: "any"` does not satisfy the install check.** Chrome wants explicit 192 and 512 PNGs.
- **Missing statics may 500, not 404.** `cache.addAll` rejects either way; the install fails on
  every device with nothing in the console but a warning.
- **The worker registers only in production.** `next dev` never shows the bug; verify with
  `next build && next start` (or the env escape hatch) or against the demo tenant.
- **Every user-facing string goes through the dictionaries** — install card, offline page,
  permission copy. hogwarts and mkan both gate the build on it.

### Learned executing hogwarts (2026-09-12)

- **`prisma db execute` takes `--url` OR `--schema`, never both.** Local: `--schema prisma
  --file …`; prod: `--url "$DIRECT" --file …`.
- **A running `next dev` keeps the old Prisma client after `prisma generate`.** New models are
  `undefined` on it until restart — verify processors with a tsx probe, not the dev server.
- **tsx cannot import Next-only modules.** `-r ./scripts/_server-only-shim.cjs` stubs
  `server-only`; the hogwarts probe is `scripts/push-web-probe.ts`.
- **No tooling can grant the notification permission.** Headless Chromium reports `denied`;
  headed Chrome shows a bubble nothing can click. Verify the processor with a bogus endpoint
  carrying a **valid P-256 key** (the push service answers 404/410 → prune path), and verify
  device delivery from a real phone after deploy.
- **A bogus `p256dh` fails client-side** ("Public key is not valid for specified curve") — that
  exercises the transient-failure branch, not the prune branch.
- **Custom-domain tenants fall back to the default manifest** (`getSubdomainFromHost` returns
  null for unknown roots). Acceptable until a custom domain ships.
- **zsh does not word-split an unquoted variable** — `git commit -- $PATHS` is one pathspec.
  Write the paths out or use `${=PATHS}`.
- **VAPID values need a durable home.** Vercel refuses env writes under the fair-use block;
  store `cf-<worker>-<VAR>` in the macOS Keychain — `scripts/cf-keychain-env.sh >> <pulled env>`
  appends the whole set before the build (deploy skill step 3). The Worker secret persists; the
  two config vars re-bake every build.
- **A script that prints a secret map on error has already leaked it.** The pre-fix
  `cf-secrets.sh` counter `require()`d a temp file and echoed 26 production secrets into a
  transcript; the rotation cost an evening. Count with `JSON.parse`, never `require`, and treat
  any secret seen in a terminal as burned. The Neon MCP `reset_postgres_role_password` also
  returns the new password into the transcript — the console keeps it off.
- **Ask who requests the channel.** A push lane with no dispatcher asking for `"push"` is a queue
  that never fills; the cron schedule must also route to the processor (`cf/crons.json`).

## After

Update the block records the work touched (`offline`, `attendance`, `notifications`), the
`docs-en`/`docs-ar` mdx, and fold any new trap into this file and the agent.
