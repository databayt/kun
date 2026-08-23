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
| 4 | Media Studio | OPEN | — | — |
| 5 | Job Engine | PARTIAL | CI break fixed + 257 tests green offline; **the engine itself is still untested behaviorally** | build/verify `/jobs` renders real extraction |
| 6 | Funnel (Floo Network) | OPEN | — | needs Twenty CRM up (:3100) |
| 7 | Scrape / Owlery | OPEN | — | — |
| 8 | mkan Port Sudan launch | OPEN | — | orphaned commit `46f93b2` — did it ship? |
| 9 | CRM workspaces | OPEN | — | — |
| 10 | Media mastering + carousel | OPEN | — | implementation in mkan |
| 11 | Engine config | OPEN | — | engine.json `google-free` vs CLAUDE.md `claude-fable-5` |
| 12 | Docs site | OPEN | — | — |

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

### Incidental findings (not yet steps)

- Nothing has published to either Page since **2026-07-31**, although the hourly "Social drain"
  workflow reports `success` on every run. Feeds directly into row 3 and issue #149.
- `.claude/engine.json` declares `"model": "google-free"` while `.claude/CLAUDE.md` declares
  `claude-fable-5`.
- The canary returns **`canAlert: false`** — it probes all four brands correctly but has nowhere
  to send an alarm. It is currently a detector nobody hears, which is the exact failure mode its
  own header comment says it exists to prevent. Row 3.
