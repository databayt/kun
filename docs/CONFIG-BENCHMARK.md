# Config Benchmark — kun vs. the best public Claude Code setups

> Consolidated 2026-06-04. Counts and the model live in `.claude/engine.json` (the
> single source of truth); this doc captures _decisions and rationale_, not numbers.

We surveyed the strongest public Claude Code configurations — Anthropic's own docs and
example plugins, the AGENTS.md ecosystem (Vercel `next.js`, OpenAI `codex`, Supabase), and
the high-signal community collections (subagent fleets, hook kits, statusline tools) — then
**verified every load-bearing claim against the official docs** before adopting anything. The
raw research carried errors we discarded (subagents _can_ use MCP via `mcpServers`; the
`allowManaged*` settings keys don't exist; `/output-style` is deprecated in favor of `/config`;
no repo's star count was taken at face value). What follows is the verified picture.

## Verified Claude Code feature surface (2026)

> Re-verified 2026-09-26 against CHANGELOG 2.1.283 and code.claude.com/docs.

| Capability        | Status              | What's actually true                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path-scoped rules | ✅ native           | `.claude/rules/*.md` with a `paths:` glob frontmatter load **only** when Claude touches a match; no `paths` = always-on. Quote globs (`["**/*.tsx"]`); `globs:` is a fallback alias; injection is most reliable on Read.                                                                                                                |
| `AGENTS.md`       | ⚠️ fallback only    | Read natively **only when a project has no CLAUDE.md** (2.1.277; "Project instructions" in `/config`). With a CLAUDE.md present it still needs an `@AGENTS.md` import or a symlink. The cross-tool standard (Codex/Cursor/Copilot read it directly).                                                                                    |
| Hooks             | ✅ 28 events        | `PreToolUse` exiting **2 blocks** the tool (stderr → Claude); handler types `command \| http \| mcp_tool \| prompt \| agent`; plugins bundle `hooks/hooks.json` (auto-discovered).                                                                                                                                                      |
| Subagents         | ✅ rich frontmatter | `model` (`opus\|sonnet\|haiku\|fable\|inherit` or a full id), `tools`, `disallowedTools`, `permissionMode`, `skills`, **`mcpServers`**, `memory`, `effort`, `omitClaudeMd` (2.1.271 — run without CLAUDE.md files), `maxTurns`, `isolation: worktree`.                                                                                  |
| Skills            | ✅                  | `context: fork` + `agent: <type>`, `allowed-tools`/`disallowed-tools`, `paths`, `effort`, `` !`cmd` ``. `description` + `when_to_use` share a **1,536-char** cap per entry, and the whole listing is capped at **1% of the context window** (`skillListingBudgetFraction`) — on overflow the least-used skills lose their descriptions. |
| Plugins/market    | ✅                  | `.claude-plugin/marketplace.json` catalog + per-plugin `plugin.json`; `${CLAUDE_PLUGIN_ROOT}` for bundled scripts (exec-form `args`).                                                                                                                                                                                                   |
| Settings          | ✅                  | Precedence managed → CLI → local → project → user; `allow/deny/ask`. Real managed keys: `claudeMd`, `forceLoginOrgUUID`.                                                                                                                                                                                                                |
| Output styles     | ✅                  | `~/.claude/output-styles/*.md`; switch with `/config` or `/output-style [name]` (restored 2.1.269); built-in **Concise** style (2.1.237).                                                                                                                                                                                               |

## Where kun already leads (kept as-is)

- **Two-plugin marketplace built from canonical sources** (`build-plugin.sh`) with a `--check`
  drift mode _and_ a literal-secret guard — most public repos hand-maintain their plugin trees.
- **`engine.json` as a single source of truth** + `/health` drift detection.
- A real **idea→ship pipeline** with human gates and keyword routing.
- The Good/Bad/Fix **rule corpus** and an **already-tiered portable agent fleet** (opus for
  architecture/orchestration, sonnet for build agents, haiku for routine ones) — the community
  best-practice we'd otherwise have had to adopt.

## What this benchmark changed

1. **Path-scoped the rule corpus.** The 29 domain rules used a custom `applies-to:` field Claude
   Code ignores, so all of them loaded into _every_ session. Renamed to the native `paths:` —
   each rule now auto-loads only when Claude touches a matching file. Explicit reads by the
   quality agent / `/check` are unaffected; we only shed the redundant always-on context cost.
2. **Closed drift gaps.** Added a `domain_rules` count to `engine.json` (the rule corpus was
   untracked by `/health`, which only counted top-level files) and a `config-drift` CI workflow
   that runs `build-plugin.sh --check` on PRs touching `.claude/**` or `plugins/**`.
3. **Shipped a safety guard as a hook.** `block-destructive-bash.sh` (PreToolUse, exit-2-blocks)
   enforces what the prisma-6 rule and the deny-list only advise — `rm -rf /`, `prisma migrate
reset`, `--accept-data-loss`, `git reset --hard`, force-push, `DROP/TRUNCATE`. Narrow by
   design: routine `rm -rf node_modules` and `--force-with-lease` pass. Wired in project settings
   _and_ bundled into the kun-company plugin so it travels with installs.
4. **Confirmed model tiering.** The portable fleet was already textbook-tiered; only the project
   fleet was uniformly opus. Downtiered `package` (mechanical dep audit) to sonnet and codified
   the policy in `engine.json` → `model_tiers`.

## Re-benchmark 2026-06-12 — the June surface

Second pass, produced by the new `/sync` loop (which makes re-benchmarking continuous instead
of episodic — four tiers: anthropic weekly, stack + services biweekly, agent-practice monthly).
Surface verified against the Claude Code CHANGELOG (v2.1.129 → v2.1.175) and the platform
release notes.

| Capability (version)                                                                 | What it is                                                                         | kun decision                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Dynamic workflows (v2.1.154)                                                         | `.claude/workflows/` named scripts orchestrate 10–100s of agents deterministically | **ADOPTED** — `handover.js` is the first; encode `/release` and repo-wide sweeps after first production runs |
| `fallbackModel` chains (v2.1.166)                                                    | Up to 3 fallbacks tried on overload/unavailability                                 | **ADOPTED** — `opus-4-8 → sonnet-4-6` in project settings                                                    |
| Usage attribution (v2.1.149 `/usage`, v2.1.174)                                      | Per-skill/agent/plugin/MCP cost breakdown, 24h/7d                                  | **ADOPTED** — weekly `/usage` check is the billing posture's enforcement + KPI 4                             |
| `/goal` loops (v2.1.139)                                                             | Completion condition; Claude works across turns until met                          | **ADOPTED** as practice for long fix loops (vocabulary already routes `goal`)                                |
| `/code-review` + `--fix` (v2.1.147/152)                                              | Effort-graded correctness review, applies findings                                 | **ADOPTED** as pre-ship lane alongside `/check`                                                              |
| `/cd` cache-preserving dir moves (v2.1.169)                                          | Move session between repos without cold cache                                      | **ADOPTED** as habit for cross-repo sessions — no config needed                                              |
| `claude agents` manager + `--json` (v2.1.139/145)                                    | Fleet view of every session; scripting surface                                     | TRACK — single-operator today; revisit when Ali/Samia drive their own sessions                               |
| Plugins auto-load from `.claude/skills` (v2.1.157)                                   | Skills discovered without a marketplace                                            | TRACK — the marketplace flow stays canonical for team installs                                               |
| Skill `disallowed-tools` frontmatter (v2.1.152)                                      | Least-privilege per skill/command                                                  | TRACK — pairs with the deliberately deferred `allowed-tools` hardening pass                                  |
| `/reload-skills` + SessionStart `reloadSkills` (v2.1.152)                            | Skills available same-session after generation                                     | TRACK — useful when `/analyze` generates configs mid-session                                                 |
| Hook upgrades: exec-form `args`, `$CLAUDE_EFFORT`, `terminalSequence` (v2.1.133–141) | Safer spawning, effort-aware hooks, notification sequences                         | TRACK — current hook kit is sufficient; adopt exec-form on next hook edit                                    |

## Re-benchmark 2026-07-10 — the July surface (engine v4.0)

Third pass — a full four-tier `/sync` (anthropic + stack + services + practice, all stamped
2026-07-10) plus a deep sweep of the reference configs Abdout named: vercel-labs/agent-skills +
agent-browser, garrytan/gstack, bmad-method v6.10, github/spec-kit v0.12.9, microsoft/markitdown
v0.1.6, hermes-agent v0.18.2, Claude Design, and the harness-engineering + solo-leverage
literature. Verified against CHANGELOG 2.1.199→2.1.206 and the July docs.

| Finding (source)                                                                            | kun decision                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude 5 family GA; Fable 5 set as session default via `/model`                             | **ADOPTED** — engine model `claude-fable-5`, fallbacks `opus-4-8 → sonnet-5`; agent alias tiers unchanged                                                       |
| spec-kit `clarify` (taxonomy scan + ≤5 questions before the gate)                           | **ADOPTED** — CLARIFY step in `/spec` (≤3 questions, answers encoded into the spec comment)                                                                     |
| spec-kit `analyze` gate semantics (read-only, constitution conflict = CRITICAL)             | **ADOPTED** — READY stage wired into `/feature` (Stage 2.7): coverage + conflict + constitution, FAIL blocks the pipeline                                       |
| Vercel react-best-practices rule pack (impact-tagged, per-rule files)                       | **ADOPTED** — new `react-perf/` domain, 8 rules vendored + `_template.md` + `impactDescription` frontmatter; feeds `stack`/`trace`/`efficient`                  |
| Claude Design: `design` plugin (knowledge-work-plugins) + canvas MCP, Max-covered           | **ADOPTED** — onboarding Phase 5 wires both; `claude-design` added to the declared MCP fleet; `/design-login` is a deferred manual click                        |
| Anthropic harness engineering (initializer/worker, evaluator ≠ generator, JSON state)       | **ADOPTED** — `/sync` harness-audit step (retire dead scaffolds on model releases), `/qa` baseline smoke + `blocks.json` verdict contract, CEO-OS Direction 8   |
| Second-brain / one-person-$1M operating moves                                               | **ADOPTED** — NORTH-STAR "enough" line, CEO-OS cash mechanics + custom-work rule, `/weekly` decision-review sweep, memory TL;DR/archive practice                |
| Vocabulary drift: duplicate `feature`/`check`/`ship`, dead BMAD v4 spells, `sync` collision | **ADOPTED** — vocabulary v2: deduped, stale spells pruned, Anthropic-native automation school (`loop`/`goal`/`schedule`/`workflow`), 12 missing spells added    |
| Hermes docs drift (`gateway run` vs `start`; Slack event subscriptions)                     | **ADOPTED** — hermes.mdx corrected against the v0.18.2 official docs                                                                                            |
| TypeScript 7.0 native (Go) stable 2026-07-08; TS 6.0 current JS release                     | TRACK — hold products until **7.1** restores the JS API (typescript-eslint blocked); STACK.md updated                                                           |
| Prisma 6.x maintenance tail ended (6.19.3, Apr 2026); Prisma 7 requires driver adapters     | **PROPOSE** — `/decide` + `/package`-driven migration plan; marketing (already 7.2.0) is the proof path                                                         |
| shadcn/ui defaults to Base UI (Jul 2026); Radix demoted to `-b radix`                       | **PROPOSE** — `/decide` Base-UI-vs-Radix; affects the databayt/radix fork, codebase atoms, shadcn skill pack                                                    |
| vercel-labs/agent-browser (Rust CDP daemon, CLI-first, MCP profiles)                        | TRACK — pilot on one niche keyword before any Playwright swap; no independent benchmark, deep `~/.playwright-auth` wiring stays                                 |
| gstack eval infra (LLM-judge skill evals, diff-based selection, gate/periodic tiers)        | **ADOPTED 2026-08-06** — shipped as `/bench` L1; see "Measuring the engine" below. Cheaper than scoped: L1 grading is exact string comparison, not an LLM judge |
| Cloud routines API/GitHub triggers (P0-labeled issue → auto `/report` session)              | **PROPOSE** — one routine + stored bearer token; removes polling from incident response                                                                         |
| Stacked skills (2.1.199+), MCP `request_timeout_ms`, hook `prompt_id`                       | TRACK — adopt opportunistically on next touch of each surface                                                                                                   |

Ceremony rejected on the cash-flow filter: BMAD party-mode/PRFAQ/sprint-status.yaml, spec-kit
`checklist`/`taskstoissues`/personas, BenAI's n8n/Airtable stack, gstack wholesale (worktree+PR
flow contradicts main-only). Both spec frameworks stop where kun's leverage begins — ship, watch,
incident, browser QA, and the business brain remain kun advantages.

