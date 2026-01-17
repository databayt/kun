# Codebase Reference

Access the user's reference codebase:
- **Local**: `/Users/abdout/codebase`
- **GitHub**: https://github.com/databayt/codebase

## Structure
- `src/` - Source code (components, lib, hooks, etc.)
- `__registry__/` - Component registry
- `docs/` - Documentation
- `content/` - Content files
- `prisma/` - Database schema
- `scripts/` - Utility scripts

## Key Files
- `CLAUDE.md` - AI instructions
- `components.json` - shadcn configuration
- `package.json` - Dependencies
- Various `*-factory.md` files - Generation patterns

## Your Task
Based on the user's request "$ARGUMENTS", help them by:

1. **Browse**: List files/folders in the codebase
2. **Search**: Find specific patterns, components, or code
3. **Copy**: Extract code to use in current project
4. **Reference**: Show how something is implemented

**Prefer local access** - Use Read, Glob, and Grep tools to explore `/Users/abdout/codebase/`.

**Fallback to GitHub** - If local fails, use GitHub MCP:
```
mcp__github__get_file_contents(owner="databayt", repo="codebase", path="<path>")
```

If no specific request, show the main structure and ask what they need.
