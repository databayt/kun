# Workflows: Kun (كن)

> **Version**: 2.0
> **Date**: 2026-03-30
> **Purpose**: How Kun runs Databayt's technical and business operations

---

## 1. Technical Workflows

### 1.1 Feature Development

```
Keyword: "saas billing" or "table users" or "auth"

┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│ Keyword  │────▶│ Orchestration│────▶│ Agent(s) │────▶│ Output   │
│ detected │     │ agent routes │     │ execute  │     │ code     │
└──────────┘     └──────────────┘     └──────────┘     └──────────┘
```

**Example: "saas billing" for Hogwarts**
1. Orchestration routes to: prisma → block → stripe MCP
2. Generates: schema + server actions + UI + Stripe setup
3. Applies: prisma rules (schoolId), auth rules, tailwind rules
4. Output: Complete billing feature scoped to school tenant

### 1.2 Dev Server

```
"dev" → Kill port 3000 → pnpm dev → Open Chrome → Auto-format on save
```

### 1.3 Build & Validate

```
"build" → pnpm build → Scan errors → Auto-fix → Re-build → Report
```

### 1.4 Commit & Push

```
"push" → Lint → Fix → git add → Conventional commit → Push → Verify
```

### 1.5 Deployment

```
"deploy" → Build → Vercel deploy → Poll status → Retry (max 5) → Report URL
```

### 1.6 Testing

```
"test [target]" → Analyze code → Generate Vitest + Playwright → Run → Report
```

### 1.7 Handover QA

```
"handover [block]"

Pass 1: Bug-free — navigate everything, check console
Pass 2: Flow — complete user journeys, data persistence
Pass 3: Responsive — 375px, 768px, 1440px
Pass 4: RTL + i18n — Arabic layout mirrors, no LTR remnants
Pass 5: Translation — no hardcoded English, no missing keys

Environments: demo.localhost:3000 AND demo.databayt.org
Tool: Playwright MCP browser-headed
Loop: Fix → re-test until clean
```

### 1.8 Security & Performance

```
"security" → OWASP Top 10 + dependency scan + secrets check + report
"performance" → Core Web Vitals + bundle + DB queries + report
```

---

## 2. Component Creation Workflows

### 2.1 Atom

```
"atom [name]" → Check codebase → Select primitives → Create → Style (RTL) → Type → Register
```

### 2.2 Template

```
"template [name]" → Check registry → Design layout → Create → Mobile-first → Register
```

### 2.3 Block

```
"block [name]" → Check codebase → Design UI + logic → Create + actions + schema → Quality score → Register
```

### 2.4 SaaS Feature

```
"saas [feature]" → Schema → Actions → Components → Pages → Auth → i18n → Tests
```

---

## 3. Hogwarts Pilot Workflows

### 3.1 Admission Block Development

```
Developer (Osman):
  > "handover admission"
  1. Navigate admission pages (forms, tables, detail views)
  2. Test enrollment workflow end-to-end
  3. Verify at 375px, 768px, 1440px
  4. Check Arabic RTL layout
  5. Scan for missing translations
  6. Fix → re-test until clean
  7. Deploy to ed.databayt.org
```

### 3.2 King Fahad Schools Onboarding

```
Business (Ali):
  > Cowork: "Create onboarding plan for King Fahad Schools"
  1. Generate school tenant configuration checklist
  2. Draft welcome email (Arabic)
  3. Create admin account setup guide
  4. List training session agenda

Content (Samia):
  > Cowork: "Write Arabic user guide for school admission system"
  1. Generate step-by-step walkthrough
  2. Include screenshots
  3. Record voiceover for video guide
```

### 3.3 Pilot Monitoring

```
Kun (Scheduled):
  Daily: Check ed.databayt.org health (Vercel + Sentry)
  Daily: Review Hogwarts GitHub issues
  Weekly: Generate pilot status report
```

---

## 4. Team Workflows

### 4.1 Osman Abdout (Engineering)

```
Daily:
  $ claude                        # Open CLI on MacBook
  > "dev"                         # Start Hogwarts dev server
  > [feature development]         # Build with full agent fleet
  > "build"                       # Validate
  > "push"                        # Commit + push
  > "deploy"                      # Ship to Vercel

  iPhone: Remote Control to monitor long builds
```

### 4.2 Ali Aseel (Business)

```
Daily:
  Claude Desktop (Windows):
  > Cowork: "Summarize this week's Hogwarts progress for client update"
  > Cowork: "Draft proposal for [school name]"
  > Cowork: "Research competitor school platforms in Sudan"

  Android: Claude web for quick checks
```