## Engine KPIs — what "pushing the benchmark" means

The feature-parity survey above answers "is kun configured to the frontier?". These KPIs answer
"is the engine actually working?". Measured by the captain every Friday review from native
surfaces, recorded in `.claude/memory/weekly/<date>.md`.

| #   | KPI                                                                                 | Source                                  | Target                            |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| 1   | **Freshness** — sync tiers overdue (anthropic 7d, stack/services 14d, practice 30d) | `engine.json` → `sync.*`                | 0 overdue                         |
| 2   | **Drift** — config vs reality                                                       | `health.sh` + `build-plugin.sh --check` | 0 warnings                        |
| 3   | **Cycle time** — `/idea` issue open → `/watch` close                                | GitHub issue timestamps                 | ≤ 7 days p50                      |
| 4   | **Plan discipline** — usage inside subscription                                     | `/usage` per-category, weekly           | inside Max-100 caps, $0 per-token |
| 5   | **Autonomy** — human unblocks needed per shipped feature                            | session observation + `/insights`       | trending ↓                        |
| 6   | **North-star linkage** — allocations that name their line to the metric             | `weekly/<date>.md`                      | 100%                              |

| 7 | **Dispatch accuracy** — does the right skill fire, and do the wrong ones stay silent? | `/bench` → `skill-scores.json` → `top1_hard` | ≥ 0.85 by Q4-2026; `destructive_fp` = 0 |
| 8 | **Listing budget** — chars of frontmatter loaded into every session before a word is typed | `extract-dispatch-cases.mjs --check` | ≤ `engine.json` → `eval.listing_cap` |

