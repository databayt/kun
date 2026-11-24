# Encrypt plan (nothing here has been run)

Goal: move the PRIVATE part of `.claude/memory/` into `.claude/memory/private/<path>.enc` (sops + age), keep a decrypted copy per machine at `~/.kun/memory-private/<path>`, switch the readers, then enforce the guard. Do it in one pass (rule: whole plan, then deploy once). Tooling is built and tested (`node --test .claude/scripts/memory/*.test.mjs`).

Convention: a path `P` under `.claude/memory/` becomes `~/.kun/memory-private/P` for readers. Readers must fall back to the old repo path while the switch is rolling out (`existsSync(private) ? private : repo`).

## 1. Files to encrypt (52 tracked files)

| Group | Files | Why |
| --- | --- | --- |
| Customers + pipeline | `crm.json` `customers.json` `customers.legacy.json` `pipeline.json` | schools, contacts, deal state, CRM members |
| Money | `revenue.json` `runway.json` | MRR, burn, runway |
| People | `team.json` `capacity.json` `hiring.md` `1on1/*.md` (6) | roles, emails, load, personal 1:1 notes |
| Strategy | `okrs.json` `risks.json` `north_star.json` `captain_journal.md` `weekly/*.md` (2) | targets, risk scores, CEO journal |
| Decisions | `decisions/*.md` (30) | pricing, share economy, jobs lane, spend; see note below |
| Voice | `feedback.jsonl` | founder quotes |
| State (untracked, now gitignored) | `.claude/state/org-queue.md` `org-inventory.md` | org issue queue + local repo inventory; keep local, do not encrypt into git |

Stay PUBLIC: `repositories.json` `skill-scores.json` `textbook-scores.json` `learnings.md` (engine facts and scores).
Decisions note: purely technical ones (cdn migration, figma-first, ai-sdk lanes, livekit x5, neon launch plan, security hardening) could stay public; the default here is to encrypt the whole folder, because most of the 30 mention money, schools or customers. Owner may move technical ones to `facts/` as one-fact files afterwards.

Command, per file (it moves it: writes the `.enc`, places the plaintext in `~/.kun/memory-private/`, deletes the repo copy):
```
for f in <list>; do node .claude/scripts/memory/memory.mjs encrypt .claude/memory/$f; done
node .claude/scripts/memory/memory.mjs sync      # commits private/ + the removals, pushes
```
Then in `guard.config.json` move the `pending` regexes (except `.claude/state`) into `enforced`.

## 2. Readers today and how each switches

Skills/agents hard-code `/Users/abdout/kun/.claude/memory/<file>`. Edit the source in `.claude/skills|agents/`, then run `build-plugin.sh`, `mirror-agents.mjs`, `setup.sh` (engine-parity rule; also `~/.claude/skills` copies, `.agents/`, `.codex/`, `plugins/kun-company/` are build artifacts). In text, replace the prefix `/Users/abdout/kun/.claude/memory/` with `~/.kun/memory-private/` for the private files only.

| Reader | Reads | Switch |
| --- | --- | --- |
| skills `captain` `decide` `premortem` `weekly` `proposal` `scrape` `jobs` `calendar` `social`, agent `business`, `.codex/agents/{captain,business}.toml` | journal, runway, north_star, okrs, risks, pipeline, revenue, team, capacity, customers, 1on1, weekly, decisions | path prefix swap in the SKILL.md / agent text; `decide` writes `decisions/*.md` -> write to `~/.kun/memory-private/decisions/` then run `memory.mjs sync` as the last step |
| `~/.claude/hooks/pre-compact-captain.sh`, `config-change-audit.sh` | memory paths | read prefix swap; confirm what they grep |
| `.claude/scripts/aware.mjs` (line ~380) | `decisions/*.md` Reviewed-by dates | `ddir = ~/.kun/memory-private/decisions` (fallback repo path) |
| `.claude/scripts/company-brief.mjs` (line 79) | `north_star.json`, writes `departments/_shared/company.md` | read from `~/.kun/memory-private/`; **the generated company.md is tracked and public**, so confirm it only carries the metric definition and targets, not customer counts or names |
| `.claude/scripts/kun-ready` (line 118) | `crm.json` `.workspaces[].product` | `jq` on `~/.kun/memory-private/crm.json` |
| `scripts/captain/weekly.sh` (lines 41-45, 134) | writes/reads `weekly/<date>-plan.md` in the repo | `out=~/.kun/memory-private/weekly/...`, then `memory.mjs sync` |
| `.claude/scripts/setup.sh` (line 144) | `cp memory/*.json ~/.claude/memory/` copies EVERY json, private ones included, onto every teammate machine | restrict to public files, add `node .claude/scripts/memory/memory.mjs sync` (needs the key), and `git config core.hooksPath .githooks`; same in `setup.ps1` |
| `.claude/scripts/maintain.sh` heartbeat | (runs setup) | add `memory.mjs sync` to the daily beat so every machine converges |
| `src/components/root/team/config.ts`, `spellbook-data.ts`, `content/docs/*.mdx`, `docs/*.md`, `prisma/schema.prisma`, `src/generated/prisma/*` | mentions only (comments/strings) | no code read; dangling path in comments is harmless; leave, or retarget the `decisions/2026-07-30-in-app-draft-spend.md` comment to a `facts/` summary |
| `.claude/evals/cases/dispatch*.json` | prompt text mentioning `memory/weekly` | none |
| `.claude/memory/repositories.json` etc. | public | none |

Unverified: other repos (hogwarts, mkan, …) and `~/.claude` hooks outside the greps above may read `~/.claude/memory/*.json` (the setup.sh copy). After the switch, grep `~/.claude/memory/` consumers: `grep -rIl "\.claude/memory" ~/.claude ~/*/.claude 2>/dev/null`.

## 3. Rollout order

1. Install sops+age and the age key on each machine (`provision` skill), back up `keys.txt`.
2. `git config core.hooksPath .githooks`.
3. Encrypt (section 1), sync, update readers (section 2) in the same pass, run `build-plugin.sh`, `mirror-agents.mjs`, `generate-vocab.mjs`, `health.sh`.
4. Flip `guard.config.json` pending -> enforced; `node --test .claude/scripts/memory/*.test.mjs`.
5. Rotate what the audit lists (see `.claude/handoff/2026-11-24-memory-privacy-audit.md`). Encrypting going forward does NOT remove history: old plaintext stays in every clone and fork until history is rewritten (owner's decision).

## 4. Not covered

Mobile/Cowork (no sops): they read through `~/.kun/memory-private/` on the Mac. Binary/large files (`textbook-scores.json`) stay public.
