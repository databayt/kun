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
Developer (Abdout):
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
QA + Sales (Ali):
  > Test admission flow end-to-end, report issues on GitHub
  > Prepare pitch materials for Ahmed Baha
  > Continue outreach: other schools, sponsors, investors, contributors

R&D (Samia):
  > Research sharing economy pitch framing
  > Study how open-source school solutions position themselves
  > Arabic content for pitch and documentation
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

### 4.1 Abdout — Builder

```
Daily:
  > "dev"                         # Start dev server
  > [feature development]         # Build with full agent fleet
  > "build"                       # Validate
  > "push"                        # Commit + push
  > "deploy"                      # Ship to Vercel
```

### 4.2 Ali — QA Engineer + Sales

```
Daily:
  QA:
  > Test features from URL checklists on GitHub Issues
  > Report bugs as comments (not WhatsApp)
  > Re-verify fixes, check off boxes

  Sales (sales@databayt.org):
  > Outreach: schools, sponsors, investors, early adopters, contributors
  > Draft proposals, follow up leads
  > Networking for all kinds of support
```

### 4.3 Samia — R&D

```
Daily:
  Cowork:
  > Research Claude/Anthropic products — learn the platform deeply
  > Study sharing economy models — how to distribute revenue fairly
  > Investigate startup patterns — sustainability, community, open source
  > Take care of Kun — understand agents, skills, configuration
  > Content: translation, documentation when needed
```

### 4.4 Sedon — Executor

```
As available (needs clear task maps):
  > [assigned task]               # Specific, well-defined task with clear steps
  > Saudi operations              # Bank account, physical presence, payments
  > Batch weekly                  # Give him the week's map on Monday
```

---

## 5. Cross-Device Workflows

### 5.1 Start on Desktop, Continue on Phone

```
Desktop (CLI):
  > "Start building the notification system"
  > [work in progress]

Phone (Remote Control):
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

### 7.1 Outreach & Pitch

```
Ali (sales@databayt.org):
  > Pitch: open source, sharing economy, community contribution
  > Targets: schools, sponsors, investors, early adopters, contributors
  > Materials: pitch deck, demo URL, partnership proposal
  > Follow-up: track leads, schedule calls
```

### 7.2 Financial Tracking

```
Cowork + Stripe MCP:
  > "Monthly burn and runway report"
  1. Track expenses: Claude ($200) + services (~$300)
  2. Current burn: ~$500/month
  3. Runway: $5K / $500 = 10 months
  4. Revenue: track when it starts coming in
```

### 7.3 Sharing Economy Research

```
Cowork (Samia):
  > Study sharing economy models — how open-source companies sustain
  > Investigate revenue distribution — fair economics for contributors
  > Research startup patterns — community-driven growth
  > Read books on sharing economy and startups
  > Design databayt's revenue model
```

### 7.4 Market Research

```
Cowork (Samia or Ali):
  > "Analyze school management landscape in Sudan/MENA"
  1. Web search: Products, pricing, features, gaps
  2. Compare: Feature matrix vs. Hogwarts
  3. Identify: Open-source differentiator + sharing economy angle
  4. Output: Report for team review
```

---

## 8. Quick Reference

| I Want To... | Say... | Who |
|-------------|--------|-----|
| Start dev server | "dev" | Abdout |
| Build project | "build" | Abdout |
| Push code | "push" / "quick" | Abdout |
| Deploy | "deploy" / "ship" | Abdout |
| Create component | "atom/template/block [name]" | Abdout |
| Generate feature | "saas [feature]" | Abdout |
| Run tests | "test [target]" | Abdout |
| QA testing | GitHub Issue checklists | Ali |
| Report bugs | Comment on GitHub Issue | Ali |
| Fix errors | "fix" | Abdout |
| Client outreach | sales@databayt.org | Ali |
| Sponsor/investor search | Outreach | Ali |
| Sharing economy research | Cowork | Samia |
| Claude/Anthropic R&D | Cowork | Samia |
| Kun care/config | Cowork | Samia |
| Saudi operations | Clear task map | Sedon |
