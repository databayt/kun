---
name: memory-bridge
description: Pair Anthropic's memory tool with kun's ~/.claude/memory/ directory - unified storage for Claude Code, API agents, and Managed Agents
model: sonnet
argument-hint: "init | sync | show | --agent <name>"
---

# Memory-Bridge — Memory Tool ↔ kun Filesystem

The Anthropic memory tool (`memory_20250818`) is a server-recognized tool that gives Claude file-based memory across conversations. Storage is YOUR responsibility — Anthropic doesn't host the bytes.

Kun already has `~/.claude/memory/` (and `~/.claude/projects/-Users-abdout-kun/memory/MEMORY.md`) as Claude Code's auto-memory. This command makes that same directory the backing store for the memory tool, so Claude Code and API-mode agents read/write the same files.

> **Docs**: [Memory tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool)

## Usage

- `/memory-bridge init` — scaffold the memory-tool handler wrapping `~/.claude/memory/`
- `/memory-bridge sync` — sync memory-tool state with current MEMORY.md index
- `/memory-bridge show` — list what's in memory + which agents have access
- `/memory-bridge --agent captain` — show one agent's memory scope

## Why Bridge

Today:
- Claude Code reads `~/.claude/memory/` via the harness auto-load
- Claude API agents that need memory must implement their own file handler
- Two side-by-side memory systems means drift

After bridging:
- One directory feeds both modes
- API agents declare `tools: [{ type: "memory_20250818" }]` and get the same files
- `MEMORY.md` index is the single shared catalog

## Protocol

### `init`

Generate a tiny TypeScript/Python handler that implements the memory-tool spec on top of `~/.claude/memory/`. Operations supported:

| Tool call | Mapping |
|---|---|
| `view <path>` | `cat ~/.claude/memory/<path>` (paths scoped under the dir) |
| `create <path>` | `echo > ~/.claude/memory/<path>` |
| `str_replace <path> <old> <new>` | in-place edit |
| `delete <path>` | remove file (with safety: tombstone, don't hard-delete) |
| `list <dir>` | `ls ~/.claude/memory/<dir>` |

Output: `~/.claude/scripts/memory-tool-handler.ts` (for TS Agent SDK) and `~/.claude/scripts/memory_tool_handler.py` (for Python SDK).

Includes path-traversal protection — calls outside `~/.claude/memory/` are rejected.

### `sync`

Walk the directory; rebuild `MEMORY.md` index from frontmatter of each memory file. Detect:
- Orphan files (no entry in MEMORY.md)
- Dead links (MEMORY.md entry pointing to deleted file)
- Stale memories (over 90 days old)

Report findings; offer to auto-clean.

### `show`

```
## Memory Map

**Total files**: N
**Indexed in MEMORY.md**: M
**Orphans**: K
**Bytes**: Z

### Agents with memory: user (read/write all)
- captain
- tech-lead
- learn
- analyze
- growth
- revenue
- product
- quality-engineer
- guardian
- analyst
- ops
- architecture
- orchestration

### Captain-specific memory files
- docs/CONSTITUTION.md
- docs/PRINCIPLES.md
- docs/NORTH-STAR.md
- .claude/memory/captain_journal.md
- .claude/memory/runway.json
... (list from agent frontmatter)
```

### `--agent <name>`

Show that single agent's memory access scope (intersect of `memory: <kind>` and explicit `memory: [...]` file list).

## Reusing existing structure

Kun's `~/.claude/memory/` already has:
- Per-product directories (kun, hogwarts)
- Auto-memory under `projects/-Users-abdout-kun/memory/MEMORY.md`
- Captain journal, runway, OKRs, decisions, customers, pipeline

Bridge keeps all that. New: a thin `memory.lock` file at the directory root that the handler holds while writing, so parallel API + Claude Code sessions don't corrupt each other.

## Exit Gate

- `init` produced handler scripts that pass a `view ~/` rejection test
- `sync` produced a clean MEMORY.md (no orphans)
- `show` lists every agent with memory: declaration
- Existing memory files are not moved or renamed (purely additive)