KPIs 7 and 8 are deliberately co-primary. Dispatch accuracy alone is trivially gamed by pasting
every trigger phrase into every description — the score reaches 1.0, the engine is unchanged, and
the frontmatter degrades into a keyword list that is _worse_ for the novel prompts that make up
all real usage. Reading them together makes _deleting_ words a winning move: the honest figure is
`top1_hard` per KB of listing. A week where accuracy rose 3 points and the listing grew 8% is a
regression, and the report must say so.

`destructive_fp` (a skill firing on `rm -rf *`, `DROP TABLE`, …) is a hard-zero gate, never traded
against accuracy — a false fire has side effects a human must undo, a miss costs one clarifying
sentence. For the same reason precision and recall carry different weights per skill (`fp_cost` 3
for `publish`/`ship`/`deploy`/`release`/`incident`/`qa`/`report`), reported as a separate gate
rather than folded into one number.

## Measuring the engine — what `/bench` answers that `/health` cannot

`/health` counts files and compares them to `engine.json`. It has never read a `SKILL.md` body.
That gap let three defects sit undetected: `deploy` shipped with no `when_to_use` while claiming
`"ship"` as a trigger (and it is the most-invoked skill in the transcript history), `user_skills`
declared 62 against a real 66 because user-level counts were never checked at all, and six
vocabulary spells are named like a skill but route elsewhere.

