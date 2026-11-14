---
name: Performance
description: Performance audit - Core Web Vitals, bundle, database queries
when_to_use: "Use when something is measurably slow and needs profiling with concrete fixes — Core Web Vitals, bundle size, database queries. Unlike /fast, the per-URL quality keyword. Triggers on: it feels slow, audit the bundle, why is this page slow, optimize the queries."
argument-hint: "[bundle|queries|file]"
model: opus
allowed-tools: ["Bash(pnpm *)", "Read", "Glob", "Grep"]
---

# Performance Audit

Analyze and optimize performance.

## Usage
```
/performance           # Full audit
/performance bundle    # Bundle size
/performance queries   # Database queries
/performance <file>    # Specific component
```

## Argument: $ARGUMENTS

## Metrics

### Core Web Vitals
- **LCP** (Largest Contentful Paint) < 2.5s
- **INP** (Interaction to Next Paint) < 200ms
- **CLS** (Cumulative Layout Shift) < 0.1

## Optimizations

### React
- Memo/useMemo/useCallback
- Code splitting, Lazy loading, Suspense boundaries

### Next.js
- Static generation, ISR, Image/Font optimization

### Database
- Select specific fields, Use indexes, Connection pooling, N+1 detection
