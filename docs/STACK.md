# Stack

The unified technology stack across all Databayt repositories.

---

## Canonical Stack

Every web product targets this stack. Deviations are tracked as alignment debt.

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.1 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.9 |
| Styling | Tailwind CSS | 4 |
| Database | Prisma + Neon (PostgreSQL) | 6.19 |
| Auth | NextAuth (Auth.js) | v5 beta 30 |
| Payments | Stripe | 20 |
| Monitoring | Sentry | 10 |
| Cache | Upstash Redis | — |
| Email | Resend | — |
| Animations | Framer Motion | — |
| Testing | Vitest + Playwright | — |
| Deployment | Vercel | — |
| Docs | fumadocs (MDX) | — |
| Font | Geist | — |
| Package Manager | pnpm | — |

---

## UI Pipeline

Components flow through four layers before reaching products:

```
radix (accessible primitives)
  → shadcn (styled components, 54 primitives)
    → codebase (atoms + templates, 62 atoms / 31 templates)
      → products (hogwarts, mkan, souq, shifa)
```

| Layer | Repo | Count | Description |
|-------|------|-------|-------------|
| Primitives | `databayt/radix` | ~30 | Unstyled, accessible (Dialog, Popover, Select, Tabs) |
| Components | `databayt/shadcn` | 54 | Styled with Tailwind (Button, Card, Table, Input) |
| Atoms | `databayt/codebase` | 62 | 2+ primitives composed (DataTable, Forms, Cards) |
| Templates | `databayt/codebase` | 31 | Full-page layouts (Dashboard, Settings, Auth) |

Both radix and shadcn are forks of their upstream repos, customized for Arabic RTL support and Databayt design tokens.

---

## State Management

| Library | Used In | Purpose |
|---------|---------|---------|
| Jotai | kun, shifa | Atomic state, default choice |
| Zustand | mkan | Store-based state |
| Redux Toolkit | souq | Legacy — alignment debt |

**Standard**: Jotai for new projects. Zustand acceptable. Redux is alignment debt.

---

## Version Matrix

Exact versions per repository as of March 2026.

| Repo | Next.js | React | TypeScript | Prisma | Auth |
|------|---------|-------|-----------|--------|------|
| **hogwarts** | 16.2.1 | 19.2.0 | 5.8 | 6.19 | NextAuth v5 beta 30 |
| **codebase** | 16.1.1 | 19.2.3 | 5.9 | 6.19 | NextAuth v5 beta 29 |
| **kun** | 16.1.1 | 19.2.3 | 5.9 | — | — |
| **marketing** | 16.1.1 | 19.2.3 | 5.9 | 7.2.0 | NextAuth v5 beta 29 |
| **mkan** | 16.1.6 | 19 | 5 | 6.9 | NextAuth v5 beta 25 |
| **shifa** | 16.1.0 | 19.2 | 5.9 | 6.3 | NextAuth v5 beta 25 |
| **souq** | 15.3.8 | 19 | — | 6.16 | Clerk |

---

## Per-Repo Extras

Technologies used by specific repos beyond the canonical stack.

### Hogwarts (Education SaaS)

| Category | Technology |
|----------|-----------|
| Real-time | Socket.io |
| i18n | i18next |
| Maps | Mapbox, Leaflet |
| SMS | Twilio |
| Storage | AWS S3 + CloudFront |
| AI | Anthropic SDK, Groq, OpenAI (AI SDK) |
| Editor | TipTap |
| Charts | Chart.js, Recharts |
| PDF | react-pdf |
| Spreadsheet | xlsx, papaparse |
| Rate Limiting | Upstash Ratelimit |

### Codebase (Pattern Library)

| Category | Technology |
|----------|-----------|
| Tables | @tanstack/react-table, react-virtual |
| DnD | @dnd-kit |
| Command | cmdk |
| Carousel | embla-carousel |
| Drawer | vaul |
| OTP | input-otp |
| Toast | sonner |
| Charts | Recharts |
| PDF | react-pdf, puppeteer |
| AI | Anthropic SDK, Groq, OpenAI |

### Mkan (Rental Marketplace)

