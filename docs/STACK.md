# Stack

The unified technology stack across all Databayt repositories.

---

## Canonical Stack

Every web product targets this stack. Deviations are tracked as alignment debt.

| Layer           | Technology                    | Version                                                                                                                                                                              |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework       | Next.js                       | 16.3 (Active LTS; the 16.2 line is end-of-life) — **security: ≥16.3.6 now, 16.3.7 on 2026-09-30**; agent-native: managed `nextjs-agent-rules` block, bundled docs, next-devtools-mcp |
| UI Library      | React                         | 19.2 in products — 19.3.0 latest (ViewTransition, Fragment refs, `<Context>` in RSC)                                                                                                 |
| Language        | TypeScript                    | 5.9–6.0 in products — 7.0.2 is npm `latest` and Next 16.3 builds with it; the blocker is lint/MDX tooling (typescript-eslint needs the `@typescript/typescript6` alias)              |
| Styling         | Tailwind CSS                  | 4.3.3 (no release since 07-16; Tailwind Labs joined Shopify 09-09, stays MIT) — hogwarts still resolves 4.1.11 (no `inset-s-*`)                                                      |
| Database        | Prisma + Neon (PostgreSQL)    | Prisma 7.8–7.10 and 6.19 (security patches only until **2026-11-19**); npm `latest` is the v8 RC — pin the CLI major, never bare `npx prisma`                                        |
| Auth            | NextAuth (Auth.js)            | v5 beta 30                                                                                                                                                                           |
| Payments        | Stripe                        | 20                                                                                                                                                                                   |
| Monitoring      | Sentry                        | 10                                                                                                                                                                                   |
| Cache           | Upstash Redis                 | —                                                                                                                                                                                    |
| Email           | Resend                        | —                                                                                                                                                                                    |
| Animations      | Motion (Framer Motion) + GSAP | Motion 12 for UI; GSAP 3.15 + `@gsap/react` on marketing pages (hogwarts) — free incl. all plugins since 3.13                                                                        |
| Testing         | Vitest + Playwright           | —                                                                                                                                                                                    |
| Deployment      | Cloudflare                    | Containers (hogwarts, mkan, kun, marketing, codebase) + containerless Workers (co on OpenNext; vinext sites; thmanyah static) — Vercel is legacy                                     |
| Docs            | fumadocs (MDX)                | —                                                                                                                                                                                    |
| Font            | Geist                         | —                                                                                                                                                                                    |
| Package Manager | pnpm                          | —                                                                                                                                                                                    |

---

## UI Pipeline

Components flow through four layers before reaching products:

```
radix (accessible primitives)
  → shadcn (styled components, 54 primitives)
    → codebase (atoms + templates, 62 atoms / 31 templates)
      → products (hogwarts, mkan, souq, shifa)
```

| Layer      | Repo                | Count | Description                                          |
| ---------- | ------------------- | ----- | ---------------------------------------------------- |
| Primitives | `databayt/radix`    | ~30   | Unstyled, accessible (Dialog, Popover, Select, Tabs) |
| Components | `databayt/shadcn`   | 54    | Styled with Tailwind (Button, Card, Table, Input)    |
| Atoms      | `databayt/codebase` | 62    | 2+ primitives composed (DataTable, Forms, Cards)     |
| Templates  | `databayt/codebase` | 31    | Full-page layouts (Dashboard, Settings, Auth)        |

Both radix and shadcn are forks of their upstream repos, customized for Arabic RTL support and Databayt design tokens.

> **Upstream shift (Jul 2026)**: shadcn/ui now defaults to **Base UI**; Radix is behind a `-b radix` CLI flag. Databayt stays on the Radix fork lineage until a `/decide` settles Base-UI-vs-Radix — it affects the radix fork, codebase atoms, and the shadcn skill pack.

---

## State Management

| Library       | Used In    | Purpose                      |
| ------------- | ---------- | ---------------------------- |
| Jotai         | kun, shifa | Atomic state, default choice |
| Zustand       | mkan       | Store-based state            |
| Redux Toolkit | souq       | Legacy — alignment debt      |

**Standard**: Jotai for new projects. Zustand acceptable. Redux is alignment debt.

---

## Version Matrix

