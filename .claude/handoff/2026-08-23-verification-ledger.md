# Verification Ledger — drawing the line under 2026-08-14 → 08-23

**Why this exists.** 114 commits landed on `main` in nine days across ten feature areas, with
self-correction as the dominant pattern — a large share of commits exist to retract an earlier
claim. Docs closeouts saying LIVE / ACTIVE / wired are **claims to test, not evidence**. This
ledger carries one behavioral verdict per area. We move to the next area only after a verdict is
recorded here.

Plan: `~/.claude/plans/through-the-past-days-quiet-muffin.md`

Verdicts: **PASS** (claim held under a behavioral test) · **PARTIAL** (some of it held) ·
**FAIL** (claim did not hold) · **OPEN** (not yet tested).

Public repo — verdicts and evidence pointers only. Never a token, never client-sensitive detail.

---

## Step 0 — P0: leaked Facebook Page tokens · **RESOLVED 2026-08-23**

`pt.json` at repo root held two **live, non-expiring** Graph API Page tokens, public in this
repository since commit `67845f0` (2026-08-19). `databayt/kun` is a public repo.

**Measured, not assumed:**

| Fact | Finding |
|---|---|
| Tokens live? | Yes — both authenticated against Graph on 2026-08-23 |
| Pages | Hogwarts `1228948003637000`, Mkan `1133424016531929` |
| App | Gabriel `874547138717755` |
| Expiry | `expires_at: 0` — **never expire** |
| Scopes | `pages_manage_posts`, `pages_read_engagement`, `pages_read_user_content`, `pages_show_list`, `read_insights`, `public_profile` |
| Messaging scope? | **No** — audit scope is posts only, not DMs |
| Exposure window | 2026-08-19 → 2026-08-23 (4 days) |
| **Unauthorized posts?** | **None.** Last post on either Page predates the leak (Hogwarts 2026-07-31, Mkan 2026-07-27) |

**Why individual revocation is impossible.** The leaked tokens and the production tokens are
siblings: same app, same grant (System User, app-scoped id `1220973992...`), issued **62 seconds
apart** on 2026-08-19. Page tokens cannot be revoked individually — only the grant can be. So
killing the leak necessarily invalidates the working tokens too.

**Blast radius of the revoke** — measured by debugging every configured token:

| Brand | Page | Grant | Killed by the revoke? |
|---|---|---|---|
| hogwarts | `1228948003637000` | System User (2026-08-19) | **Yes — re-mint** |
| mkan | `1133424016531929` | System User (2026-08-19) | **Yes — re-mint** |
| balqalam | `1218016808068580` | System User (2026-08-19) | **Yes — re-mint** |
| databayt | `814371365085465` | personal (2026-07-23) | No — unset in prod anyway |
| legacy bare var | `1228948003637000` | personal (2026-07-23) | No |

**Trap for future sessions — the local Vercel link points at a dead project.**
`.vercel/project.json` links `prj_Fj6KQpX1m4DKwzAQ9bV8VqlnKmDG` on team
`osman-abdouts-projects`, which is **soft-blocked on an unpaid invoice and serves HTTP 402**.
Production is actually `prj_rywieXexNWaY0H6KqPlYsQzVNi7G` on the free `databayt` team
(`team_BrPSqGS4wSpLors2B9jYAAFs`), which the logged-in CLI cannot see at all. So
`vercel env ls/pull` locally reads the **wrong, dead project**, and `vercel env add` fails with
an overdue-balance error. Env writes have to go through the `databayt` account. An earlier read
in this very session was misled by exactly this before it was caught.

**Resolution — every line verified, not assumed**

- [x] GitHub secret scanning + push protection **enabled** (both were off)
- [x] Blast radius recorded via `debug_token`; exposure-window audit **clean** (zero posts)
- [x] Confirmed no runtime code reads the files — removal could not break publishing
- [x] **Gabriel System User grant revoked** — leaked pair confirmed dead, and the working
      hogwarts/mkan/balqalam tokens died with them (expected: siblings of the same grant)
- [x] Fresh System User token generated — `type: SYSTEM_USER`, `expires_at: 0`, the five
      required scopes and nothing more. Expiry set to **Never** per the skill's doctrine
      (*"a token that expires is a scheduled outage"*); the leak vector was a committed file,
      now closed by push protection, not the expiry