### 4.3 Samia Hamd (Content & Research)

```
Daily:
  Claude Desktop (Windows, screen reader):
  > Cowork: "Translate these UI strings to Arabic"
  > Cowork: "Research best practices for school notification systems"
  > Cowork: "Write help documentation for the admission module"
  > Cowork: "Review this page for accessibility issues"

  iPhone 13 Mini: VoiceOver for mobile testing
```

### 4.4 Osman Sedon (Engineering, Part-Time)

```
As available:
  Claude Desktop (Windows):
  > "fix"                         # Auto-fix lint/type errors
  > [assigned task]               # Specific feature or bug fix
  > "push"                        # Commit + push
```

---

## 5. Cross-Device Workflows

### 5.1 Start on Desktop, Continue on Phone

```
MacBook (CLI):
  > "Start building the notification system"
  > [work in progress]

iPhone (Remote Control):
  > Monitor session progress
  > Dispatch: "deploy to preview"
```

### 5.2 Design to Code

```
Figma:
  Designer completes new layout

Claude Code:
  > "figma https://figma.com/design/..."
  1. Figma MCP: get_design_context
  2. Map to existing shadcn/ui + atoms from codebase
  3. Generate React + Tailwind (RTL-aware)
  4. Deploy preview
```

---

## 6. Coordination Workflows

### 6.1 Agent Teams (Parallel Development)

```
> "Build settings: profile tab, notifications tab, billing tab"

Lead Agent:
  ├── Agent A (worktree) → Profile form + avatar
  ├── Agent B (worktree) → Notification preferences
  └── Agent C (worktree) → Billing + Stripe

Lead: Merge → Resolve conflicts → Single PR → Tests
```

### 6.2 Scheduled Tasks

```
Cloud (runs even when computers off):
  ├── Daily: Hogwarts health check (ed.databayt.org)
  ├── Daily: Sentry error review
  └── Weekly: Dependency audit (all 14 repos)

Desktop (runs when app open):
  └── Every push: Build validation

In-Session (/loop):
  └── Every 5 min: Poll deployment status
```

### 6.3 Repository Sync

```
Kun monitors all 14 repos:
  ├── hogwarts: daily commits, active monitoring
  ├── codebase: pattern sync when atoms updated
  ├── shadcn/radix: upstream sync when new releases
  └── others: weekly status check
```

---

## 7. Business Workflows

### 7.1 Client Communication

```
Cowork (Ali):
  > "Draft project update for Ahmed Baha"
  1. GitHub MCP: Fetch merged PRs this week
  2. Summarize features + fixes
  3. Draft Arabic email
  4. Output as artifact
```

### 7.2 Financial Tracking

```
Cowork + Stripe MCP:
  > "Monthly revenue and expense report"
  1. Stripe: Fetch subscriptions + transactions
  2. Calculate: Revenue vs. $1K target
  3. List expenses: Claude ($200) + services
  4. Burn rate and runway
```

### 7.3 Content Creation

```
Cowork (Samia):
  > "Write Arabic blog post about school automation benefits"
  1. Research: Best practices, competitor analysis
  2. Draft: Arabic content with English summary
  3. SEO: Keywords, meta descriptions
  4. Output: MDX file for marketing site
```

### 7.4 Competitive Research

```
Cowork (Samia or Ali):
  > "Analyze school management platforms available in Sudan"
  1. Web search: Products, pricing, features
  2. Compare: Feature matrix vs. Hogwarts
  3. Identify: Our differentiators
  4. Output: Report for team review
```

---

## 8. Quick Reference

| I Want To... | Say... | Who |
|-------------|--------|-----|
| Start dev server | "dev" | Osman A. / Sedon |
| Build project | "build" | Osman A. / Sedon |
| Push code | "push" / "quick" | Osman A. / Sedon |
| Deploy | "deploy" / "ship" | Osman A. |
| Create component | "atom/template/block [name]" | Osman A. |
| Generate feature | "saas [feature]" | Osman A. |
| Run tests | "test [target]" | Osman A. / Sedon |
| QA handover | "handover [block]" | Osman A. |
| Fix errors | "fix" | Anyone |
| Generate docs | "docs" | Samia / Osman A. |
| Client update | Cowork | Ali |
| Arabic content | Cowork | Samia |
| Revenue report | Cowork + Stripe MCP | Ali / Kun |
| Research | Cowork + web search | Samia |