| Category | Technology |
|----------|-----------|
| Maps | Mapbox, Leaflet |
| Upload | FilePond |
| PDF | react-pdf |
| State | Zustand |

### Shifa (Medical Platform)

| Category | Technology |
|----------|-----------|
| Tables | @tanstack/react-table |
| Images | ImageKit |
| Charts | Recharts |
| Drawer | vaul |
| Toast | sonner |

### Marketing (Landing Pages)

| Category | Technology |
|----------|-----------|
| Animations | Rive, Framer Motion |
| Images | ImageKit |
| AI | Groq (AI SDK) |

### Souq (E-Commerce)

| Category | Technology |
|----------|-----------|
| Auth | Clerk (divergent) |
| State | Redux Toolkit (divergent) |
| Background Jobs | Inngest |
| Webhooks | Svix |
| API Docs | Swagger |
| Charts | Recharts |

---

## Non-Web Stacks

### Swift App (iOS)

| Layer | Technology |
|-------|-----------|
| Language | Swift 6 |
| UI | SwiftUI |
| Data | SwiftData (offline-first) |
| Min Target | iOS 18+ |
| Architecture | MVVM + Clean Architecture |
| i18n | Arabic RTL default, English LTR |

Component hierarchy mirrors web: `UI → Atom → Feature → Screen`

### Distributed Computer (R&D)

| Layer | Technology |
|-------|-----------|
| Language | Rust |
| Networking | libp2p |
| Discovery | DHT |

Prototype stage. Not active.

---

## Stack Alignment

### Aligned

All active web repos share: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 6, NextAuth v5, Vercel deployment.

### Debt

| Repo | Issue | Fix |
|------|-------|-----|
| **souq** | Clerk instead of NextAuth | Migrate to NextAuth v5 |
| **souq** | Redux Toolkit instead of Jotai | Migrate to Jotai or Zustand |
| **souq** | Next.js 15 instead of 16 | Upgrade to Next.js 16 |
| **marketing** | Prisma 7.2 (ahead of others) | Align with Prisma 6.19 or upgrade all |
| **mkan** | Prisma 6.9 (behind) | Upgrade to 6.19 |
| **shifa** | Prisma 6.3 (behind) | Upgrade to 6.19 |
| **mkan** | NextAuth beta 25 (behind) | Upgrade to beta 30 |
| **shifa** | NextAuth beta 25 (behind) | Upgrade to beta 30 |

### Alignment Priority

1. **Souq** — Most divergent. Low priority since product is paused.
2. **Mkan/Shifa** — Minor version drift. Upgrade during next active sprint.
3. **Marketing** — Prisma 7.2 anomaly. Verify intentional or downgrade.

---

## i18n

All products support bilingual operation:

| Aspect | Standard |
|--------|----------|
| Default language | Arabic (RTL) |
| Secondary language | English (LTR) |
| Direction | RTL-first design, LTR as override |
| Library | i18next (Hogwarts), built-in (others) |
| URL structure | `/[lang]/...` (ar, en) |

---

## Infrastructure

| Service | Purpose | Products |
|---------|---------|----------|
| **Vercel** | Hosting, edge functions, preview deploys | All web |
| **Neon** | Serverless PostgreSQL | hogwarts, mkan, shifa |
| **Upstash** | Redis cache, rate limiting | hogwarts, souq, mkan |
| **Stripe** | Payments, subscriptions | hogwarts, souq, shifa |
| **Sentry** | Error monitoring | hogwarts, mkan |
| **Resend** | Transactional email | hogwarts, souq, mkan |
| **AWS S3** | File storage (CloudFront CDN) | hogwarts |
| **ImageKit** | Image optimization | shifa, marketing |
| **Twilio** | SMS notifications | hogwarts |
| **Mapbox/Leaflet** | Maps and geolocation | hogwarts, mkan |

---

## MCP Servers

Kun integrates 18 MCP servers that bridge the stack with external tools:

| MCP | Stack Connection |
|-----|-----------------|
| shadcn | UI component registry |
| github | Version control, PRs, issues |
| vercel | Deployment and previews |
| neon | Database management |
| stripe | Payment operations |
| figma | Design-to-code |
| sentry | Error monitoring |
| browser | E2E testing (Playwright) |

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
