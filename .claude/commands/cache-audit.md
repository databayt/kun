---
name: cache-audit
description: Analyze prompt-caching opportunities across kun's Claude API call sites - hit rate, breakpoint suggestions, cost impact
model: sonnet
argument-hint: "[path] | --report"
---

# Cache-Audit — Prompt Caching Analyzer

Inspect every `anthropic.messages.create` call site in the current repo (or a given path) and surface:

- Whether `cache_control` breakpoints are placed
- Where they SHOULD be placed (system prompt end, tool list end, last-stable-turn end)
- Estimated cache hit rate based on the call shape
- Estimated cost delta vs the no-cache baseline

> **Docs**: [Prompt caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)

## Usage

- `/cache-audit` — scan the whole repo
- `/cache-audit src/lib/ai/` — narrow scan
- `/cache-audit --report` — emit JSON report only, no suggestions

## Cache-Window Pattern

The kun-blessed pattern for any agent loop:

1. **Static prefix** (system instructions, tool list) — breakpoint with `ttl: "1h"` if stable across many calls, default 5-min TTL otherwise
2. **Conversation prefix** (last assistant turn before the new user turn) — breakpoint with default 5-min TTL
3. **Document or knowledge block** — breakpoint if reused across turns

Up to 4 breakpoints per request. Place the LAST breakpoint at the end of the most recent stable content so the next turn extends the cache rather than missing.

## Protocol

### 1. DISCOVER — Find call sites

```bash
grep -rln "messages.create\|messages\.batches\.create" --include='*.ts' --include='*.tsx' --include='*.py' .
```

Plus any `claude-agent-sdk` invocations.

### 2. INSPECT — For each call site

- Is there a `cache_control` block? If yes: where?
- What's the system prompt length? Tools length? Conversation length?
- Is `tools=` static across calls (good for caching) or generated per-call (bad)?
- Does the call use `extended-thinking`? If yes, message-prefix caching invalidates on thinking-budget changes — flag.

### 3. SCORE — Hit-rate estimate

For each call, compute a 0-100 score:
- +30 if system prompt cached
- +20 if tools cached
- +20 if last conversation turn cached
- +20 if call shape repeats within 5 min (TTL window)
- +10 if `ttl: "1h"` opt-in for slow-churn prefixes

### 4. SUGGEST — Concrete diff hints

For each site < 70: emit a 3-line code diff showing where to add `cache_control: { type: "ephemeral" }` and (if applicable) `ttl: "1h"`.

### 5. REPORT

```
## Cache Audit

**Call sites**: N total / M cached / K uncached
**Avg estimated hit rate**: XX%
**Estimated monthly savings if all gaps closed**: $X.XX

### Top 5 Gaps
1. <file>:<line> — score 20 — add system-end breakpoint
2. ...

### High Performers (keep doing this)
- <file>:<line> — score 95 — full cache window in place
```

## When Caching Hurts

Caching has a 25% write premium per breakpoint. Don't add breakpoints to:
- Single-shot calls (call once, never repeat shape)
- Calls where the prefix is < ~1024 input tokens (no minimum hit benefit)
- Calls where the prefix changes every turn (no hits possible)

## Exit Gate

- Every call site scored
- Top gaps ranked by potential savings
- No false-positive suggestions for single-shot calls
- Report appended to `~/.claude/memory/cache-audits/<date>.md` for trend tracking
