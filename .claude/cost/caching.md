# Prompt Caching Playbook

> Story 28.3 in `docs/EPICS-V4.md`. Anthropic Claude API supports prompt caching at 90% discount on cached reads. Used aggressively, this is the single biggest cost lever.

## What gets cached automatically

Claude Code (and the Agent SDK) automatically marks the following for caching:

- The system prompt (CLAUDE.md hierarchy, AGENTS.md import)
- Tool definitions (the function schemas)
- The first user message in a session

**No action needed** for those — they're cached for 5 minutes (TTL extends with use).

## What kun should mark for caching

Heavy reference files that Claude reads repeatedly within a session benefit from explicit cache markers:

| File | Reason | Frequency |
|------|--------|-----------|
| `.claude/agents/captain.md` | 308-line strategic agent file, loaded on captain invocations | Every captain session |
| `.claude/captain/decision-matrix.yaml` | Rule set, read before every delegation decision | Every captain delegation |
| `.claude/memory/repositories.json` | 14-repo registry, queried for org pulse | Every monitor / weekly cycle |
| `.claude/patterns/cards/*.md` | 10 pattern cards, loaded by pattern keyword triggers | Every form/table/auth/etc work |
| `.claude/cost/routing.yaml` | Model routing policy | Every delegation |
| `docs/EPICS-V4.md` | 135-story tracker, queried for sprint planning | Every weekly cycle |

## How to mark a file for caching

Anthropic's caching is triggered by the `cache_control` field in the API request. In the Agent SDK:

```typescript
// TypeScript Agent SDK
const result = await query({
  prompt: "...",
  options: {
    systemPromptCachingMode: "ephemeral",
    // Heavy reference files in CLAUDE.md / @-imports auto-cache
  }
});
```

In Claude Code itself, caching is controlled by:
1. Anthropic's automatic system-prompt caching (always on)
2. The `@-import` directive — imported files are cached as part of the system prompt block
3. Routine prompts that include heavy reference inline (cached as part of the routine's prompt)

## Verification

Cache hit rate is logged per session in transcripts as `usage.cache_read_input_tokens` vs `usage.input_tokens`. Captain reads `~/.claude/memory/spend-daily.json` (E28.1) to compute the rolling cache-hit ratio:

```
cache_hit_rate = sum(cache_read_tokens) / sum(input_tokens + cache_read_tokens)
```

**Target**: ≥ 80% cache hit rate on heavy-reference files. If below 50%, the file is being modified too often or imports aren't structured for caching.

## Anti-patterns

- ❌ **Modifying captain.md every weekly cycle** — busts the cache. Append to `captain_journal.md` (separate file) instead.
- ❌ **`@-importing` a frequently-edited file** — defeats caching. Import stable files only.
- ❌ **Inline-pasting big reference content into prompts** — moves it out of the cacheable system prompt. Use `@-import`.
- ❌ **Caching tier confusion** — Haiku has different cache pricing than Opus. Cost telemetry per-model is required.

## When NOT to cache

- Small files (< 1024 tokens) — caching overhead exceeds benefit
- One-shot lookups that won't repeat in-session
- Dynamic content (live state, runway, MRR) — caching stale state is worse than no cache

## Reference

- Anthropic prompt caching docs: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Cost telemetry hook: `scripts/hooks/spend-telemetry.sh`
- Daily aggregation: `~/.claude/memory/spend-daily.json` (Routine `cost-watcher`)
- Routing policy: `.claude/cost/routing.yaml`
