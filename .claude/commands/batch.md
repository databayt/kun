---
name: batch
description: Queue a Tier-2b coverage sweep onto the Anthropic Batch API at 50% discount - finishes in ~1 hour
model: sonnet
argument-hint: "<sweep-name> [block-name] | --status <batch-id>"
---

# Batch — Anthropic Batch API Wrapper

Run kun's coverage sweeps (or any large per-file Messages job) through the **Batch API** for a 50% discount on input + output tokens. Finishes in under an hour most of the time. Use this for overnight cleanup runs, not interactive work.

> **Docs**: [Batch processing](https://docs.claude.com/en/docs/build-with-claude/batch-processing)

## Usage

- `/batch translate` — queue the whole translate sweep across the current product
- `/batch tailwind admission` — queue only the admission block's tailwind sweep
- `/batch react hogwarts` — queue the react sweep against hogwarts
- `/batch --status batch_01ABC123XYZ` — check progress on an existing batch
- `/batch --list` — list active and recent batches

## When to use this vs the sweep directly

| Situation | Pick |
|---|---|
| Need answer now | run the sweep directly (`/translate`, `/tailwind`, etc.) |
| OK to wait ~1 hr | `/batch` — 50% off |
| Sweep would touch >50 files | `/batch` (batching wins on scale) |
| Sweep touches <10 files | run directly (batch overhead not worth it) |
| Off-hours / overnight | `/batch` always |

## Protocol

### 1. RESOLVE — Match the sweep argument to a kun command

The first positional arg must be one of: `translate`, `tailwind`, `react`, `nextjs`, `prisma`, `typescript`, `shadcn`, `authjs`, `accessibility`, `barrel`, `skeleton`, `waterfall`, `guard`, `structure`.

If not recognized: stop, list valid sweep names.

### 2. ENUMERATE — Build the per-file task list

Read the sweep's `paths:` glob from its frontmatter (Theme 3a added these). Resolve to actual files in the current repo. Each file becomes one Messages request in the batch.

Each request:
- `custom_id`: relative file path (Anthropic requires unique strings ≤64 chars)
- `params`: the sweep's prompt parameterized for that single file
- `model`: matches the sweep's `model:` (Haiku for cheap sweeps, Sonnet otherwise)
- `cache_control`: place a breakpoint on the system + tool prompt block so the cached prefix is reused across all N requests in the batch

If file count > 10,000 (Batch API single-batch ceiling): split into multiple batches; report.

### 3. CREATE — Submit the batch via API

```bash
curl https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d @batch.jsonl
```

Capture the returned `batch_id`. Append to `~/.claude/memory/batches.jsonl` with `{ batch_id, sweep, block, product, started_at, est_complete }`.

### 4. POLL — Check status

For `--status <batch_id>`:

```bash
curl https://api.anthropic.com/v1/messages/batches/<batch_id> \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

Report counts of `succeeded`, `errored`, `canceled`, `expired`. ETA from `expires_at` minus now.

### 5. APPLY — Pull results and apply edits

When `processing_status == "ended"`:

```bash
curl https://api.anthropic.com/v1/messages/batches/<batch_id>/results
```

Each result corresponds to one file. Parse each Messages response for proposed edits and apply via Edit tool. Stage them under one commit per sweep with a `chore(<product>): <sweep> batch sweep` message.

If any result failed: log to `~/.claude/memory/batches.jsonl`, skip that file, keep going.

### 6. REPORT — Summary

```
## Batch Report

**Batch**: <batch_id>
**Sweep**: <sweep name>
**Files processed**: N succeeded / M errored
**Cost (estimated)**: $X.XX (vs $YY.YY at sync rate — saved Z%)
**Duration**: <start> → <end>
**Commit**: <sha>
```

## Cost Awareness

Batch API discount: **50% off** input + output tokens (and special tokens). Caching still works on top — if the sweep prompt is cached, hits within the batch are at cache-read pricing (10% of base). Combined: a cached + batched Haiku sweep can hit ~5% of the original sync Opus cost for the same work.

`/costs` rolls up batch spend by reading `~/.claude/memory/batches.jsonl`.

## Error Recovery

| Error | Action |
|---|---|
| `ANTHROPIC_API_KEY` not set | Fail with message; point to /credentials |
| Batch creation 4xx | Validate JSONL, retry once |
| Batch creation 5xx | Wait 30s, retry once |
| Result file too large | Stream parse, apply incrementally |
| Single result errored | Skip, continue, log |
| Batch expired (>24h) | Re-create from same task list, surface |

## Exit Gate

- Batch created OR existing batch checked
- If completed: all successful edits committed
- `~/.claude/memory/batches.jsonl` updated
- Summary printed with cost savings
