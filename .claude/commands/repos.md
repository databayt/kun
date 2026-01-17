# Repository Explorer

Access and explore all databayt organization repositories.

**Memory**: `~/.claude/memory/repositories.json`
**Docs**: [kun/content/docs/repositories.mdx](https://github.com/databayt/kun/blob/main/content/docs/repositories.mdx)

## Arguments: $ARGUMENTS

## Available Commands

| Command | Description |
|---------|-------------|
| `list` | List all repositories |
| `sync` | Sync all repos locally |
| `status` | Check sync status |
| `watch <repo>` | Watch for changes |
| `search <pattern>` | Search across repos |
| `<repo>` | Explore specific repo |

## Your Task

Based on "$ARGUMENTS", perform the appropriate action:

### If "list" or no arguments:
Show all repositories grouped by category:

**Core Libraries** (Priority 1):
- **codebase** - Patterns, agents, templates, blocks
- **shadcn** - UI component library (shadcn/ui fork)
- **radix** - Radix primitives
- **kun** - Code Machine config

**Product Repositories** (Priority 2):
- **hogwarts** - Education SaaS (multi-tenant, LMS, billing)
- **souq** - E-commerce (multi-vendor, cart)
- **mkan** - Rental marketplace (booking, listings)
- **shifa** - Medical platform (appointments, patients)

**Specialized** (Priority 3):
- **swift-app** - iOS mobile
- **distributed-computer** - Rust infrastructure
- **marketing** - Landing pages

### If "sync":
Run the sync script to clone/update all repos locally:
```bash
~/.claude/scripts/sync-repos.sh
```

### If "status":
Check the sync status from `~/.claude/memory/repositories.json`
Show which repos are synced, last sync time, and any pending changes.

### If "watch <repo>":
Enable monitoring for the specified repo. Update the memory file.

### If "search <pattern>":
Search across all repos for the pattern using GitHub MCP:
```
mcp__github__search_code(q="<pattern> org:databayt")
```

### If specific repo name:
Show detailed info about that repo:
1. Read from memory file
2. Check if local clone exists
3. Show recent commits
4. List key files and patterns
5. Suggest relevant agent to use

## Reference Agents

Each product repo has a dedicated agent:
- `hogwarts` agent for education patterns
- `souq` agent for e-commerce patterns
- `mkan` agent for rental/booking patterns
- `shifa` agent for healthcare patterns

## Quick Access

**Local exploration** (preferred):
```bash
# Use Glob/Grep/Read tools on:
/Users/abdout/codebase
/Users/abdout/oss/<repo-name>
```

**GitHub fallback**:
```
mcp__github__get_file_contents(owner="databayt", repo="<name>", path="<path>")
```

## Monitoring

The repositories are under continuous development. Check for updates:
- Run `/repos status` to see sync status
- Run `/repos sync` to pull latest changes
- Watch upstream dependencies (shadcn-ui/ui, radix-ui/primitives)

## Examples

| Command | Action |
|---------|--------|
| `/repos` | List all repositories |
| `/repos list` | Same as above |
| `/repos hogwarts` | Show hogwarts details |
| `/repos sync` | Clone/update all repos |
| `/repos status` | Check sync status |
| `/repos search DataTable` | Search for DataTable |