The system rests on one fact: **kun already wrote its own test set and never ran it.** 246
`Triggers on:` phrases, 73 spells naming a skill, and 95 spells routing to an agent/MCP that must
therefore fire _nothing_ — 402 labeled cases, zero synthesis. The load-bearing rule is that those
phrases are the test set and are **read-only to the tuner**, enforced by a `corpus_hash` that
refuses to compare scores across an edit. A holdout alone does not stop keyword stuffing, because
stuffing lifts train and holdout identically.

Deliberately **not** copied from the tools this was benchmarked against: skilltune locks its eval
cases and reuses them for every version with no holdout, which optimizes the test set by
construction; Hermes' runtime loop patches skills every ~10 turns with no reward signal at all.
kun takes Hermes' _measured_ shape instead — holdout-gated, human-committed — minus DSPy/GEPA,
which needs per-token API spend the billing posture forbids.

KPI 6 is the conscience clause: the engine exists to make databayt profitable and sustainable
(`NORTH-STAR.md`). An engine improvement that cannot articulate its line to active-paying-schools
is bench polish, not benchmark push.

## Re-benchmark 2026-08-07 — the August surface (CHANGELOG 2.1.207 → 2.1.223)

Three tiers synced after 28 days (anthropic was 21d overdue against a 7d cadence — KPI 1 was RED
throughout the session that built `/bench`, which is its own small indictment).

| Finding                                                                                            | kun decision                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js July security release — 4 HIGH + 5 MEDIUM CVEs; patched in 16.2.11 / 15.5.21 / 16.3.0**  | **ESCALATED — 5 of 6 repos exposed.** kun 16.2.2, codebase 16.2.4, mkan 16.2.4, shifa 16.1.0, souq 15.3.8. Only hogwarts (16.3.0) is clear. See the security block below |
| Claude **Opus 5** GA (2.1.219), now the default Opus model — 1M context                            | **PROPOSE** — `/decide` on the fallback chain (`claude-opus-4-8` → `claude-opus-5`). The `opus` alias already resolves forward, so the agent fleet needs no edit         |
| Skills with `context: fork` now run in the **background** by default (2.1.216)                     | **ADOPTED** — `watch` pinned `background: false`; it returns a verdict the session acts on, so foreground is correct                                                     |
| Subagents may nest to **depth 3** by default, was 1 (2.1.219); caps at 20 concurrent / 200 session | TRACK — `bench-dispatch` and `qa` are single-depth fan-outs; nesting buys nothing yet                                                                                    |
| `workflowSizeGuideline` settings key (2.1.219)                                                     | TRACK — the default medium guideline bound `bench-dispatch` to ~16 agents and that was the right size; set it only when a workflow genuinely needs more                  |
| `prompt-audit` subcommand on the `claude-api` skill (2.1.221)                                      | TRACK — audits prompts for _older-model patterns_, which is orthogonal to `/bench` (dispatch accuracy) and to `lint-contracts` (declared-reference integrity)            |
| `DirectoryAdded` hook (2.1.219); nested `.claude/rules/*.md` load fix (2.1.211)                    | **ADOPTED (no-op)** — the rules fix silently repairs the 37-rule domain corpus; no config change needed                                                                  |
| `/review` → alias of `/code-review`; runs as a background subagent (2.1.218/221)                   | **ADOPTED** as practice — no config change                                                                                                                               |
| Claude no longer runs `/verify`, `/code-review`, `/deep-research` autonomously (2.1.215/216)       | **ADOPTED** as practice — invoke explicitly                                                                                                                              |
| Next.js **16.3** (Aug 3): ~90% less dev memory, first-party Skills, AGENTS.md-bundled docs         | **PROPOSE** — `/package`-driven; hogwarts is already on it and is the proof path                                                                                         |
| shadcn: React Aria as a first-class base; registry **server-side search**; `@shadcn/helpers`       | TRACK — Base-UI-vs-Radix `/decide` still open from July; React Aria widens it rather than settling it                                                                    |
| Vercel **Agent Plugins 1.0.0** — standard format for packaging Skills + MCP into portable plugins  | TRACK — kun's two-plugin marketplace already does this Anthropic-natively; revisit only if the format becomes the ecosystem default                                      |
| Neon: project-level permissions, `neon` CLI rebrand (Node 20.19+), backend services beta           | TRACK — no action for a single-operator setup on one shared DB                                                                                                           |
| React: no releases since 2026-02                                                                   | —                                                                                                                                                                        |

