# Prompt — wire the scraping lane into the kun engine

> Paste the block below into a **new Claude Code session in `~/kun`**.
> It configures the engine surface only (keywords, skill, agent, hooks, workflow, MCP, docs).
> The scraping _code_ stays in the product repos — see "Where code lives" inside the prompt.

---

Configure the kun engine so scraping and lead work activate passively, the way every other
capability here does. This is an engine-config task: vocabulary, a skill, an agent, hooks, a
workflow, MCP wiring, and docs. **Do not write scrapers in kun** — read "Where code lives" below
before planning anything.

## Read these first — they are load-bearing

- `~/.claude/plans/reference-kun-and-twenty-cosmic-meteor.md` — the approved lead-engine plan,
  including Phase 0/1 status and the measured numbers. Everything below is grounded in it.
- `.claude/memory/project_lead_engine.md`, `.claude/memory/reference_crm.md` (memory index:
  `.claude/memory/MEMORY.md`).
- `.claude/vocabulary.json` (178 spells / 20 schools), `.claude/engine.json`,
  `.claude/rules/engine-parity.md`, `.claude/scripts/generate-vocab.mjs`.
- `/Users/abdout/mkan/scripts/crm/README.md` — the canonical growth pipeline and its runbook.

## What the measured data says — the config must not encourage the wrong work

Do not build config that makes "scrape more" the easy path. It is the low-value path here:

| Lane                    |     Count | Note                                 |
| ----------------------- | --------: | ------------------------------------ |
| Contactable today       |       175 | 5.5% of the CRM                      |
| Has a Facebook page     |        13 | the only real FB-scrape surface      |
| Has a website           |        27 |                                      |
| **Name + map pin only** | **2,941** | **93.2% — no automated lane exists** |

Automated enrichment caps out at **+40**. The existing Sudan scraper adds **+15** (505 of its 817
names were already in the CRM). Meanwhile **130 tier-A/B schools are contactable and unworked**.
Of 175 contacts only **45 are mobile**; **119 carry an email** — for this MENA-wide list email is
the larger channel, WhatsApp is right for the Sudan slice.

So the spells should make _contact-gap analysis, enrichment and outreach_ the obvious move, and
make raw discovery an explicit, deliberate choice.

## Where code lives (do not violate this)

- **kun** — routing only: keywords, skill, agent, hooks, workflow, docs. No scraper code.
- **`hogwarts/scripts/crm/`** — `twenty-rest.ts`, `contact-gap.ts`, `normalize-contacts.ts` (built
  2026-08-17, commit `f82f64309`).
- **`mkan/scripts/crm/`** — 52 files, 37 `pnpm crm:*` commands. **The canonical implementation.**
  `twenty-rest.ts` is vendored into hogwarts; fix bugs in both until it is extracted to a package.
- **`hogwarts/src/lib/whatsapp/`** — the Evolution API sender (retry, rate limiter, templates,
  dispatch). Never build a second sender.
- **`twenty/scripts/sudan-schools-scraper/`** — the CDP Facebook scraper. It sits in an
  upstream-tracked fork with a `divergence-guard` hook; the plan relocates it to
  `hogwarts/scripts/crm/`. Its `import-to-twenty.js` writes raw SQL into every workspace with no
  dedup key — it must not be resurrected.