Installed versions as of 2026-09-26 (read from each repo's `node_modules`, not package.json ranges; spot-refreshed by `/sync`, full audit via `/package`).

| Repo          | Next.js   | React  | TypeScript | Prisma | Tailwind | Auth                |
| ------------- | --------- | ------ | ---------- | ------ | -------- | ------------------- |
| **hogwarts**  | 16.3.4 ⚠️ | 19.2.8 | 5.8.3      | 6.19.0 | 4.1.11   | NextAuth v5 beta 30 |
| **codebase**  | 16.2.4 ⚠️ | 19.2.5 | 5.9.3      | 6.19.3 | 4.3.3    | NextAuth v5 beta 31 |
| **kun**       | 16.2.2 ⚠️ | 19.2.4 | 6.0.2      | 7.9.0  | 4.2.2    | NextAuth v5 beta 30 |
| **marketing** | 16.1.1 ⚠️ | 19.2.3 | 5.9.3      | 7.2.0  | 4.1.12   | NextAuth v5 beta 29 |
| **mkan**      | 16.2.4 ⚠️ | 19.2.5 | 6.0.3      | 7.8.0  | 4.2.4    | NextAuth v5 beta 31 |
| **shifa**     | 16.1.1 ⚠️ | 19.2.3 | 5.9.3      | 6.19.1 | 4.1.18   | NextAuth v5 beta 25 |
| **souq**      | 15.3.8 ⚠️ | 19.2.3 | —          | 6.19.1 | 4.1.18   | Clerk               |

⚠️ = below the current security floor (16.3.6 / 15.5.24): the Aug AVIF Image-Optimizer RCE (<16.3.3) and the Sep `next/og` ImageResponse RCE (≥16.2, <16.3.6); 16.3.7 / 15.5.27 ship 2026-09-30 with nine more fixes. hogwarts is past the AVIF fix and its og routes run on Edge (not affected), but it still takes 16.3.7.

---

## Per-Repo Extras

Technologies used by specific repos beyond the canonical stack.

### Hogwarts (Education SaaS)

| Category      | Technology                           |
| ------------- | ------------------------------------ |
| Real-time     | Socket.io                            |
| i18n          | i18next                              |
| Maps          | Mapbox, Leaflet                      |
| SMS           | Twilio                               |
| Storage       | AWS S3 + CloudFront                  |
| AI            | Anthropic SDK, Groq, OpenAI (AI SDK) |
| Editor        | TipTap                               |
| Charts        | Chart.js, Recharts                   |
| PDF           | react-pdf                            |
| Spreadsheet   | xlsx, papaparse                      |
| Rate Limiting | Upstash Ratelimit                    |

### Codebase (Pattern Library)

| Category | Technology                           |
| -------- | ------------------------------------ |
| Tables   | @tanstack/react-table, react-virtual |
| DnD      | @dnd-kit                             |
| Command  | cmdk                                 |
| Carousel | embla-carousel                       |
| Drawer   | vaul                                 |
| OTP      | input-otp                            |
| Toast    | sonner                               |
| Charts   | Recharts                             |
| PDF      | react-pdf, puppeteer                 |
| AI       | Anthropic SDK, Groq, OpenAI          |

### Mkan (Rental Marketplace)

| Category | Technology      |
| -------- | --------------- |
| Maps     | Mapbox, Leaflet |
| Upload   | FilePond        |
| PDF      | react-pdf       |
| State    | Zustand         |

### Shifa (Medical Platform)

| Category | Technology            |
| -------- | --------------------- |
| Tables   | @tanstack/react-table |
| Images   | ImageKit              |
| Charts   | Recharts              |
| Drawer   | vaul                  |
| Toast    | sonner                |

### Marketing (Landing Pages)

| Category   | Technology          |
| ---------- | ------------------- |
| Animations | Rive, Framer Motion |
| Images     | ImageKit            |
| AI         | Groq (AI SDK)       |

### Souq (E-Commerce)

| Category        | Technology                |
| --------------- | ------------------------- |
| Auth            | Clerk (divergent)         |
| State           | Redux Toolkit (divergent) |
| Background Jobs | Inngest                   |
| Webhooks        | Svix                      |
| API Docs        | Swagger                   |
| Charts          | Recharts                  |

---

## Non-Web Stacks

### Swift App (iOS)

| Layer        | Technology                      |
| ------------ | ------------------------------- |
| Language     | Swift 6                         |
| UI           | SwiftUI                         |
| Data         | SwiftData (offline-first)       |
| Min Target   | iOS 18+                         |
| Architecture | MVVM + Clean Architecture       |
| i18n         | Arabic RTL default, English LTR |

Component hierarchy mirrors web: `UI → Atom → Feature → Screen`

### Distributed Computer (R&D)

| Layer      | Technology |
| ---------- | ---------- |
| Language   | Rust       |
| Networking | libp2p     |
| Discovery  | DHT        |

Prototype stage. Not active.

---

## Stack Alignment

### Aligned

All active web repos share: Next.js 16 (souq: 15), React 19.2, Tailwind CSS 4, NextAuth v5 (souq: Clerk), Neon, Cloudflare deployment.

### Debt

| Repo                                | Issue                                        | Fix                                                      |
| ----------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **every repo**                      | Next.js below the security floor             | → 16.3.6 now; every repo → 16.3.7 on 09-30               |
| **hogwarts, codebase, shifa, souq** | Prisma 6 — security patches end 2026-11-19   | `/decide` + `/package` → 7.10 (not v8 until GA + parity) |
| **hogwarts**                        | Tailwind 4.1.11                              | Bump to 4.3.3 (unlocks `inset-s-*`, `scrollbar-*`)       |
| **souq**                            | Next.js 15.3 (15.5 is the only patched 15.x) | → 15.5.27 or retire                                      |
| **souq**                            | Clerk instead of NextAuth                    | Migrate to NextAuth v5                                   |
| **souq**                            | Redux Toolkit instead of Jotai               | Migrate to Jotai or Zustand                              |
| **shifa**                           | NextAuth beta 25 (behind)                    | Upgrade to beta 30+                                      |

### Alignment Priority

0. **Security** — the Next.js patch train above; it outranks everything else on this page.
1. **Prisma 6 end-of-life** — hogwarts first (the win horse), before 2026-11-19.
2. **Souq** — most divergent; low priority while the product is paused.
3. **Shifa** — minor drift; upgrade during the next active sprint.

---

## i18n

All products support bilingual operation:

| Aspect             | Standard                              |
| ------------------ | ------------------------------------- |
| Default language   | Arabic (RTL)                          |
| Secondary language | English (LTR)                         |
| Direction          | RTL-first design, LTR as override     |
| Library            | i18next (Hogwarts), built-in (others) |
| URL structure      | `/[lang]/...` (ar, en)                |

---

## Infrastructure

| Service            | Purpose                                             | Products                                                                                                        |
| ------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Cloudflare**     | Hosting (Workers + Containers), DNS, crons          | hogwarts, mkan, kun, marketing, codebase (Containers); co, mazin, nmbd, satellites (Workers); thmanyah (static) |
| **Vercel**         | Legacy — free team paused, Pro team billing-blocked | nothing live                                                                                                    |
| **Neon**           | Serverless PostgreSQL                               | hogwarts, mkan, shifa, kun, marketing                                                                           |
| **Upstash**        | Redis cache, rate limiting                          | hogwarts, souq, mkan                                                                                            |
| **Stripe**         | Payments, subscriptions                             | hogwarts, souq, shifa                                                                                           |
| **Sentry**         | Error monitoring                                    | hogwarts, mkan                                                                                                  |
| **Resend**         | Transactional email                                 | hogwarts, souq, mkan                                                                                            |
| **AWS S3**         | File storage (CloudFront CDN)                       | hogwarts                                                                                                        |
| **ImageKit**       | Image optimization                                  | shifa, marketing                                                                                                |
| **Twilio**         | SMS notifications                                   | hogwarts                                                                                                        |
| **Mapbox/Leaflet** | Maps and geolocation                                | hogwarts, mkan                                                                                                  |

---

## MCP Servers

The declared fleet lives in `.claude/mcp.json` (count: `engine.json → counts.project_mcp`); the live registry is `~/.claude.json`. Stack-relevant servers:

| MCP                       | Stack Connection                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------- |
| shadcn                    | UI component registry (`npx shadcn@latest mcp`)                                     |
| github                    | Version control, issues                                                             |
| cloudflare-docs           | Cloudflare docs (Code Mode API + observability servers: pending a decision)         |
| Neon                      | Database management — dev/test only per Neon; prod writes go through the `neon` CLI |
| stripe                    | Payment operations                                                                  |
| figma                     | Design-to-code (Starter: 20 calls/month total)                                      |
| sentry                    | Error monitoring                                                                    |
| browser / chrome-devtools | E2E testing (Playwright), performance traces                                        |
| context7 / ref            | Current library docs                                                                |

`wrangler` and `vercel` are CLIs, not MCP servers — deploys run through `scripts/deploy-cloudflare.sh` and the `deploy` skill.

---

## Upgrade Path

When upgrading across repos, follow dependency order:

```
1. radix (primitives — upstream sync)
2. shadcn (components — upstream sync + RTL patches)
3. codebase (atoms/templates — test compatibility)
4. kun (configuration — update version references)
5. products (hogwarts → mkan → shifa → souq)
```

Hogwarts first — it's the flagship and most actively tested. Marketing follows codebase since it shares the same base.