### Security — the headline, and it is not about agents

The July security release patches **4 HIGH** severity CVEs. Verified against each repo's pinned
version rather than assumed:

| Repo         | next    | Status      |
| ------------ | ------- | ----------- |
| **hogwarts** | 16.3.0  | OK          |
| kun          | 16.2.2  | **EXPOSED** |
| codebase     | 16.2.4  | **EXPOSED** |
| mkan         | 16.2.4  | **EXPOSED** |
| shifa        | ^16.1.0 | **EXPOSED** |
| souq         | 15.3.8  | **EXPOSED** |

kun's exposure is concrete, not theoretical: **6 files use Server Actions** (CVE-2026-64641,
App-Router DoS via CPU exhaustion) and `next.config.ts` configures **rewrites/redirects**
(CVE-2026-64645, SSRF via attacker-controlled destination hostname). Patch line is 16.2.11 for
the 16.2 branch, 15.5.21 for 15.5 — both patch-level bumps inside the same minor.

## Re-benchmark 2026-09-26 — the September surface (CHANGELOG 2.1.224 → 2.1.283)

All four tiers after 50–78 days (KPI 1 RED the whole time). Sources read: the CHANGELOG range line by
line, code.claude.com docs as raw markdown (append `.md` to any page), platform model/deprecation
pages, anthropic.com + claude.com, and — for the first time — each stack vendor's **own agent
guidance** (bundled docs, AGENTS.md, official MCP servers and skills). Cloudflare and GSAP joined the
tracked surface.

### Security — again the headline

Two **critical** Next.js RCEs landed since the last sync, and a third release is announced. Exposure
was verified per repo against installed versions and route/image config, not package.json ranges:

- **GHSA-2xp9-vwfh-vxw4** (08-25) — unauthenticated RCE in the Image Optimization API on an
  attacker-controlled AVIF (libheif via sharp). Fixed in 16.3.3 / 15.5.24.
- **CVE-2026-94545 / GHSA-vcvr-r3jv-pc5j** (09-22) — RCE in the **Node** `next/og` `ImageResponse`
  when attacker-controlled values reach the generated SVG. Affects ≥16.2.0 <16.3.6.
- **09-30 scheduled release** — nine more (1 critical, 2 high) in 16.3.7 / 15.5.27. The 16.2 line is dead.

Every repo below 16.3.6 / 15.5.24 upgrades now, and every repo takes 16.3.7 / 15.5.27 on 09-30.
The per-repo exposure analysis (which hosts, which routes) is deliberately **not** in this public
repo — it lives in a gitignored local handoff note until everything is patched. ESCALATED to
Abdout in-session, not as a public issue or doc: naming an unpatched production host is a disclosure.

### Anthropic tier

