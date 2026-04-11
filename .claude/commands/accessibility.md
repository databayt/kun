# Accessibility — Full Coverage A11y Sweep

Sweep every component for accessibility anti-patterns: clickable divs, missing alt text, broken focus management, missing ARIA.

## Usage

- `accessibility` — sweep ALL components in current product
- `accessibility admission` — sweep only the admission block
- `accessibility --status` — show current coverage

## Arguments: $ARGUMENTS

## Protocol

Follow the universal sweep protocol from `.claude/coverage/sweep-protocol.md` using keyword `accessibility` from `.claude/coverage/keywords.json`.

### What This Keyword Checks (anti-patterns to find and fix)

1. **`<div onClick>`** → use `<button>` or add `role="button"` + keyboard handler
2. **`<img>` without alt** → add meaningful alt text
3. **Negative tabIndex without ARIA** → add context with aria attributes
4. **`<svg>` without ARIA** → add `aria-label` or `role="img"`
5. **Forms without labels** → associate `<Label>` with each input
6. **Missing heading hierarchy** → h1 → h2 → h3 in order

### Mode: Fix

This keyword finds AND fixes accessibility issues where safe to do so.

### Semantic HTML Priorities

| Priority | Issue | Impact |
|----------|-------|--------|
| CRITICAL | Clickable divs without keyboard access | Keyboard users can't interact |
| CRITICAL | Images without alt text | Screen readers skip content |
| HIGH | Missing form labels | Screen readers can't describe inputs |
| HIGH | Missing heading hierarchy | Navigation broken for screen readers |
| MEDIUM | Missing ARIA on dynamic content | State changes not announced |
| MEDIUM | Focus not managed on modals | Focus trap missing |
