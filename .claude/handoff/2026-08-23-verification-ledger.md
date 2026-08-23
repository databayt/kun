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

## Step 1 — settle the working tree · **OPEN**
## Step 2 — get CI green · **OPEN**

CI last passed `631c27a` (2026-08-19T12:28). Every push since — all 11 Job Engine commits, all
funnel and social work — landed on a red `main`. Cause: 3 assertions in
`src/lib/jobs/__tests__/job-engine.test.ts` read sibling repos cloned locally; the runner has
none, so counts return 0. 28/31 test files and 245/257 tests pass.

---

## Steps 3–12 — feature areas

| # | Area | Verdict | Evidence | Follow-up |
|---|---|---|---|---|
| 3 | Social publishing | OPEN | — | reconcile vs #145 #146 #147 #149 #150 |
| 4 | Media Studio | OPEN | — | — |
| 5 | Job Engine | OPEN | — | owns the Step 2 CI break |
| 6 | Funnel (Floo Network) | OPEN | — | needs Twenty CRM up (:3100) |
| 7 | Scrape / Owlery | OPEN | — | — |
| 8 | mkan Port Sudan launch | OPEN | — | orphaned commit `46f93b2` — did it ship? |
| 9 | CRM workspaces | OPEN | — | — |
| 10 | Media mastering + carousel | OPEN | — | implementation in mkan |
| 11 | Engine config | OPEN | — | engine.json `google-free` vs CLAUDE.md `claude-fable-5` |
| 12 | Docs site | OPEN | — | — |

### Incidental findings (not yet steps)

- Nothing has published to either Page since **2026-07-31**, although the hourly "Social drain"
  workflow reports `success` on every run. Feeds directly into row 3 and issue #149.
- `.claude/engine.json` declares `"model": "google-free"` while `.claude/CLAUDE.md` declares
  `claude-fable-5`.
- The canary returns **`canAlert: false`** — it probes all four brands correctly but has nowhere
  to send an alarm. It is currently a detector nobody hears, which is the exact failure mode its
  own header comment says it exists to prevent. Row 3.