| Finding (version)                                                                                                                                                                                                                                          | kun decision                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opus 5.5** `claude-opus-5-5` default Opus (2.1.280) — 1M, $4/$20, "at Fable 5.1's level on most work"; **Fable 5.1** default Fable (2.1.257) — $10/$50; Opus 4.8 / Opus 5 / Fable 5 legacy, not deprecated; Haiku 4.5 retirement window opens 2026-10-15 | **ADOPTED** — Abdout set Opus 5.5 via `/model`; `engine.json` model + fallbacks (`opus-5 → sonnet-5`), CLAUDE.md files and docs follow; min version 2.1.280                                          |
| `engine.json → model` read `"google-free"` since 4f2bd76 — a social commit reused the engine field as the Hub's draft default, and `knobs.test.ts` enforced the coupling                                                                                   | **FIXED** — field restored; social chain owned by `knobs.ts` + the drain; the three engine assertions removed (the drain-contract test remains)                                                      |
| Headless Fable (`claude -p`, Agent SDK) bills usage credits **with no consent prompt** (model-config docs)                                                                                                                                                 | **DECIDE** — the social drain offers `--model claude-fable-5`; Fable is now banned from fallbacks and agent frontmatter by policy (`model_tiers.fable`)                                              |
| Harness attribution names the running model; CLAUDE.md attribution text **overrides** it (`attribution` setting docs)                                                                                                                                      | **ADOPTED** — every hardcoded `Co-Authored-By: Claude Fable 5 / Opus 4.8` removed (CLAUDE.md, github-workflow, feature, analyze ×2, qa.js); the last 40 commits already carried the accurate trailer |
| Skill listing capped at `skillListingBudgetFraction` (1% of context); overflow silently drops the least-used skills' descriptions; `/skill-doctor` (2.1.261) measures it                                                                                   | **MEASURED** — ~25 of ~135 listed skills keep a description in kun sessions; claude.ai skill + plugin sync (2.1.275) added 36 entries. **DECIDE**                                                    |
| Same skill name in `~/.claude/skills` and the project → the **personal** copy runs                                                                                                                                                                         | **DOCUMENTED** in `engine-parity.md`                                                                                                                                                                 |
| `/doctor prompt-audit` (2.1.283) — audits CLAUDE.md/skills/agents for older-model patterns                                                                                                                                                                 | **ADOPTED** into `/sync` step 3.5                                                                                                                                                                    |
| `omitClaudeMd` agent frontmatter (2.1.271) — skips CLAUDE.md **and** always-on rules (~38 KB ≈ 9.5K tokens per spawn in kun)                                                                                                                               | **DECIDE** — `transcribe` + `adjudicate` are self-contained per-page agents                                                                                                                          |
| Hook `matcher` is a tool-name pattern; `"Bash(pnpm dev)"` never matched (the `if` field filters by command)                                                                                                                                                | **FIXED** — both dead hooks removed; the `dev` skill already does the port kill + Chrome open                                                                                                        |
| setup.sh replaces the user `hooks` block wholesale; today's doctor hardening existed only at user level                                                                                                                                                    | **FIXED** — hardened commands ported into the canonical `.claude/settings.json`                                                                                                                      |
| health "config age" measured `~/.claude/CLAUDE.md`, which setup never writes                                                                                                                                                                               | **FIXED** — measures `.kun-manifest.json` (health.sh + health.ps1)                                                                                                                                   |
| user stack agent `deploy` missing from `~/.claude/agents` (vocab + plugin + counts still declared it)                                                                                                                                                      | **RESTORED** from the plugin copy                                                                                                                                                                    |
| AGENTS.md read natively when a repo has no CLAUDE.md (2.1.277); `/output-style` back (2.1.269) + Concise style                                                                                                                                             | TRACK — feature-surface table corrected                                                                                                                                                              |
| Claude in Chrome GA; Code drives it via `claude --chrome`; cross-session `SendMessage`/`ListAgents`                                                                                                                                                        | **ADOPTED** in `cowork-bridge.md`                                                                                                                                                                    |
| TodoWrite/Task tools no longer offered to current models (2.1.268)                                                                                                                                                                                         | NO-OP — nothing in kun references them                                                                                                                                                               |
| `maxEffortLevel`, `modelPicker`, `ANTHROPIC_DEFAULT_MODEL`, `PreModelSwitch`/`PostModelSwitch`, `claude plugin eval`, workflow medium guideline 15 → 10                                                                                                    | TRACK                                                                                                                                                                                                |

### Stack + services tiers