**Twenty access:** REST at `http://localhost:3100` (NOT 3000 — that is hogwarts' dev server).
Token: `security find-generic-password -s databayt-twenty -a <hogwarts|mkan|sijillee|moallimee> -w`.

## Deliverables

### 1. Keywords — a new vocabulary school

Add a school to `.claude/vocabulary.json` for lead acquisition. Match the house style: a
Harry-Potter-flavoured name, `id`, `number`, `name`, `subtitle`, `description`, `quote`, and a
`spells[]` array where every spell carries `name`, `effect`, and an `order[]` routing chain of
`familiar` (agent) / `portal` (MCP) / `skill` / `hook` / `ward` (rule) / `memory`.

Abdout types **`scrap`**, not "scrape". Both spellings must trigger, in the skill's `when_to_use`
and anywhere triggers are matched. Cover at minimum:

- `scrap` / `scrape` — the umbrella; routes by argument
- `scrap facebook` — the FB page/About lane
- `scrap whatsapp` — see the honesty note below
- `scrap facebook for hogwarts`, `scrap for mkan` — product-scoped forms
- `leads`, `prospect`, `contact gap`, `enrich`, `outreach`, `pipeline health`
- Arabic equivalents, since half the work is Arabic: `اسحب`, `جمع بيانات`, `عملاء محتملين`

**Be honest in the `effect` strings.** "scrap whatsapp" is not a thing — WhatsApp has no scrapeable
surface. What is real is _harvesting WhatsApp numbers from public web and Facebook pages_, and
_sending_ through the Evolution API. Word the spell so it routes to that, and say so rather than
implying a capability that does not exist.

Then: `node .claude/scripts/generate-vocab.mjs`, and bump `engine.json` counts **in the same
commit** — `.claude/rules/engine-parity.md` requires it and `health.sh --check` enforces it.

### 2. Skill — `.claude/skills/scrape/SKILL.md`

Frontmatter `when_to_use` carrying every trigger above (this is what makes activation passive —
Abdout never types slash commands). Body: the runbook, argument-polymorphic like `/handover`:

- no argument → run `contact-gap.ts`, report the split, recommend the highest-yield next move
- `facebook` → the FB About lane, and the dedicated-account + throttle warning
- `<product>` → resolve scope from `.claude/memory/repositories.json`
- always → dry-run first, `--apply` second; never write to Twenty by SQL

### 3. Agent — `.claude/agents/lead.md`

Owns contact-gap analysis, enrichment, tiering, and outreach drafting. Give it the numbers above so
it does not re-derive them, and the rule that Twenty is reached only through REST/metadata.

### 4. Hooks

- A **pre-run guard** that refuses a scrape when the Facebook session belongs to Abdout's personal
  account, and warns when a run has no throttle. The scraper drives a logged-in Chrome via CDP;
  that account administers the business portfolio. Page tokens are safe either way since publishing
  moved to a System User (2026-08-19); the dedicated account holds zero roles so losing it costs nothing.
- A **post-run** hook that appends the contact-gap delta to the run log so yield is always measured,
  not assumed.

### 5. Workflow — `.claude/workflows/`

`discover → enrich → tier → gap-report`, dry-run by default, per the two existing executable
workflows (`qa`, `handover`). Include a **no-silent-caps** step: if a stage truncates (top-N,
sampling, rate-limit stop), it must log what was dropped.

### 6. MCP

Check `.claude/mcp.json` and `~/.claude.json` for what a scrape lane needs — `browser` /
`browser-headed` for CDP, `postgres`/`neon` for reads. **There is no Twenty MCP configured**;
decide whether to add Twenty's built-in MCP server (it exists in-tree at
`twenty/packages/twenty-server/src/engine/api/mcp/`) or keep REST-only, and say which and why.

### 7. Docs

A `content/docs/` page for the scrape lane, wired into `docsNav` (a page missing from the sidebar
has happened before), and regenerate the keyword page so the new school shows at
`kun.databayt.org/en/docs/keywords`.

## Constraints

- Work directly on `main`. Conventional commits. No branches, worktrees, or PRs.
- Fleet changes land whole: vocabulary + `generate-vocab` output + `engine.json` in one commit.
- Subscription-only: no `ANTHROPIC_API_KEY` (it is dead in prod, 401). LLM work goes through the
  local `claude -p` drain on the Max pool; Gemini free tier (~20 req/day/model) for bulk
  classification. Scrapers cost zero tokens — keep it that way.
- Ask before adding a dependency or a paid service.

## Done means

`/health` is green (counts match, vocabulary in sync), saying **"scrap facebook for hogwarts"** in
plain prose activates the right skill + agent with product scope resolved, and `/bench` shows no
routing collision with existing spells.
