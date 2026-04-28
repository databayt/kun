# Hogwarts — Educational Automation

> **Flagship product. Top priority. Active daily.**

---

## Overview

| Field | Value |
|-------|-------|
| **Repo** | [databayt/hogwarts](https://github.com/databayt/hogwarts) |
| **URL** | [ed.databayt.org](https://ed.databayt.org) |
| **Language** | TypeScript |
| **License** | SSPL-1.0 |
| **Size** | 1.7 GB |
| **Stars** | 11 |
| **Forks** | 8 |
| **Open Issues** | 28 |
| **Created** | 2025-08-08 |
| **Last Push** | 2026-03-30 (daily commits) |

---

## What It Does

Hogwarts is a multi-tenant SaaS platform that automates school operations — from student admission to grade reporting, timetable scheduling, library management, and financial tracking. Think "Schoology meets Stripe" with Arabic-first RTL support.

### Core Modules

| Module | Status | Description |
|--------|--------|-------------|
| **Admission** | Active (QA phase) | Application forms, enrollment workflow, document management |
| **LMS** | Built | Learning management, assignments, grading |
| **SIS** | Built | Student information system, records, transcripts |
| **Finance** | Built | Tuition billing, payment tracking, Stripe integration |
| **Library** | Built | Book catalog, borrowing, returns |
| **Exams** | Built | Exam scheduling, grading, report cards |
| **Timetable** | Built | Class scheduling, room allocation |
| **SMS/Notifications** | In progress | Twilio, push notifications, in-app messaging |
| **Catalog** | Active | School catalog with slug URLs, sections |
| **Teacher Portal** | Active | Wizard onboarding, class management |
| **Calendar** | Built | School events, academic calendar |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1, React 19.2.0 |
| Language | TypeScript 5.8 |
| Database | Prisma 6.19 + Neon |
| Auth | NextAuth v5 beta 30 |
| Payments | Stripe 20 |
| Monitoring | Sentry 10 |
| Real-time | Socket.io |
| i18n | i18next (Arabic/English) |
| Maps | Mapbox, Leaflet |
| Email | Resend |
| SMS | Twilio |
| Storage | AWS S3 + CloudFront |
| Cache | Upstash Redis |
| Rate Limiting | Upstash Ratelimit |
| AI | Anthropic SDK, Groq, OpenAI (AI SDK) |
| Editor | TipTap |
| Charts | Chart.js, Recharts |
| PDF | react-pdf |
| Spreadsheet | xlsx, papaparse |
| Animations | Framer Motion |
| Testing | Vitest + Playwright |
| Docs | fumadocs |

---

## Revenue Model

- **SaaS subscriptions**: Per-school monthly pricing
- **Tiers**: Basic (admission + SIS), Standard (+ LMS + finance), Premium (full suite)
- **Billing**: Stripe recurring, with Schematic for feature flags

---

## Current Pipeline

## Pilot Customer

- **Profile**: Interested school client
- **Interest**: Admission block + notifications + messaging
- **Potential**: May expand to full SaaS over time
- **Priority**: First paying customer opportunity

---

## Recent Activity (2026-03-30)

```
23838d8 fix: admission handover QA - select controlled mode, enum labels, i18n translations
b9cf9bc feat: teacher wizard i18n, onboarding refinements, catalog sections, mapbox
c9f945f feat: admission actions enhancement, application form refinements
3d7a9f9 feat: application forms, admission tables, exams, login, calendar, i18n
4fe0681 feat: catalog slug URLs, settings i18n, timetable structures
```

Very active — multiple commits per day. Primary development focus.

---

## Architecture

- **Multi-tenant**: Each school is a tenant with isolated data
- **SSPL License**: Self-hosting free, commercial SaaS requires license
- **CI/CD**: PR Check + CodeQL workflows
- **Component hierarchy**: ui → atom → template → block
- **i18n**: Arabic RTL default, English LTR

---

## iOS Companion

The [swift-app](./swift-app.md) repository is the native iOS companion for Hogwarts, built with Swift 6/SwiftUI, following the same module structure.

---

## What Kun Does for Hogwarts

- Coordinates daily development via agents and skills
- Manages admission block QA (/handover)
- Handles deployment to Vercel
- Monitors errors via Sentry MCP
- Tracks issues on GitHub
- Plans feature development across team members
