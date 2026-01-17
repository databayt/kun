# Performance Audit

Analyze and optimize performance.

## Metrics

### Core Web Vitals
- **LCP** (Largest Contentful Paint) < 2.5s
- **INP** (Interaction to Next Paint) < 200ms
- **CLS** (Cumulative Layout Shift) < 0.1

### Bundle Analysis
```bash
pnpm build
# Check .next/analyze/
```

### Database
- N+1 query detection
- Index recommendations
- Query optimization

## Optimizations

### React
- Memo/useMemo/useCallback
- Code splitting
- Lazy loading
- Suspense boundaries

### Next.js
- Static generation
- ISR (Incremental Static Regeneration)
- Image optimization
- Font optimization

### Database
- Select specific fields
- Use indexes
- Connection pooling

## Usage
```
/performance           # Full audit
/performance bundle    # Bundle size
/performance queries   # Database queries
/performance <file>    # Specific component
```

Run performance audit: $ARGUMENTS