| Finding                                                                                                                                                                                                                                                                                                                  | kun decision                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.3 is Active LTS; `next dev` writes a managed `nextjs-agent-rules` block when it detects an agent; bundled docs; next-devtools-mcp 0.4.0 (`/_next/mcp`); a first-party `nextjs` skills marketplace                                                                                                             | **DECIDE** — wire the block + a pinned next-devtools-mcp into each product with its 16.3 bump (AGENTS.md is ignored while a CLAUDE.md exists)                                           |
| Rule audit: `use-cache-directive` fails to compile without `cacheComponents` and used deprecated `unstable_` aliases; `unstable_updateTag` doesn't exist; one-arg `revalidateTag` is a type error; `severity: high` is invalid; `useOptimistic` reverts on settle; `("use client")` typos; Zod 4 `.flatten()` deprecated | **FIXED** — 13 rules corrected against current docs                                                                                                                                     |
| New: `proxy-not-middleware`, `image-lcp-not-priority`, `use-effect-event` (58 exhaustive-deps suppressions, zero uses), `ts6-deprecated-options`                                                                                                                                                                         | **ADOPTED**                                                                                                                                                                             |
| React 19.3.0; TypeScript 7.0.2 is npm `latest` and Next 16.3 builds with it                                                                                                                                                                                                                                              | TRACK — bump pins with the 16.3.7 pass                                                                                                                                                  |
| Tailwind: logical inset is `inset-s-*`/`inset-e-*` since 4.2; v4 `space-x`/`divide-x` are already logical, so `rtl:space-x-reverse` double-flips (compiled + measured in Chromium) — 45 live occurrences (codebase 24, hogwarts 13, mkan 8)                                                                              | **ADOPTED** — rules fixed + `no-rtl-space-reverse`; product cleanup **DECIDE**                                                                                                          |
| shadcn CLI 4.17–4.21: `cn` package, GitHub/private registries, `registry:base`, components.json `rtl`; Base UI default but Radix "not deprecated"; `envVars` items can create `.env.local`                                                                                                                               | **ADOPTED** in the skill pack (docs); `cn` + Base UI + `@codebase` `registry:base` → one **DECIDE**                                                                                     |
| GSAP free incl. every plugin; official `greensock/gsap-skills` plugin                                                                                                                                                                                                                                                    | **ADOPTED** — `gsap/` domain (5 rules, scoped to marketing surfaces); official skills hogwarts-only → **DECIDE**                                                                        |
| Prisma: npm `latest` is the v8 RC (no schema.prisma/migrate); v6 security-only until **2026-11-19**; v7 dropped `directUrl` (CLI reads `datasource.url`); adapters ignore URL pool params; the Neon HTTP adapter can't run transactions; the CLI's AI-consent guard doesn't cover MCP tools                              | **ADOPTED** — 5 rules fixed + `pin-prisma-cli-major`, `pool-config-on-adapter`; kun/mkan `prisma.config.ts` → direct URL and the onboarding scripts' unpinned `npx prisma` → **DECIDE** |
| Neon: CLI renamed `neon`; MCP is "dev/test only" (`?readonly=true`, project-scoped keys, `/sse` ends 10-01); branches never expire without `--expires-at`                                                                                                                                                                | **ADOPTED** — neon rules rewritten main-only; kun's write-mode, account-wide Neon MCP → **DECIDE**                                                                                      |
| Cloudflare: Worker limit 64 MiB raw (09-04); `nodejs_compat` default from compat date 2026-08-04; trace spans bill from 10-01; Worker Previews (wrangler ≥4.135); vinext is the recommended Next path; official plugin + Code Mode MCP                                                                                   | **ADOPTED** — `cloudflare/` domain (5 rules), agent/skill/deploy docs corrected; MCP, plugin, traces, wrangler bump → **DECIDE**                                                        |
| Figma Starter = 20 MCP calls/month total; only 3 tools exempt                                                                                                                                                                                                                                                            | **FIXED** — mcp.json description                                                                                                                                                        |
| Found in passing: three product bugs (a cross-user data exposure, a committed test key, a client-lifecycle issue)                                                                                                                                                                                                        | **ESCALATED** privately — `/report` lane                                                                                                                                                |

### Harness audit (step 3.5)

