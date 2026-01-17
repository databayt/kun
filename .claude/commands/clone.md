# Clone from Source

Clone and adapt code from various sources.

## Arguments
- `$1`: Source (github:owner/repo/path, shadcn:component, codebase:path)

## Sources

### GitHub
```
/clone github:vercel/ai/examples/next-openai
/clone github:shadcn-ui/ui/apps/www/components/ui/button
```

### shadcn Registry
```
/clone shadcn:button
/clone shadcn:data-table
```

### Local Codebase
```
/clone codebase:src/components/atom/stat-card
/clone codebase:src/registry/new-york/templates/hero-01
```

## Process

1. Fetch source code
2. Analyze dependencies
3. Adapt imports to local structure
4. Apply project conventions
5. Update registry if component

Clone source: $ARGUMENTS