- [x] Page tokens re-minted for all three brands — each gated on `type=PAGE` + `expires_at=0`
      + four page scopes before anything was written
- [x] `.env` and **the live Vercel project** updated; production redeployed (`dffe69e`, READY)
- [x] **Post-then-delete round trip on the Hogwarts Page: published → read back → deleted →
      confirmed gone.** The skill's rule is that a token which health-checks can still fail to
      publish, so this is the verdict that counts
- [x] Production canary: **4/4 brands healthy**, correct Page names, `expiresAt: 0`
- [x] Seven artifacts removed, `.gitignore` refuses the shape, **zero `EAA` tokens remain in HEAD**

Secrets were kept out of the session transcript throughout: the new tokens moved from the Meta
console to Vercel inside the browser via the clipboard and the Graph API, never through a tool
argument.

**Other debris found at repo root** (all committed 2026-08-19 during the System User work):
`usertoken.txt` (dead token), `consent1.yml` (Meta console a11y snapshot + dead token),
`assign.yml`, `dbpage.yml` (snapshots, no tokens), `meta-login.png`, `dbpage.png`
(console screenshots — review for visible secrets before removal).

**No history rewrite.** The main-only rule forbids force-pushing `main`; once rotated the history
copies are inert.

---

## Step 1 — settle the working tree · **DONE 2026-08-23**

Every uncommitted and untracked path gets an explicit verdict — commit, ignore, or delete.
**Never `git add -A` here:** nothing below is gitignored, so a blanket add would sweep in
personal data and a stale hook mirror.