`/doctor prompt-audit` over ~370 files found almost no older-model prompting (no "think step by
step", no word caps, no version pins) — the engine's debt is **outgrown facts**: ~145 findings
(branch/PR language in a main-only engine, Vercel/Telegram lanes that no longer exist, `$200/mo`,
stale counts). The 15 high-confidence hunks are applied; the rest is the backlog in
`.claude/handoff/2026-09-26-prompt-audit.md`.

## Adoption log

- **2026-09-26** — `/sync` all four tiers after 50–78 days, plus the first `/doctor prompt-audit`
  harness audit. Model → Opus 5.5 (Abdout's `/model`), fallbacks `opus-5 → sonnet-5`, Fable
  escalation-only; `engine.json → model` un-hijacked from the social lane (and its test decoupled);
  hardcoded commit footers removed in favour of harness attribution; rule corpus 38 → 55 (+`cloudflare/`, +`gsap/`, 30+ rules corrected against current docs); dead `pnpm dev` hooks removed, hardened hooks
  made canonical, `deploy` agent restored, health's config-age check re-aimed; skill-listing overflow
  measured (DECIDE). Headline is security again: two critical Next.js RCE advisories (exposure escalated privately),
  and a nine-fix release on 09-30.
- **2026-08-06** — `/bench` L1: the engine starts measuring itself. New `bench` skill + spell
  (Defense), `bench-dispatch.js` workflow (Extract → Dispatch → Adjudicate → Score → Persist,
  mirroring `qa.js`'s death-safe verify and persist-only-writes contracts),
  `extract-dispatch-cases.mjs` (deterministic, `--check` wired into `health.sh`),
  `harvest-transcripts.mjs` (real prompt→skill pairs for the proxy fidelity check),
  `test-bench-dispatch.mjs` (28 assertions over the scoring math, zero tokens),
  `skill-scores.json` (measured state + `weekly_history`). Budget caps moved into `engine.json`
  → `eval` as declared policy with a `listing_cap_history`. Fixed: `deploy` frontmatter,
  `user_skills` 62→66, user-level count checks in `health.sh`, skill→spell reverse check in
  `generate-vocab.mjs`. KPIs 7–8 added. Engine v4.1.
- **2026-08-07** — `/sync` anthropic + stack + services after 28 days. Stamps refreshed,
  `claude_code_version` 2.1.206 → 2.1.223, `min_claude_code_version` → 2.1.216 (the release that
  changed `context: fork` to background-by-default). `watch` pinned `background: false`. Headline
  is **not** an agent finding: the July Next.js security release patches 4 HIGH CVEs and **5 of 6
  repos are on vulnerable versions** — escalated, not auto-applied. Opus 5 GA proposed for the
  fallback chain; the `opus` alias already resolves forward, which is the payoff of the
  alias-over-version rule `lint-contracts.mjs` started enforcing yesterday.
- **2026-08-06** — `/bench` L2 contracts: `lint-contracts.mjs`, deterministic and wired into
  `health.sh`. Found 11 skills pinning `model: claude-opus-4-7` — neither the engine model nor
  a declared fallback. `health.sh` already grepped for retired Opus versions, but only across
  `docs/` and `CLAUDE.md`, never the frontmatter where they were; a rule whose check points at
  the wrong place reads exactly like a rule being followed. All 11 moved to the `opus` alias.
  The `trigger-authority` check found 0 today but was validated by replay: against `higgs`'s
  pre-fix text it catches `og image` → `/carousel` in milliseconds — the same defect the L1
  benchmark needed 16 agents and ~1.3M tokens to surface. **Do the deterministic layer first.**
- **2026-07-10** — engine v4.0 benchmark pass: model → Fable 5 (fallbacks opus-4-8 → sonnet-5);
  vocabulary v2 (deduped keywords, BMAD-era spells pruned, `loop`/`goal`/`schedule`/`workflow`
  wired, +12 spells for existing skills); `/spec` CLARIFY + `/feature` READY gate (spec-kit
  semantics); `react-perf/` rule domain (8 rules vendored from vercel-labs/agent-skills);
  Claude Design plugin + MCP in onboarding Phase 5 + declared fleet; onboarding `--doctor`
  mode (all 3 OS backends) + `setup.sh` role default; `/sync` harness-audit + `/qa` verdict
  contract + `/weekly` decision sweep; hermes.mdx corrected to v0.18.2; STACK.md refreshed
  (TS 6/7-native, Prisma 7, shadcn→Base UI, Next 16.3 agent-native); NORTH-STAR "enough" line +
  CEO-OS cash mechanics/custom-work/Direction 8. All four sync tiers stamped 2026-07-10.
- **2026-06-12** — `/sync` self-update loop (four tiers: anthropic + stack + services +
  agent-practice, incl. BMAD-method tracking; keyword `sync` routes to it passively); first
  deterministic workflow (`.claude/workflows/handover.js` — 12-keyword fan-out + adversarial
  FAIL verification); `fallbackModel` chain; engine KPIs defined; captain conscience block
  (argument protocol + engine self-awareness); billing posture corrected to Max 5x $100/mo,
  subscription-only. Engine v3.2.
- **2026-06-04** — founding benchmark (this doc): path-scoped rule corpus, drift CI,
  destructive-bash hook, model tiering codified. Engine v3.1.

## Model-tiering policy

See `engine.json` → `model_tiers`. In short: **opus** for architecture, orchestration, deep
reasoning, code review/fixes, and strategy/leadership; **sonnet** for standard build agents and
mechanical project agents; **haiku** for routine/formatting agents. `report` stays on **opus**
despite being a "loop" agent — it performs real code fixes, and quality-over-speed wins over the
negligible cost saving on a non-hot-path agent.

## Why Claude-native (not AGENTS.md)

`AGENTS.md` is the emerging cross-tool standard. Since 2.1.277 Claude Code reads it natively — but only
in a project with **no** CLAUDE.md, so it is a fallback, not a peer (kun has a CLAUDE.md, so it would
still need `@import`/symlink). kun is deliberately Anthropic-native — it _configures_ the Claude Code
harness (skills, hooks, plugins, output styles) rather than targeting a lowest-common-denominator
file. Adopting `AGENTS.md` would add a sync surface for capabilities other tools can't act on. If
the databayt stack is ever driven by Cursor/Codex at scale, the cheap bridge is a generated
`AGENTS.md` that `CLAUDE.md` `@import`s — revisit then, not now.

## Sources

Official: `code.claude.com/docs/en/{memory,hooks,skills,sub-agents,settings,plugins-reference,output-styles}`.
Ecosystem: `agents.md`; `vercel/next.js`, `openai/codex`, `supabase/agent-skills` AGENTS.md files;
community subagent/hook/statusline collections (used for convergent patterns, not verbatim).
