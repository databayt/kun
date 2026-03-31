# Souq — Multi-Vendor E-Commerce

> **MVP complete. Low priority. Waiting for product-market fit.**

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/souq](https://github.com/databayt/souq) |
| **URL** | [souq-smoky.vercel.app](https://souq-smoky.vercel.app) |
| **Language** | JavaScript |
| **License** | MIT |
| **Size** | 19 MB |
| **Created** | 2025-12-21 |
| **Last Push** | 2025-12-21 |

---

## What It Does

Souq (سوق — Arabic for "market") is a multi-vendor e-commerce platform. Originally "Alwathba Coop" — a cooperative marketplace model.

### Features

| Feature | Status |
|---------|--------|
| Multi-vendor architecture | Built |
| Customer storefront | Built |
| Vendor dashboards | Built |
| Admin panel | Built |
| Stripe payments | Built |
| Product catalog | Built |
| Order management | Built |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.3.8, React 19 |
| Database | Prisma 6.16 |
| Auth | Clerk (differs from other products) |
| State | Redux Toolkit |
| Payments | Stripe 18 |
| Background Jobs | Inngest |
| Charts | Recharts |
| Email | Resend |
| Cache | Upstash |
| Webhooks | Svix |
| API Docs | Swagger |
| Testing | Vitest |

### Stack Differences

Note: Souq uses **Clerk** for auth (not NextAuth) and **Redux Toolkit** for state (not Zustand/Jotai). It's also on **Next.js 15** (not 16). These differences suggest it was built from a different starter or template.

---

## Recent Activity

```
f2c4363 Update to Next.js 15.3.8 (security patch)
6a2612a Trigger Vercel deploy
72da9cd Update Next.js to 16.1.0 for security fix
34143be Fix product loading and optimize images
fb428b7 Merge pull request #1 from abdout/improve
```

Last active December 2025. Maintenance only.

---

## What Kun Does for Souq

- References souq patterns for e-commerce workflows (cart, vendor dashboard)
- Available for reactivation when market opportunity arises
- Stack alignment needed if reactivated (migrate Clerk → NextAuth, Redux → Zustand)
