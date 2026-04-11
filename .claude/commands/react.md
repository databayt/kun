# React — Full Coverage Best Practices Sweep

Sweep every component for React 19 anti-patterns: request waterfalls, barrel imports, non-functional setState, derived-state-in-useEffect, heavy RSC serialization.

## Usage

- `react` — sweep ALL components in current product
- `react admission` — sweep only the admission block
- `react --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `react` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **Sequential awaits** → parallelize with `Promise.all()`
2. **Barrel imports** (`from '@/components/icons'`) → direct import from `lucide-react`
3. **Index imports** (`from './index'`) → import from specific file
4. **Non-functional setState** (`setItems([...items, x])`) → `setItems(prev => [...prev, x])`
5. **Non-lazy state init** (`useState(expensive())`) → `useState(() => expensive())`
6. **Derived state in useEffect** → derive during render
7. **Full object RSC serialization** → pass only needed fields

### Fix Priority

| Priority | Anti-pattern | Impact |
|----------|-------------|--------|
| CRITICAL | Request waterfalls | 2-10x improvement |
| CRITICAL | Barrel imports | 200-800ms per import |
| HIGH | Barrel index imports | Bundle bloat |
| MEDIUM | Non-functional setState | Stale closure bugs |
| MEDIUM | Lazy state init | Unnecessary re-computation |
| MEDIUM | Derived state in useEffect | Extra render cycle |
| MEDIUM | RSC over-serialization | Server→client payload |

### Mode: Fix

This keyword finds AND fixes anti-patterns. After fixing each module, run `pnpm tsc --noEmit` to verify.

Reference: React best practices section in CLAUDE.md and `.claude/agents/react.md`.