| Path | What it is | Verdict |
|---|---|---|
| 10 hook files (`.claude/hooks/`, `plugins/kun-company/hooks/`) | second command-extraction path for another agent runtime | finished — commit as one |
| `src/lib/media-prompt.ts`, `social/dictionary.ts` | `plannedPillars()` + 16 EN/AR keys, **zero consumers** — the panel was never written | park as groundwork, open an issue |
| `social/rotation.ts`, `calendar-panel.tsx` | `SEED_COUNT` hoisted to a shared export | commit (drop the stray double blank line) |
| `next-env.d.ts` | Next.js regenerated it | commit, never hand-edit |
| `AGENTS.md`, `GEMINI.md` | symlinks to existing tracked config | commit |
| `.codex/` | Codex CLI config, 22 agent .toml, hooks in sync | commit |
| `.agents/` | cross-runtime bridge, but `.agents/.claude/hooks/` is a **stale mirror** with 44-byte `exit 0` stubs | resync or drop that subdir first |
| `databayt-portfolio-pages.png`, `heirs-1180.jpeg` | loose at repo root, no references | move to the media library or delete |
| **`jobs/`** | **appeared after the inventory — Job Engine working data plus `jobs/cv/` holding two real CVs (PDF + HTML)** | **gitignored** (Abdout's call) — stays local, can never be swept into a commit |

**Outcome: working tree clean**, in four commits — `afa2f89` hooks, `aec2549` parked compiler
+ rotation fix, `dffe69e`/config bridge. Two extras the plan did not anticipate:

- A **real latent bug fixed, not filed**: `weeklyPickIndexes` used `(week*count+i) % length`, and
  JS `%` keeps the dividend's sign, so any week ≤ 0 indexed backwards off the array and returned
  `undefined`. Unreachable via today's callers, reachable the moment `plannedPillars` is called
  with `weekOffset = -1` in early January. Positive modulo; identical for positive weeks; 23 tests
  green. One line, zero risk, so fixing beat filing.
- The unbuilt panel is tracked as **#151**.
- The two loose root images were **moved** to `~/media/inbox/2026-08-23/`, not deleted.

## Step 2 — get CI green · **DONE 2026-08-23** — the line

CI last passed `631c27a` (2026-08-19T12:28). Every push since — all eleven Job Engine commits,
all funnel and social work — landed on a red `main` and nobody noticed. **Now green at `dd545a6`.**

**The diagnosis in the plan was half wrong, and the wrong half mattered.** It read as a local-clone
dependency. The clones were the *second* path. The first was `fetchDatabaytOrgRepos()`, which
shells out to `gh repo list databayt` — unauthenticated on the runner — and then falls back to a
memory file whose path was written as a literal `/Users/abdout/kun/...`. That directory exists on
exactly one machine, so everywhere else the fallback found nothing and returned `[]`. Zero repos,
three assertions failing with *"expected 0 to be >= 10"*.

The memory file itself is **tracked in this repo**. Only the path was wrong. Resolving it against
`process.cwd()` makes the fallback work anywhere, offline and unauthenticated. Local clone
discovery had the same shape and is now rooted at `os.homedir()` with a `DATABAYT_REPOS_DIR`
override — clones are optional Level 3 enrichment, since every repo already carries its canonical
GitHub source.

Both paths lived inside `c08fd6b`, whose subject is *"decouple filesystem paths"*. It missed these
two. A good reminder for the rows below: the commit subject is the claim, not the evidence.

**Verified the way the failure demanded** — stubbed `gh` that always exits 1, `DATABAYT_REPOS_DIR`
pointing at a directory that does not exist, no `GITHUB_TOKEN`: **31 files, 257 tests, 0 failures**
(CI previously: 3 failed, 245 passed, 9 skipped). Assertions were not weakened —
`toBeGreaterThanOrEqual(10)` still stands. `tsc` clean, production build clean, and the CI run on
the pushed commit confirmed **success** rather than assumed.

Also worth a ledger line: `.claude/engine.json` says `"model": "google-free"` while
`.claude/CLAUDE.md` says `claude-fable-5`. Row 11.

---

## Steps 3–12 — feature areas

| # | Area | Verdict | Evidence | Follow-up |
|---|---|---|---|---|
| 3 | Social publishing | **PARTIAL — stalled at the human gate, not broken** | see below | #145 restated; #149 stale; new: no review destination |
| 4 | Media Studio | **PARTIAL** | see below | inert model selector; 2 dead media URLs; seat lane never delivered |
| 5 | Job Engine | **PARTIAL** | see below | Layers B+C hardcoded; 0 rows persisted; **schema drift — no migration** |
| 6 | Funnel (Floo Network) | **PARTIAL** | see below | structurally real, operationally empty; "capturing" not demonstrated |
| 7 | Scrape / Owlery | **PASS** | see below | first area to hold; one readability caveat |
| 8 | mkan Port Sudan launch | **PARTIAL** | see below | the site shipped; the campaign never ran |
| 9 | CRM workspaces | **FAIL** | see below | every published URL is dead; reachable only from the Mac |
| 10 | Media mastering + carousel | **PASS** | see below | docs match the runbook; artifacts exist and are served |
| 11 | Engine config | **PARTIAL** | see below | agent counts drifted; model declared wrong twice over |
| 12 | Docs site | **PASS** | `/api/og` 200 image/png 28KB · `/en/docs` 200 | — |

### Step 3 — social publishing · verdict **PARTIAL**, 2026-08-23

**The lane is not broken. It is unattended, and nothing tells anyone.**

| Question | Measured answer |
|---|---|
| Does delivery work? | **Yes** — real post → read back → delete on the Hogwarts Page (Step 0), prod canary 4/4 |
| Has anything published since 2026-07-31? | **No.** DB holds exactly 3 published variants (07-21, 07-23, 07-31), matching the Page history exactly |
| Why not? | **3 variants sit `pending`**, created 07-30 and 08-01 — 23 days at the human approval gate. `scheduled` = 0, `failed` = 0, `draft` = 0 |
| Then why does the hourly drain report `success`? | Because it truthfully drains an **empty** queue. Nothing ever reached `scheduled`. Green means "nothing to do", not "the lane works" |
| Why did nobody notice? | **Production has no review destination at all** — no `HERMES_API_URL`, no `TELEGRAM_BOT_TOKEN` + `TELEGRAM_REVIEW_CHAT_ID`. `sendReview()` therefore always returns "No review destination configured" |
| Is the drafting half dead (#149)? | **No — that claim is stale.** 16 answered draft requests, the most recent 2026-08-22 |
| Is the prod auth gate live? | **Yes** — `/social/publish` redirects to `/login`. It was once commented out; it is not now |

**The causal chain, end to end:** a draft lands `pending` → `sendReview` has nowhere to send →
nobody is told → it sits → nothing reaches `scheduled` → the drain succeeds on an empty queue →
every dashboard is green while the lane produces nothing. Twenty-three days of that.

The canary's `canAlert: false` is the *same* missing config, which is why it reads as a separate
bug and is not one: one fix closes both.

**Highest-leverage fix: configure one review destination.** That converts silence into a message
and unblocks the gate. Everything downstream of it already works.

`/api/social/queue` returning `count: 0` is **correct, not a symptom** — it is the Hermes *pull*
queue (`scheduled`/`approved` on Hermes channels), not the review queue.

**Unresolved sub-check, stated honestly:** could not log into the contributor UI locally to eyeball
`/social/publish` rendering the three pending variants. The generated hash verified `true` against
`verifyPassword` standalone, and `abdout` resolves in the contributor list, but Auth.js kept
returning `CredentialsSignin` against a freshly restarted dev server. `.env` was swapped and
**restored, verified byte-identical**. This is a gap in the verification harness, not a known
product defect — the queue's *state* is confirmed from the database either way.

### Interlude — the Step 3 root cause, fixed (2026-08-23)

Abdout's call mid-pass: **Slack instead of Telegram, and Telegram gone for good.**
Recorded as `D-20260823-drop-telegram-slack-review-lane`.

| | |
|---|---|
| `d30efca` | `lib/slack.ts` — direct incoming webhook. `sendReview` prefers it; `canAlert` now asks `canSendReview()` instead of re-deriving from env, because the two had already drifted. 8 new tests, degrades safely with no credentials |
| `c186fb8` | Telegram removed — transport, registry entry, drain lane, craft rule, platform specs, carousel slot, env, two routing tests. Distribution channels 8 → 7 |
| `aa15e27` | The decision entry |

**Why removing Telegram was free:** no variant has *ever* gone through it — every
row in `SocialVariant`, published or pending, is `facebook` — and production
carried no `TELEGRAM_*` env at all. A transport maintained, tested and documented
for a channel that never carried a post.

**What it costs, said out loud:** the carousel lane's client-DM delivery *was*
Telegram albums, and the `hogwarts-intro` deck is staged. That deck now has no
transport. Follow-up work, not part of the decision.

**What it exposed:** Slack was declared a *communication* channel while parked on
the `hermes` transport — which is how it passed the "every channel has exactly one
publish lane" test. It was technically publishable. The partition now covers
distribution channels only, and a test asserts communication channels have none.

**Still open:** `SLACK_WEBHOOK_URL` is not set, so the review lane still reaches
nobody. The code is landed and inert until it is. Creating the webhook needs a
Slack workspace sign-in the browser does not hold.

### Step 4 — Media Studio · verdict **PARTIAL**, 2026-08-24

The area with the worst history in this repo — a handover once claimed live Nano Banana / GPT
Image renders that were a keyword→static-JPG lookup. **Those 2026-08-19 corrections held.** What
is left is a different problem: every individual statement is honest, and the surface as a whole
still misleads.

**What holds, verified:**

| Claim | Result |
|---|---|
| Studio does not secretly generate | **True, and it says so** — no API call anywhere in `studio-image.ts`; the badge names real provenance (`Library asset · <file>`, `Deterministic HTML Canvas Engine`, `Prompt only — no video renderer is wired`) |
| No paid renderer reachable from the server | **True** — no OpenAI egress remains, pinned by `studio-action-guard.test.ts` |
| The action is gated | **True** — `requireContributor()` runs before any work, pinned statically, and the same test catches *any* new unguarded export in `post-social.ts` |
| Attach is blocked for placeholders | **True** — `attachable:false` + a note saying what to do instead |
| S3 configured in production | **True** — wrote a probe object, read it back publicly over HTTPS (200), deleted it. Facebook could fetch it |

**What does not hold:**

1. **The model selector is inert.** Six models across image/video. Calling the core with `gemini`,
   `nano_banana_pro` and `gpt_image` returns **byte-identical** output — same image, same prompt.
   Its only real effect is labelling the compiled prompt with its intended downstream renderer,
   which is defensible; sitting above a submit button in a generate flow, unlabelled as such, is
   not. This is the exact shape of the false claim that was corrected on 08-19, surviving in the UI.

2. **The two posts awaiting approval carry dead media URLs.** Both point at
   `hogwarts-databayt.s3.amazonaws.com/media/hogwarts/…`, and both objects **do not exist** —
   authenticated `HeadObject` returns **404**; the public 403 is S3 masking a missing key. They
   date from 2026-08-01, before the 08-19 storage fix, and are artifacts of the era when
   `putMedia()` failed silently while the URL was still written to the row. **Approving them today
   would hand Facebook a URL it cannot fetch.** Decide before approving: clear `mediaUrls` and post
   text-only, or re-render the media.

3. **The seat lane has never delivered an asset.** `SocialMediaBrief`: 4 rows, all `pending`, all
   with no asset, oldest 2026-08-05. The same unattended-queue pattern as the approval gate — work
   parked for a human that nobody is told about.

4. **`cdn.databayt.org` still 403s** (issue #148). Direct S3 URLs work, so this is not blocking
   delivery today, and the issue's P3-low is fair — but the CDN is not usable.

### Step 5 — Job Engine · verdict **PARTIAL**, 2026-08-24

Eleven commits in a single day, three "phases". The bottom layer is real work; the labels above it
promise more than the code does.

**What holds:**

| Claim | Result |
|---|---|
| Evidence extraction is real | **True, and good.** 30 repositories resolved, 21 with local clones, **84 facts** across 6 artifact types — drawn from actual `package.json` dependencies, Prisma schemas, API routes and components. Not fixtures |
| The pages render in production | **True** — `/en/jobs` and `/en/jobs/profile` both 200, with real extracted content on the page |
| CI is green | **True** — fixed in Step 2 |

**What does not hold:**

1. **"Synthesizes the 3-Layer Knowledge Profile (Facts → Capabilities → Market Positioning)"
   overstates it by two layers.** Layer A is genuinely derived. **Layers B and C are hardcoded
   literals** in `evidence-extractor.ts`: 8 authored capabilities with hand-written `reasoning`
   and `level`, and 8 positioning roles with hand-assigned `readinessScore` values (94, …). Only
   the *evidence attached* to them is computed. This is a hand-written CV with automated evidence
   stapling — genuinely useful, and not synthesis. Consequently
   `expect(capabilities.length).toBeGreaterThanOrEqual(4)` and the roles assertion pass trivially
   against literal arrays; the meaningful assertion in that test is `supportingFactIds.length > 0`.

2. **"Observability telemetry" is a stats getter** — no persistence, no emission, no time series.
   Two of its metrics are structurally incapable of varying:
   - `evidenceFreshness` can only ever return `"fresh"`. `profile.updatedAt` is stamped when the
     profile is built, **1 ms** before the comparison, so the `aging` (>24h) and `stale` (>7d)
     branches are unreachable.
   - `repositoriesAnalyzed` always equals `repositoriesDiscovered`, because every repo's GitHub
     source is hardcoded `isAvailable: true`.

3. **Nothing has been persisted.** `JobOpportunity` and `JobAssessment`: **0 rows each.**

4. **Schema drift — a real deployment landmine.** `dfd7b84` added 97 lines of Job models to
   `prisma/schema.prisma` with **no migration file**, and **zero migrations have been added since
   2026-08-06**. The tables exist in the shared Neon database only because someone ran
   `prisma db push`. `pnpm db:deploy` (`prisma migrate deploy`) against a fresh environment would
   **not** create them, and the app would fail at first query. Filed separately.

### Step 6 — Funnel (Floo Network) · verdict **PARTIAL**, 2026-08-24

Verified against the **live Twenty CRM** (containers healthy on `:3100`, authenticated over the
GraphQL API). The structure is real and the card is unusually honest; what it calls *capturing* is
the part the data does not support.

**Verified TRUE — these claims hold exactly:**

| Claim | Evidence |
|---|---|
| 12 stage options live | `CompanyStageEnum` = COLD, PROSPECT, SHORTLISTED, CONTACTED, WARM, DISCOVERY, DEMO, TRIAL, PILOT, PAID, DORMANT, LOST — **exact names, exact order** |
| The outreach workflow is ACTIVE | "School shortlisted → outreach" — one ACTIVE version, one ARCHIVED |
| The lead book is loaded | **3,894 companies** |
| "Conversions: 0" | Accurate — PAID = 0 |

**Verified NOT FLOWING:**

1. **Ten of the twelve stages are empty.** COLD 3,795 · PROSPECT 21 · PILOT 1 · LOST 77 — and
   nothing anywhere else.

2. **SHORTLISTED = 0 and CONTACTED = 0.** Those two stages were appended on 2026-08-19
   *specifically for the outreach roll*, and the card says they are "the outreach report's
   numbers". The roll has produced **no record in either**.

3. **The ACTIVE workflow has fired three times, ever** — all on 2026-08-22 (two COMPLETED, one
   FAILED with no `startedAt`). Two of those are the throwaway tests the card itself describes. It
   triggers on *shortlisted*, and nothing has been shortlisted since, so it has had **zero real
   firings**.

4. **The chatbot has captured nothing.** All 21 PROSPECT records were created **2026-07-23** — a
   bulk import of named MENA schools (George Washington Academy, Doha College, King's Academy, …),
   a **month before** chatbot capture went live on 2026-08-22. Not one prospect has entered
   through the widget.

So of *"instrumented, ACTIVE, capturing"*: **instrumented ✓, ACTIVE ✓, capturing ✗** — built and
deployed, never exercised by a real person.

### Step 7 — Scrape / Owlery · verdict **PASS**, 2026-08-24

The first area in this pass whose claims hold end to end.

| Claim | Evidence |
|---|---|
| The hooks work | `funnel-guard.test.sh` **19/19**, `scrape-guard.test.sh` **17/17** |
| The guard is actually live | It **blocked a command in this very session** — a probe of mine containing a fenced `scripts/crm/` path was refused mid-run. Not a claim: an interception |
| "Requires an execution verb" | Holds. `grep -rn …` and `git status` allowed; a fenced-path execution blocked (exit 2) |
| Both readers installed | **Scrapling 0.4.14** and **Agent Reach v1.5.0** |
| Agent Reach is the real package | **Yes** — "Give your AI Agent eyes to see the entire internet", not the PyPI name collision that memory warns about |
| Scrapling actually works | Not just a version string: a real fetch of `example.com` returned **HTTP 200** and wrote 196 bytes of markdown |
| "`doctor` is config-not-liveness" | **Confirmed by the tool's own output**, which says it deliberately does not run `gh auth status` because that would write a device-id, "therefore not verified live" |
| kun holds routing only | Consistent — no scraper logic in this repo |

**Also verified here:** the `.toolCall.args.CommandLine` fallback added in Step 1 (`afa2f89`) works —
both payload shapes produce identical decisions on identical input, allow and block alike.

**Caveat:** `agent-reach doctor --json` returns its diagnostics **in Chinese**. Nothing is broken,
but anyone reading that output will lose time to it.

**Why this one holds when the others did not, and it is worth naming:** this is the area whose
commits most often said *"correct the measured numbers"* — the census churned 3,156 → 714 → 728 →
724 → 287 → 262 across six commits, each correcting the last. That looked like thrash in the git
log. It was the opposite: the discipline of re-measuring instead of restating is exactly why its
claims survive checking.

### Step 8 — mkan Port Sudan launch · verdict **PARTIAL**, 2026-08-24

The orphaned commit. The question was simply *did any of this ship?* — and the answer splits
cleanly in two.

**The product shipped.** `www.mkan.sd` is live, serving Arabic, and the page contains
**بورتسودان** along with apartment and property listings. The Port Sudan launch happened.

**The preparation shipped, and it is thorough.** `46f93b2` delivered exactly what its subject
claimed: the mkan brand kit entry, **4 content pillars**, media references, the `airbnb-copy`
skill (registered and loadable), `scripts/video-media.mjs`, and a **4,109-line** corpus of real
Sudanese Airbnb listings to write against. mkan's Facebook Page is connected and the canary
reports it healthy.

**The campaign never ran.** Measured in the database:

| | |
|---|---|
| `SocialPiece` by brand | **hogwarts 5. That is the entire table.** |
| Media briefs by brand | hogwarts 2 · balqalam 1 · databayt 1 — **mkan 0** |
| mkan variants, drafts, posts | **zero, of every kind** |

So mkan has a live site with Port Sudan listings, a connected and healthy Facebook Page, a
complete brand kit, four content pillars, a bespoke copywriting skill and a 4,109-line reference
corpus — and **has never posted once**.

The commit is not a lie: it says *align … for Port Sudan launch*, and the alignment is real and
complete. It reads as orphaned because the thing it was preparing for never used it.

**Noted in passing:** `content/social/pillars.json`'s own `$comment` records the same pattern
happening one level down — a `pillar` field that was "written and read by nobody". The repo has
already caught itself doing this once.

### Step 9 — CRM workspaces · verdict **FAIL**, 2026-08-24

**Every published CRM URL is dead. The CRM is reachable only from Abdout's laptop.**

| Host | Result |
|---|---|
| 4 × `*.crm.databayt.org` | **402** — still attached to the soft-blocked Vercel account |
| `sales.databayt.org` (the 5th workspace, added 08-20) | **404** |
| `app.databayt.org` + 4 × `<product>.databayt.org` (the hosts the docs call canonical) | **404** |
| `localhost:3100` | **200** |

**Root cause:** DNS is fine — every hostname resolves to Vercel's IPs, the same ones that serve
`kun.databayt.org`. The failure is `x-vercel-error: DEPLOYMENT_NOT_FOUND`. The zone move to the
free `databayt` account on 2026-08-23 brought the **records** and left the **project** behind, so
the domains point at Vercel and no project claims them.

The public docs page lists all of these as working links and says "one login that works on all
workspaces — sign in once on any link". There is currently no link that works. The team cannot
reach the CRM, and the funnel of Step 6 runs against `localhost` only.

### Step 10 — Media mastering + carousel · verdict **PASS**, 2026-08-24

kun's `master.mdx` and mkan's `docs/image-mastering.md` **agree exactly** — "loop PROVEN
end-to-end (2026-08-22)", photo 2 of listing #1051, 147 listings / 112 to queue / **779** low
photos, ~$30 on `legacy`, next up #1127 and #1161, blocked on the same two human actions (Slack
scopes, the deferred billing `/decide`). A doc that names another repo as its source of truth and
then matches it.

And the artifacts are real, not just described: **two mastered WebPs** in `databayt-cdn` at
`mkan/uploads/mastered/` — 109 KB dated 2026-08-22 and 181 KB dated 2026-08-23, exactly when
claimed. Both are **publicly served (200)** through `cdn.databayt.org`, and one of them appears on
the live `www.mkan.sd` homepage.

### Step 11 — Engine config · verdict **PARTIAL**, 2026-08-24

- `project_agents` declared **22**, actual **26**. `user_agents` declared **49**, actual **53**.
  (Skill counts are correct: 54 and 72.)
- `.claude/engine.json` declares `"model": "google-free"` / "Google Free (Gemini 2.5 Pro)" while
  `.claude/CLAUDE.md` declares `claude-fable-5` — and the session that ran this audit was Opus 5.
  The file called "single source of truth for engine metadata" is wrong twice over.

### Step 12 — Docs site · verdict **PASS**, 2026-08-24

`/api/og?title=…` returns **200, `image/png`, 28 KB** — the generated share image works.
`/en/docs` returns **200**. Dormant since 08-14 and fine.

### Correction — the CDN diagnosis in Step 4 (and in issue #148) was wrong

Step 4 recorded "cdn.databayt.org still 403s", and I said as much on #148. **That was a bad test:**
the key I probed did not exist in any bucket, so the 403 was S3 masking a 404.

A discriminating probe — one object written to **only** `hogwarts-databayt`, another to **only**
`databayt-cdn`, both requested through the CDN:

| Object lives in | `cdn.databayt.org` returns |
|---|---|
| `hogwarts-databayt` only | **403** |
| `databayt-cdn` only | **200** |

**The CDN works.** Its origin is `databayt-cdn`, and it serves that bucket correctly — which is why
the mastered mkan photos above are publicly reachable. What 403s is the *social pipeline's* bucket,
`hogwarts-databayt`, because it is **not the CDN's origin at all**. Issue #148's premise —
"CloudFront cannot read the bucket" — is wrong, and so is the `reference_aws_cdn` memory that names
`hogwarts-databayt` as the alias's bucket.

### Incidental findings (not yet steps)

- Nothing has published to either Page since **2026-07-31**, although the hourly "Social drain"
  workflow reports `success` on every run. Feeds directly into row 3 and issue #149.
- `.claude/engine.json` declares `"model": "google-free"` while `.claude/CLAUDE.md` declares
  `claude-fable-5`.
- The canary returns **`canAlert: false`** — it probes all four brands correctly but has nowhere
  to send an alarm. It is currently a detector nobody hears, which is the exact failure mode its
  own header comment says it exists to prevent. Row 3.
