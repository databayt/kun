---
description: Self-update — read the latest Anthropic releases, diff against the engine, adopt or propose
argument-hint: [--force]
---

# Sync Anthropic — the engine updates itself

Kun's standing doctrine: configure Anthropic's products, don't rebuild them — and always run on their latest surface. This command is the loop that keeps the engine current. Anchor: `.claude/engine.json` → `anthropic_sync`.

## Steps

### 1. Read the stamp

Read `.claude/engine.json` → `anthropic_sync.last` and `claude_code_version`. If `last` is within 7 days and `$ARGUMENTS` is not `--force`, report freshness ("engine is N days fresh") and stop.

### 2. Fetch the surface (parallel WebFetch)

| Source                                                                       | Look for                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` | every version newer than `claude_code_version` |
| `https://platform.claude.com/docs/en/release-notes/api`                      | API/platform changes since `last`              |
| `https://www.anthropic.com/news`                                             | product announcements since `last`             |

Extract only NEW capabilities relevant to engine configuration: tools, config surfaces (settings keys, frontmatter fields, hook events, `.claude/*` directories), models (IDs, pricing, availability windows), permissions/sandbox, autonomy/long-horizon features, billing/plan changes.

### 3. Diff against the engine — classify each capability

| Class            | Meaning                                                                    | Action                                                                                                        |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **ADOPT-SAFE**   | Pure config addition — no behavior risk, no spend, no team-workflow change | Apply now                                                                                                     |
| **ADOPT-DECIDE** | Changes behavior, cost, or how the team works                              | `/decide` entry + GitHub issue (`type:chore`, label `engine-upgrade`); `PushNotification` to Abdout if Type-1 |
| **TRACK**        | Real but not useful to kun yet                                             | Add to the deferred list in `docs/CONFIG-BENCHMARK.md`                                                        |

Standing constraints that veto adoption regardless of class:

- **Subscription-only** — nothing that requires usage credits or API-key per-token spend (`engine.json` → `billing`)
- **Main-only git** — nothing that reintroduces branches/worktrees/PRs (`.claude/rules/github-workflow.md`)
- **Anthropic-native** — no third-party substitutes for something Anthropic ships (`docs/CONFIG-BENCHMARK.md`)

### 4. Apply + record

1. Apply ADOPT-SAFE changes to canonical sources; if any plugin source changed, regenerate: `bash .claude/scripts/build-plugin.sh`
2. Update `engine.json` → `anthropic_sync.last` (today) and `claude_code_version` (latest seen)
3. Material adoptions get a dated line in `docs/CONFIG-BENCHMARK.md` → **Adoption log**
4. Commit: `chore(engine): sync anthropic surface to v<version>` (+ `git pull --rebase origin main && git push origin main`)

### 5. Report

One table — capability → class → action taken — plus the new freshness ("0 days").

## Cadence

- **Weekly**: `/weekly` Monday plan runs this first — the engine refreshes before the captain allocates.
- **Session start**: the captain flags `anthropic_sync.last` > 7 days stale and runs this before allocating.
- **Event-driven**: any Anthropic announcement Abdout forwards in conversation.

## Exit gate

`anthropic_sync.last` = today, every new capability classified, ADOPT-SAFE applied and committed, ADOPT-DECIDE escalated with a durable record.
