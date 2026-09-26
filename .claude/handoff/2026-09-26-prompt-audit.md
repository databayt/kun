# Prompt audit — kun Claude Code config (2026-09-26)

Report only. Nothing below has been applied.

## Assumptions (Step 0)

- **Scope.** This covers the Claude Code config that loads in a kun session:
  - `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and `.agents/rules/AGENTS.md`. Both AGENTS.md files are byte-identical mirrors of `.claude/CLAUDE.md`.
  - `.claude/{rules,rules-global,skills,agents}`.
  - `~/.claude/CLAUDE.md` and `~/.claude/{rules,skills,agents}`. 121 of these files are copies that `setup.sh` makes of kun files. About 60 are user-only.
  - The ancestor file `/Users/abdout/AGENTS.md`.
  - Plugin files and synced skills, which are reported on without proposed edits.
- **Found in no location:** managed-policy CLAUDE.md, `commands/`, `output-styles/`. No CLAUDE.md contains an `@` import.
- **Not read:** settings, `mcp.json`, `.mcp.json`, `~/.claude.json`, `.env`.
- **Target model.** Claude Opus 5.5, the model running this session. Files that pin `model: opus|sonnet` were audited against that alias. None pins a stale model version.
- **The files changed while this audit ran.** Another kun session was editing the same files at the same time. It already fixed:
  - the model and commit-footer pins in `.claude/CLAUDE.md` (lines 12 and 17);
  - `~/.claude/CLAUDE.md:5`;
  - `engine.json`;
  - `next-16/{revalidate-after-write,server-actions-for-mutations,use-cache-directive,async-request-apis,sw-no-authenticated-cache}`;
  - the Telegram fallback in `measure`;
  - the PR row in `~/.claude/agents/git.md`.

  Those items are left out below. Every finding marked OPEN was re-grepped against the tree at the end of the audit.

- **Edits under `~/.claude` affect every project.** For the 121 copied files, edit the kun source (`.claude/…`) and run `bash .claude/scripts/setup.sh`. Editing the copy alone gets overwritten on the next daily sync. Per engine-parity, the personal copy is the one that runs.

## Summary

The config has almost no dated _model-era_ prompting:

- no think-step-by-step scaffolds, scratchpad tags or word caps;
- pressure language only where it is trigger text or carries a reason.

The rot is in **Group 2: facts the engine has outgrown**. Three moves account for most of it:

1. **Main-only git.** Skills and agents still prescribe branches, PRs, `type/feat` labels and "hotfix from a non-main branch". The worst offender is `rules-global/github-workflow.md:87` itself, which still says "Vercel auto-deploys main".
2. **Vercel → Cloudflare and Telegram → Slack/Facebook.** `report`, `facebook`, `publish`, `social`, `carousel`, `approve`, `ops`, `funnel`, `monitor`, `incident` and several `~/.claude` agents route work to lanes that no longer exist. Examples: a Telegram script that isn't in the repo, a Vercel env for kun, and `TELEGRAM_REVIEW_CHAT_ID`.
3. **Counts and prices hardcoded against `engine.json`.**
   - "Max $200/mo" appears in `costs`, `ops` and `revenue`, but the plan is $100.
   - "44 agents", "67 skills" and "160 spells" don't match `engine.json` (26+53 agents, 59 skills, 213 spells).

Highest-impact single items:

- `~/.claude/skills/dev` runs `kill -9` on port 3000. The repo's own mcp-doctor ledger (E9) says this kills the browser MCP's Chromium.
- `~/.claude/rules/testing.md` and `prisma.md` are hogwarts-only rules that load in every repo.
- `~/.claude/agents/middleware.md` and related files still target `src/middleware.ts`. Every repo uses `src/proxy.ts`.

**Counts, OPEN findings only:**

- Group 1: 9 findings (1a 2, 1b 1, 1c 4, 1d 3).
- Group 2: about 135 findings (stale facts about 70, cross-file contradictions about 50, history/time-sensitive about 15).
- Group 3: 0. Frontmatter trigger text is calibrated.
- Group 4: 1, the four near-identical product "reference" agents. Otherwise not applicable, since no request-building code is in scope.
- Plugins: the five installed plugins ship no prompt files. The synced Anthropic skills have 6 low/medium flags, report-only.

---

## A. Top-level instruction files (audited in the main session)

| #   | Location                                                                                          | Evidence                                                                                                | Pattern                | Why                                                                                                                                                                                                            | Conf | Action                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `.claude/CLAUDE.md:3-4` (mirrored in `AGENTS.md:3-4` and `.agents/rules/AGENTS.md:3-4`)           | "(Component Hierarchy, Reference Codebase, Imported Rules)"                                             | G2 stale fact          | `~/.claude/CLAUDE.md` has no "Imported Rules" section; it says rules auto-load and "no imports needed".                                                                                                        | High | rewrite → `(Preferences, Component Hierarchy, Reference Codebase, Keyword Vocabulary)`                                                         |
| A2  | `CLAUDE.md:32`                                                                                    | "`.claude/CLAUDE.md` (Tier 1 pipeline, Tier 2 sweeps, Tier 3 vocabulary)"                               | G2 stale fact          | `.claude/CLAUDE.md` has no tiers or sweeps. Its sections are the Drive, Preferences, Agents, Pipeline, Vocabulary, Behavior and Lookups.                                                                       | High | rewrite → `` `.claude/CLAUDE.md` (the Drive, preferences, agent lanes, pipeline, vocabulary) ``                                                |
| A3  | `~/.claude/CLAUDE.md:49` and source `.claude/templates/user-CLAUDE.md:44` (**all projects**)      | "(160 spells, browsable at …)"                                                                          | G2 stale count         | `engine.json` → `counts.vocabulary_spells` = 213.                                                                                                                                                              | High | rewrite → `(count: engine.json → counts.vocabulary_spells; browsable at kun.databayt.org/en/docs/keywords)` in the template, then run setup.sh |
| A4  | `.claude/rules-global/github-workflow.md:85-87` (deploys to `~/.claude/rules/`, **all projects**) | "Vercel auto-deploys `main` on push. Nothing to do."                                                    | G2 contradiction       | `agents/cloudflare.md:14` says Vercel is dead. kun, hogwarts and mkan have `wrangler.jsonc` and do not deploy on push.                                                                                         | High | rewrite (see diff)                                                                                                                             |
| A5  | `~/.claude/rules/github-workflow.md:64`                                                           | "Co-Authored-By: Claude Fable 5"                                                                        | G2 pinned model        | The kun source already replaced this with the harness trailer (uncommitted). The deployed copy is stale.                                                                                                       | High | flag. No project-driven edit to a user file. Commit the source and run setup.sh.                                                               |
| A6  | `.claude/templates/user-CLAUDE.md` vs `~/.claude/CLAUDE.md`                                       | The template lacks the shadcn-pattern paragraph and `record`.                                           | G2 drift               | setup.sh `cp`s the template over the live file, which would delete the newer text.                                                                                                                             | High | flag. Decide which is canonical, then sync.                                                                                                    |
| A7  | `/Users/abdout/AGENTS.md:5,12,27,36,40,48-50` (ancestor, outside the project)                     | "`Codex-fable-5`", "`~/.Codex/rules/`"                                                                  | G2 stale fact          | This is a sed-translated Codex copy of the user CLAUDE.md. `Codex-fable-5` is not a model, and `~/.codex/rules` doesn't exist. If Claude Code loads it, it duplicates `~/.claude/CLAUDE.md` with broken paths. | Med  | flag. Decide whether it should exist at all; its reader is unclear.                                                                            |
| A8  | `.claude/CLAUDE.md:40-65` (generated vocab block)                                                 | 213 keywords in every session, many of which route to no skill (`gesture`, `menu`, `card`, `linear`, …) | G2 trigger enumeration | This is an always-loaded list. `~/.claude/CLAUDE.md` already calls the skills listing "the routing truth".                                                                                                     | Low  | flag. The fix belongs in `generate-vocab.mjs` (it has a sync check), not a hand edit.                                                          |

## B. Project skills (`.claude/skills/`)

High, OPEN:

| Location                              | Evidence                                                                    | Why                                                                                         | Action / replacement                                                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| costs/SKILL.md:16                     | "Claude Max subscription: $200/mo"                                          | `.claude/CLAUDE.md` and engine.json billing say $100.                                       | `- Claude Max subscription: fixed plan cost — see .claude/CLAUDE.md → Billing (subscription-only, no API spend)`                                                                                                                                                             |
| cloudflare/SKILL.md:26                | "`databayt.org` (**not on Cloudflare yet**)"                                | `wrangler.jsonc` routes `kun.databayt.org/*`; the zone moved 2026-09-18.                    | `\| kun \| ~/kun · databayt/kun \| kun \| databayt.org \| kun.databayt.org (proxied route); kun.osmanabdout.workers.dev stays as smoke target \|`                                                                                                                            |
| carousel/SKILL.md:70,96-97,152-153    | "`node scripts/post-to-telegram.mjs`", "lanes today: Telegram and Facebook" | The script doesn't exist, and there is no telegram channel in `social/config.ts`.           | Remove the Telegram row and clause. At :152: `- Automated publish lane today: **Facebook** (multi-photo via post-to-facebook.mjs --photos, 2–10 images). Instagram/WhatsApp/LinkedIn have no wired publish API — exports + captions stay upload-ready by design.`            |
| approve/SKILL.md:79-83                | "`TELEGRAM_REVIEW_CHAT_ID`"                                                 | Not referenced anywhere. `reviewChannel()` defaults to slack.                               | `4. **Where it lands**: the review channel from SOCIAL_REVIEW_CHANNEL (default slack), which must be **private** — approval links in a public channel let any reader post as the brand.`                                                                                     |
| draft/SKILL.md:171-172                | "the 5-minute drain tick"                                                   | :259 of the same file and `drain-drafts.sh` say it runs every 60 seconds.                   | `— the drain tick has no generation tools, by design.`                                                                                                                                                                                                                       |
| calendar/SKILL.md:16-20               | "pillars.json carries hogwarts' 8 briefs and nothing else"                  | pillars.json has hogwarts, mkan, balqalam and databayt.                                     | `**SCOPE** — plan only the brands that have briefs in content/social/pillars.json; say the rest are deferred by decision rather than planning empty rows.` (keep the two Sudan inversions and the decision-file pointer)                                                     |
| analyze/SKILL.md:65,208-210,231,267   | "`commands/` — mapped skills"                                               | Commands are retired (`engine.json` commands: 0).                                           | Rename to `skills/` throughout.                                                                                                                                                                                                                                              |
| analyze/SKILL.md:229                  | "(of 44 available)"                                                         | Counts are 26+53.                                                                           | `- agents/ — <N> agents selected`                                                                                                                                                                                                                                            |
| bench/SKILL.md:10,95                  | "kun ships 67 skills"                                                       | There are 59.                                                                               | `kun ships every skill in .claude/skills/ into every session (count: engine.json → counts.project_skills).`                                                                                                                                                                  |
| sync/SKILL.md:55                      | "(`.claude/rules/github-workflow.md`)"                                      | Dead path.                                                                                  | → `.claude/rules-global/github-workflow.md`                                                                                                                                                                                                                                  |
| report/SKILL.md:90,100                | "kun redeploys itself on push (Vercel)"                                     | kun is on Cloudflare (wrangler.jsonc).                                                      | `10. **VERIFY** — hogwarts, mkan and kun are on Cloudflare and do not redeploy on push: say so in the close comment and run /deploy <repo> or leave the one-line command for Abdout`; row: `\| kun \| /Users/abdout/kun \| kun.databayt.org (Cloudflare) \| no → /deploy \|` |
| social/SKILL.md:71-72                 | "`telegram` and `facebook` (direct APIs…)"                                  | The `ChannelTransport` union has no telegram and does have instagram.                       | `Transports: facebook and instagram (direct APIs, drained by kun), hermes (the gateway pulls its own work), and **manual** — WhatsApp,`                                                                                                                                      |
| release/SKILL.md:88-90                | "`--label type/feat`"                                                       | github-workflow and `idea` use `type:feature`.                                              | `type:feature` in both places                                                                                                                                                                                                                                                |
| release/SKILL.md:220                  | "Hotfix from a non-main branch — use /ship"                                 | Main-only.                                                                                  | remove                                                                                                                                                                                                                                                                       |
| ship/SKILL.md:27,54                   | "deploy current branch" / "`--from-branch`"                                 | Main-only. The flag isn't in argument-hint.                                                 | `/ship — deploy main to production`; `Refuse if current branch is not main`                                                                                                                                                                                                  |
| publish/SKILL.md:36                   | "`DRAIN_CHANNEL_IDS` — telegram, facebook, instagram"                       | `DRAIN_TRANSPORTS = ["facebook","instagram"]`.                                              | `— facebook, instagram.`                                                                                                                                                                                                                                                     |
| facebook/SKILL.md:121,144             | "Vercel **production, preview and development**"                            | kun deploys via Cloudflare.                                                                 | `.env plus the production Worker's secrets via the deploy lane (scripts/cf-secrets.sh)` / `env is in .env and on the production Worker`                                                                                                                                      |
| learn/SKILL.md:185                    | "Creates PRs (that's analyze's job)"                                        | Main-only; analyze commits to main.                                                         | remove                                                                                                                                                                                                                                                                       |
| profile/SKILL.md:3-4                  | "by role (engineer/business/content/ops)"                                   | The body defines core/developer/security/business/qa/full.                                  | Use those names in the description and when_to_use.                                                                                                                                                                                                                          |
| issue/SKILL.md:30,34                  | "P0-critical…", "enhancement"                                               | github-workflow (newer by blame) uses `P0`–`P3` and `type:feature/bug/chore/docs/refactor`. | Use those labels, and check which labels exist first.                                                                                                                                                                                                                        |
| pwa/SKILL.md:49-51                    | "`emulate` network offline → …"                                             | :207-211 of the same file says DevTools offline emulation misses the worker's own fetches.  | `2. Stop the local server and navigate to an app route — saved pages must render and unsaved ones must show the locale-correct offline page (DevTools offline emulation does not reach the worker's own fetches).`                                                           |
| ship/SKILL.md:4,23 vs deploy/SKILL.md | ship claims prod, and "/deploy = staging/preview"                           | deploy is now "Production deploy operator — Cloudflare".                                    | **flag**. Decide who owns production.                                                                                                                                                                                                                                        |

Medium, OPEN (the replacement text is exactly as given by each slice):

- `costs` :17,24,27: Vercel/API bullets → Cloudflare plan and `/economy`.
- `draft` :67: Telegram caption budget. `draft` :240-244: "now that…/Since 2026-08-06" (migration-relative). `draft` :151-161: collapsed queue steps 2-5; restore line breaks.
- `calendar` :31: "Five brands" vs six at :49.
- `analyze` :174 vs :263: 200-line vs 500-line cap.
- `bench` :56-59,121: hardcoded corpus counts.
- `carousel` :136: "six archetypes" vs eight.
- `clone` :161-173: `mcp__claude_ai_Figma__*` → unprefixed Figma tool names.
- `code` :80-116: gold CRUD template omits tenant scope (G1c example over-indexing) → `where: { id, /* tenant field */ }` with `findFirst`.
- `check` :28-58 and `build` :24-67: fix-a-TS-error tutorial and stage timings (G2 verbose) → keep the commands, the 5-attempt cap and the `.env` note.
- `scrape` :16-19,82-84,99-109,186 and `references/backends.md:81-83`: history and migration-relative text plus hardcoded counts the file itself forbids.
- `record` :16-17, :42-43: provenance and a dated snapshot → remove.
- `shadcn/references/docs-block.md:37`: `npm install @radix-ui/react-slot` → `pnpm add radix-ui`.
- `weekly` :19, `monitor` :14, `incident` :4,14-32 (P0-P2 vs P0-P3, "Create Linear issue" → GitHub issue), :20: Vercel-first health checks → per-platform.
- `profile` :34,317 ("44 agents"), :56-251 (`commands:` keys, `translate`/`dispatch` don't exist).
- `economy` :38-39: "Fable tokenizer…/Fable can't disable thinking" → generation-neutral wording. The pin is partly fixed already; the model name remains.
- `higgs` :10-12 (G1a CAPS "do NOT ask"), :20/:54/:63/:68/:319-328 (dated credit balance), :60-61 and :313-316 (PR #97 and pre-2026-08-06 archaeology).
- `funnel` :10-15, :46-52, :89-107, :167, :199-203: dated counts and Vercel env/cron.
- `handover` :14: "Replaces the old `qa <url>` orchestrator" (G1d) → remove.
- `pwa` :144-145: zsh word-split recency trap → remove. `pwa` :150-154: incident story → keep the rule, drop the story.
- `measure` :36-38: Telegram view count → remove.

Low / flag only: `credentials` vs `auth` both claim "log into X" with different browsers (flag). Also: date stamps in cloudflare/deploy/carousel; `airbnb-copy` data path absent from kun; `bench` guard-9 story; `release` Slack tool name; `social` "four brands"; kingfahad.databayt.org examples in watch/release (dead host); `weekly` token numbers; `textbook` adjudicator story; `wire` inline form/table vs the form/table pattern cards (blame can't order them; flag); `md` crop scaffold (G1d visual-input, re-test on Opus 5.5 first); `pattern` index table; `pwa` "Learned (2026-09-12)" section; `publish` :47; `measure` :57.

## C. Project agents and rules

High, OPEN:

| Location                                      | Evidence                                                             | Action / replacement                                                                                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rules-global/patterns.md:32                   | "the 3 cross-cutting rules at `.claude/rules/*.md` carry no `paths`" | `Cross-cutting engine rules live at .claude/rules/*.md; domain rules are path-scoped.` (only engine-parity.md exists, and it is path-scoped)                                     |
| agents/quality.md:58                          | "`.claude/rules/patterns.md` § Rule Corpus"                          | → `.claude/rules-global/patterns.md`                                                                                                                                             |
| agents/ops.md:31,38; revenue.md:49            | "Max $200/mo"                                                        | `\| **Claude** \| Max $100/mo, subscription-only \| $100 fixed \| No API-key spend — engine.json billing; /usage weekly \|`                                                      |
| agents/revenue.md:39,99-104                   | "mkan … 8% booking commission"                                       | funnel.md (newer) says mkan is free to hosts. Change :39 to `\| **mkan** \| Free to hosts (no price path) \| … \| Inventory, not revenue — see funnel.md \|` and delete :99-104. |
| agents/report.md:270,296                      | "kun \| Vercel \| redeploys itself"                                  | `\| kun \| Cloudflare \| same as hogwarts \|` / `kun.databayt.org (Cloudflare)`                                                                                                  |
| agents/analyze.md:139-149,170,108,168         | `commands/`, `translate`, "44 agents"                                | → `skills/`; drop `translate`; point counts at engine.json                                                                                                                       |
| agents/_index.md:7,68-74,107-108,127,185,204  | "46 (19+27)", pinned versions, "as PR"                               | Counts → engine.json; drop the Version column; PR wording → "committed to main"                                                                                                  |
| agents/guardian.md:95                         | "in PR description"                                                  | "in the commit body"                                                                                                                                                             |
| agents/funnel.md:66-67; lead.md:16,81,114,185 | "45 of 175", "3,156"                                                 | These contradict the same files' own newer numbers. Drop the counts and keep the rule ("never WhatsApp an unverified-mobile number").                                            |
| rules/neon/branch-per-pr.md                   | the whole rule is PR-based                                           | **flag**. This is a safety rule, so the user decides the main-only equivalent (a restore-point branch before DDL).                                                               |

Medium, OPEN:

- `ops` :32,43,84,95 and `guardian` :58,87 and `tech-lead` :87-88: Vercel → Cloudflare, PR review → commits.
- `funnel` :79,152-155: Vercel cron and env.
- `learn` :32,105-109,224: PR/branch metrics under main-only → first-parent commit cadence.
- `captain` :456-458 (Q2 OKR, "this session"), :592 (G1d "Replaces the previous…"), :477 ("Quality > Speed" vs the Drive at :65 in the same file), :319/:359/:540 (`/slack send`, which doesn't exist → Slack MCP).
- `revenue` :29,54: "Not in a rush" contradicts the Drive.
- `product` :24,57,148 and `support` :24: "Abdout (sole engineer)" and "Samia Kun care" contradict captain.md and team data.
- `hogwarts`/`mkan`/`shifa`/`souq` :30: `/Users/abdout/oss/<repo>` → `/Users/abdout/<repo>`. `hogwarts` :180: `prisma/schema.prisma` → `prisma/` (multi-file).
- `authjs/guard-at-boundary.md:5` and `quality.md:158`: `middleware.ts` → add `proxy.ts`.
- `react-perf/_template.md`: path-scoped placeholder auto-loads on every TS edit → move to `.claude/templates/rule.md`.
- `rules-global/patterns.md:36,42`: "38 rules total" and a missing `cloudflare/` and `gsap/` → count from engine.json.
- `pwa.md:91`: `severity: high` → `error` (quality gates only on `error`).
- `react-perf/no-barrel-imports.md:30-32`: lucide-react is optimized by default, so the "Bad" example isn't bad → use lodash.
- `rules-global/cowork-bridge.md:20-22`: "used to read No… Corrected 2026-07-27" → remove (history).
- `_index-content.md:35`: `/translate` → remove.

Low / flag: `prisma-6/no-destructive-migrations-on-main` and `neon/pooled-connection-serverless` vs out-of-band DDL and Prisma 7 `prisma.config.ts` (safety; flag). Also: `cloudflare.md:33` "vinext not an option" vs `vinext-migrate.sh` (flag); stack pins "Prisma 6/TS 5" vs kun `package.json` (prisma ^7.9, typescript ^6); `quality.md:204` refers to rows missing from the user CLAUDE.md; `captain`/`clone` frontmatter `permissionMode: ask` and `memory:` list (unverified); `learn` :162-180 single dated gold example (G1c); `package.md:81` CAPS MUST (G1a, rewrite: `keep them version-aligned (drift breaks shared codebase components)`); `("use client");` artifacts in `use-hook-for-promises.md:26` and `minimize-rsc-boundary-props.md:22,37`; four near-identical product reference agents (G4 roster; candidate: one `reference` agent taking the repo as input).

## D. User-only `~/.claude` files (every edit affects ALL projects)

High, OPEN:

| Location                                                                                         | Evidence                                                                | Action / replacement                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skills/dev/SKILL.md:13                                                                           | `lsof -ti:3000 \| xargs kill -9`                                        | mcp-doctor ERRORS.md E9 says this kills the MCP Chromium. → `lsof -ti:3000 -sTCP:LISTEN \| xargs kill 2>/dev/null; open -a "Google Chrome" http://localhost:3000 && pnpm dev`                                                                            |
| skills/mcp-doctor/SKILL.md:40-41,74; ERRORS.md:215                                               | "`~/.claude/mcp.json` is authoritative"; headless user-data-dir         | Contradicts E8 in the same skill (`~/.claude.json` is what loads; headless runs `--isolated`). Rewrite both to E8.                                                                                                                                       |
| agents/architecture.md:24,26                                                                     | "Deploy on Vercel", "Small PRs"                                         | `Deploy on Cloudflare Workers/Containers with Neon Postgres`; `Small atomic commits on main`                                                                                                                                                             |
| agents/orchestration.md:357,468                                                                  | `delegateTo("github","Create PR with fix")`                             | `delegateTo("git","Commit fix and push to main")`; `github \| Issues, Actions/CI, releases`                                                                                                                                                              |
| agents/github.md:33,653-683                                                                      | "Vercel auto-deploys main"; "Break into smaller PRs"                    | Deploy via the repo's lane; replace the section with "Never force-push main; `git pull --rebase origin main && git push origin main`".                                                                                                                   |
| agents/deploy.md:3,30 vs :91-179,343-351,105,530                                                 | Vercel-first description, PR-preview jobs, `vercel env pull .env.local` | Rewrite the description as the legacy Vercel lane (wrangler repos → cloudflare). Remove the PR-preview/`develop` blocks. Pull into `.env` only (the global rule forbids `.env.local`).                                                                   |
| agents/deploy.md:91-92; build.md:418-427; github.md:482                                          | `NEXTAUTH_SECRET/URL`                                                   | → `AUTH_SECRET` / `AUTH_URL` (Auth.js v5)                                                                                                                                                                                                                |
| agents/middleware.md:12,20-24,37; structure.md:562; authjs.md:83; internationalization.md:73,886 | `src/middleware.ts`, "Edge Runtime"                                     | All repos use `src/proxy.ts` (Next 16), which runs on Node. Rename and state the Node runtime.                                                                                                                                                           |
| agents/nextjs.md:164-167; performance.md:114-115                                                 | `experimental_ppr`, `experimental.dynamicIO`                            | Deprecated in Next 16 types → top-level `cacheComponents: true`                                                                                                                                                                                          |
| agents/structure.md:319; shadcn.md:66,129                                                        | `tailwind.config.ts`, `React.forwardRef`                                | Tailwind v4 has no config file (`"config": ""`); React 19 passes ref as a prop.                                                                                                                                                                          |
| agents/internationalization.md:11                                                                | "Next.js 15"                                                            | → 16                                                                                                                                                                                                                                                     |
| skills/captain/SKILL.md:7,12,43-50,141,149-159; decide:128,134,141; premortem:65-66,137-138      | `dispatch.sh`, Apple Notes, `/risk`, `/principle`, `/1on1`              | None of these exist. cowork-bridge defines bridge.md + GitHub issues + PushNotification. Rewrite as given in slice D; remove the dead skill references.                                                                                                  |
| rules/testing.md:19-26                                                                           | "NO `__tests__/` directories"                                           | This is hogwarts-only content that loads everywhere, and kun has 4 `__tests__` dirs. Rewrite in place: `Applies to hogwarts; other repos follow their existing test layout.` Moving it into the hogwarts repo is a separate decision outside this scope. |
| rules/prisma.md:9                                                                                | "Always include schoolId in queries"                                    | → `Scope every query by the repo's tenant key (schoolId in hogwarts) — never query tenant data unscoped`                                                                                                                                                 |
| skills/repos/SKILL.md:33                                                                         | `/Users/abdout/oss/<repo>`                                              | Doesn't exist → `/Users/abdout/<repo-name>`                                                                                                                                                                                                              |

Medium, OPEN:

- `nextjs.md:310` and `performance.md:156`: `revalidateTag("x")` → `revalidateTag("x","max")`.
- `quick` :4,17-20: the Vercel wording; steps skip lint and pull --rebase, and use `git add -A` against the explicit-pathspec rule.
- `prisma.md:361` and `deploy.md:215`: `prisma migrate reset` is forbidden in kun's vocabulary → use a Neon branch.
- `middleware.md:551-593`: `.vercel.app` and `request.geo`.
- `rules/tailwind.md:28` and `internationalization.md:242-548`: Rubik/Tajawal vs Thmanyah.
- `mcp-doctor:39`: "@playwright/mcp (Anthropic's official)" → Microsoft's.
- Version pins across nextjs/react/typescript/git/github/architecture/performance/test/structure → major line only.
- `block/SKILL.md:43-54`: 100-point rubric (G1b arithmetic) → pass/fail with evidence per dimension.
- `saas` :23-39: `src/actions/` vs the mirror pattern.
- `security` :26-34: 2017 OWASP list, generic → "current edition, weighted to tenant isolation/authz/secrets".

Low / flag: `motion` "Framer Motion" naming; `orchestration` 7-phase choreography (G1c); generic git/gh tutorials in git.md and github.md; icon.md and template.md counts; `model: opus` on mechanical skills; `multi-repo.md:3` `OSS_PATH` doesn't exist.

## E. Plugins and synced skills (report only, no edits)

The swift-lsp, typescript-lsp, security-guidance, github and linear plugins contain no skills, commands or agents. Findings in the synced Anthropic skills:

- `deep-research` :119-123 forces a recited self-reminder phrase (Med).
- `pptx` :85 has a vague "don't create boring slides"; keep its named-defaults list (Med).
- `pptx` :155-163 has a prohibition list (Low).
- `morning` :77,93 has numeric caps (Low; may be UI-bound).
- `skill-creator` :122 uses "ALWAYS" (Low).

---

## Proposed diff (high-confidence, OPEN, in-project hunks)

For every other High/Med row, the exact replacement text above is the hunk. Apply those one finding at a time. Kun-sourced changes reach `~/.claude` via `bash .claude/scripts/setup.sh`.

```diff
--- a/.claude/CLAUDE.md
+++ b/.claude/CLAUDE.md
@@ -3,2 +3,2 @@
 > Project-level overrides for the kun engine. User defaults live in `~/.claude/CLAUDE.md`
-> (Component Hierarchy, Reference Codebase, Imported Rules).
+> (Preferences, Component Hierarchy, Reference Codebase, Keyword Vocabulary).
```

(Apply the same hunk to `AGENTS.md` and `.agents/rules/AGENTS.md`, which are byte mirrors.)

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -32 +32 @@
-Project-level instructions: `.claude/CLAUDE.md` (Tier 1 pipeline, Tier 2 sweeps, Tier 3 vocabulary).
+Project-level instructions: `.claude/CLAUDE.md` (the Drive, preferences, agent lanes, pipeline, vocabulary).
```

```diff
--- a/.claude/templates/user-CLAUDE.md      # → ~/.claude/CLAUDE.md via setup.sh — ALL PROJECTS
+++ b/.claude/templates/user-CLAUDE.md
@@ -44 +44 @@
-(160 spells, browsable at kun.databayt.org/en/docs/keywords), and full playbooks live at
+(count: engine.json → counts.vocabulary_spells; browsable at kun.databayt.org/en/docs/keywords), and full playbooks live at
```

(First bring the template up to the live file: the shadcn-pattern paragraph and `record`. See A6.)

```diff
--- a/.claude/rules-global/github-workflow.md   # ALL PROJECTS after setup.sh
+++ b/.claude/rules-global/github-workflow.md
@@ -87 +87 @@
-Vercel auto-deploys `main` on push. Nothing to do.
+Repos with a `wrangler.jsonc` (hogwarts, mkan, kun) do not deploy on push — run the `deploy` skill. Any other repo follows its own platform's lane.
```

```diff
--- a/.claude/rules-global/patterns.md
+++ b/.claude/rules-global/patterns.md
@@ -32 +32 @@
-… the 3 cross-cutting rules at `.claude/rules/*.md` carry no `paths` and load unconditionally.
+… cross-cutting engine rules live at `.claude/rules/*.md`; domain rules are path-scoped.
```

```diff
--- a/.claude/agents/quality.md
+++ b/.claude/agents/quality.md
@@ -58 +58 @@
-… Full mapping: `.claude/rules/patterns.md` § Rule Corpus.
+… Full mapping: `.claude/rules-global/patterns.md` § Rule Corpus.
```

```diff
--- a/.claude/skills/sync/SKILL.md
+++ b/.claude/skills/sync/SKILL.md
@@ -55 +55 @@
-- **Main-only git** — nothing that reintroduces branches/worktrees/PRs (`.claude/rules/github-workflow.md`)
+- **Main-only git** — nothing that reintroduces branches/worktrees/PRs (`.claude/rules-global/github-workflow.md`)
```

```diff
--- a/.claude/skills/costs/SKILL.md
+++ b/.claude/skills/costs/SKILL.md
@@ -16 +16 @@
-   - Claude Max subscription: $200/mo (fixed)
+   - Claude Max subscription: fixed plan cost — see .claude/CLAUDE.md → Billing (subscription-only, no API spend)
```

```diff
--- a/.claude/agents/ops.md
+++ b/.claude/agents/ops.md
@@ -31 +31 @@
-| **Claude API** | Max $200/mo subscription | $200 fixed | Batch API calls, use caching, Haiku for simple tasks |
+| **Claude** | Max $100/mo, subscription-only | $100 fixed | No API-key spend — see engine.json billing; check /usage weekly |
@@ -38 +38 @@
-**Current burn**: ~$500/month total ($200 Claude + ~$300 services). $5K capital = 10 months runway.
+**Current burn**: Claude $100 fixed + services — read the live figure from engine.json billing / the company profile, never this line.
```

```diff
--- a/.claude/agents/revenue.md
+++ b/.claude/agents/revenue.md
@@ -49 +49 @@
-| Claude Max subscription | $200 | Fixed, Abdout's subscription |
+| Claude Max subscription | $100 | Fixed, subscription-only (engine.json billing) |
```

```diff
--- a/.claude/skills/release/SKILL.md
+++ b/.claude/skills/release/SKILL.md
@@ -220 +219,0 @@
-- Hotfix from a non-main branch — use `/ship` directly
```

```diff
--- a/.claude/skills/learn/SKILL.md
+++ b/.claude/skills/learn/SKILL.md
@@ -185 +184,0 @@
-- Creates PRs (that's analyze's job)
```

```diff
--- a/.claude/skills/publish/SKILL.md
+++ b/.claude/skills/publish/SKILL.md
@@ -36 +36 @@
-`DRAIN_CHANNEL_IDS` — telegram, facebook, instagram.
+`DRAIN_CHANNEL_IDS` — facebook, instagram.
```

```diff
--- a/.claude/agents/guardian.md
+++ b/.claude/agents/guardian.md
@@ -95 +95 @@
-Document all license decisions in PR description
+Document all license decisions in the commit body
```

User-level (**all projects**; these files have no kun source, so edit in place):

```diff
--- ~/.claude/skills/dev/SKILL.md
+++ ~/.claude/skills/dev/SKILL.md
@@ -13 +13 @@
-lsof -ti:3000 | xargs kill -9 2>/dev/null; open -a "Google Chrome" http://localhost:3000 && pnpm dev
+lsof -ti:3000 -sTCP:LISTEN | xargs kill 2>/dev/null; open -a "Google Chrome" http://localhost:3000 && pnpm dev
```

```diff
--- ~/.claude/rules/prisma.md
+++ ~/.claude/rules/prisma.md
@@ -9 +9 @@
-- Always include schoolId in queries (multi-tenant isolation)
+- Scope every query by the repo's tenant key (schoolId in hogwarts) — never query tenant data unscoped
```

## Verify (Step 7)

- **Stale-fact and path hunks:** re-grep after applying, then run `bash .claude/scripts/health.sh`. The engine section must be all ✅ (engine-parity).
- **Routing and behavior hunks** (`ship`/`deploy` ownership, `dev` kill, `testing.md` scope): test each one alone in a fresh session, after setup.sh re-copies the personal skills.
