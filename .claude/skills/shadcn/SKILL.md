---
name: shadcn
description: shadcn — Full Coverage Component Primitives Sweep
paths: ["src/components/**","components.json"]
---

# shadcn — Full Coverage Component Primitives Sweep

Sweep every component for raw HTML elements that should use shadcn/ui primitives: `<button>` → `<Button>`, `<input>` → `<Input>`, `<select>` → `<Select>`, etc.

## Usage

- `shadcn` — sweep ALL components in current product
- `shadcn admission` — sweep only the admission block
- `shadcn --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `shadcn` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **`<button>`** → `<Button>` from `@/components/ui/button`
2. **`<input>`** → `<Input>` from `@/components/ui/input` (except `type="hidden"`)
3. **`<select>`** → `<Select>` from `@/components/ui/select`
4. **`<textarea>`** → `<Textarea>` from `@/components/ui/textarea`
5. **`<table>`** → `<Table>` from `@/components/ui/table`
6. **`<dialog>`** → `<Dialog>` from `@/components/ui/dialog`
7. **`<label>`** → `<Label>` from `@/components/ui/label`

### Mode: Fix

This keyword finds AND fixes — replaces raw HTML with shadcn/ui imports.

### Component Hierarchy Check

Beyond raw HTML replacement, also verify:
- 2+ primitives composed together → should be an atom in `@/components/atom/`
- Full-page layouts → should use template patterns
- Business logic mixed with UI → should be a block

### Skip

- Files inside `src/components/ui/` (these ARE the primitives)
- Files inside `node_modules/`
- Third-party component wrappers
