# Org issue queue — one prioritized list

Generated 2026-11-24 09:38 UTC by a headless, read-only Claude run (Slack, via Hermes). No issue was edited, labelled, commented or closed. Nothing was committed.

**Source:** `gh issue list -R databayt/<repo> --state open --limit 300` on 2026-11-24 for the 8 repos with open issues (kun 62, hogwarts 34, marketing 25, mkan 12, ios-app 5, space 4, android-app 2, catalog 1). **145 issues**, matching §5 of `org-inventory.md`. None hit the 300 cap. Skipped: shadcn, radix, gocart, twenty (issues off) and the 24 repos with no open issues.

**Normalized severity:** P0 4 · P1 11 · P2 19 · P3 111.
**Disposition:** fix-now 15 · keep 22 · automated/bot tracker 13 · park 59 · close 36.

**Ranking order:** (a) blocks a paying school or revenue (Al-Ibda contract, billing, login at a live school) → (b) breaks production or data → (c) stale/noise → (d) enhancement. A `needs-human` report from someone who cannot log in at alabidae counts as (a). kun#180 (visa) is outside that order; it is in the list because it is legal and gates everything else.

**Owners:** since 2026-06-01 every repo here has one human committer (abdout: hogwarts 1,351, mkan 758, android-app 104, space 160, marketing 66, ios-app 3). So code issues default to *abdout (inferred)*. Support questions go to *aseel (inferred)*, the Sales + QA seat in `team.json`. Anything else is marked **needs-human**; no owner is invented.

**Checked against live state on 11-24 (read-only):** `www.databayt.org/api/upload-auth` answers 200 with a token (marketing#1 is real). `marketing/src/auth.ts:133` still has `debug: true` and `SessionProvider` is still commented out (marketing#3, #9). `balqalam.com` answers 200 (kun#155 is obsolete). `kun.databayt.org/docs/onboarding` answers 307 (kun#78 is fixed). hogwarts login fixes landed 11-14 (a745af6c7, 1377caf03, 7b282d2bd, efa766319) and 11-22 (d283da1ec, 3ede3a9ee), after all four alabidae login reports. Those fixes *may* already cover the reports; the logs have to show it before anyone closes them.

## 1. Top 25 — work in this order

| # | Issue | Sev | Owner | Age / idle | Action |
|---|---|---|---|---|---|
| 1 | [hogwarts#486](https://github.com/databayt/hogwarts/issues/486) | P0 | abdout (inferred: sole committer) | 7d / 7d | Pull login_attempts for alabidae around 11-16 14:27 UTC; reproduce on a 360px Android; fix or close with the reason via `report` |
| 2 | [hogwarts#467](https://github.com/databayt/hogwarts/issues/467) | P0 | abdout (inferred) | 17d / 17d | Same sweep: "recovered account, then no account" — check the reset → sign-in path after the 11-14 login-email and 11-22 PIN fixes |
| 3 | [hogwarts#463](https://github.com/databayt/hogwarts/issues/463) | P0 | abdout (inferred) | 20d / 20d | Same sweep: reset says the email is unknown — check the reset lookup against the case-insensitive login-email change (efa766319) |
| 4 | [hogwarts#452](https://github.com/databayt/hogwarts/issues/452) | P0 | abdout (inferred) | 28d / 28d | Same sweep: reset code never arrives — check the mail provider log for 10-26; close if a later fix covers it |
| 5 | [hogwarts#468](https://github.com/databayt/hogwarts/issues/468) | P1 | abdout (author) | 16d / 16d | Set trialEndsAt at school creation and record invoices before Al-Ibda's 12-19 bill; update the body to the 11-17 flat 24 SAR price first |
| 6 | [hogwarts#470](https://github.com/databayt/hogwarts/issues/470) | P1 | abdout (author) | 15d / 12d | Tick the boxes against what is live (LiveKit on Hetzner, alabidae Online since 11-09 per memory), then close — 10 min |
| 7 | [hogwarts#469](https://github.com/databayt/hogwarts/issues/469) | P1 | abdout (inferred) | 15d / 15d | Confirm STUDENT rows in live_class_participants for alabidae, then close through `report` with #470 as the fix |
| 8 | [hogwarts#484](https://github.com/databayt/hogwarts/issues/484) | P1 | abdout (author) | 9d / 9d | Fix the every-school items: the always-on dashboard alert, grade letters, English labels on Arabic screens |
| 9 | [hogwarts#490](https://github.com/databayt/hogwarts/issues/490) | P1 | abdout (inferred: sole committer) | 2d / 2d | Work the phone-performance epic: LCP on /dashboard, /live/join, /timetable down to 2.5 s |
| 10 | [marketing#1](https://github.com/databayt/marketing/issues/1) | P1 | abdout (inferred) | 213d / 213d | Require a session in /api/upload-auth (still answers 200 publicly) and rotate the ImageKit private key |
| 11 | [marketing#3](https://github.com/databayt/marketing/issues/3) | P1 | abdout (inferred) | 213d / 213d | Gate debug to dev and strip PII from the auth event logs in src/auth.ts |
| 12 | [kun#167](https://github.com/databayt/kun/issues/167) | P1 | abdout (assigned) | 44d / 10d | Finish e-tax/EBM and the company bank account so the Al-Ibda payment can be invoiced and received |
| 13 | [kun#180](https://github.com/databayt/kun/issues/180) | P1 | abdout (subject) | 11d / 10d | Confirm the visa status today (memory: past grace since 11-21 unless renewed) — legal, not code, but it gates everything |
| 14 | [mkan#85](https://github.com/databayt/mkan/issues/85) | P1 | abdout (author) | 2d / 2d | Deploy the Phase 1 chat funnel that is already on main, then switch on the driver |
| 15 | [mkan#54](https://github.com/databayt/mkan/issues/54) | P1 | abdout (author) | 47d / 15d | Re-run the find-stay sim; fix search-by-location and the photo tour if they still fail |
| 16 | [hogwarts#451](https://github.com/databayt/hogwarts/issues/451) | P2 | aseel (inferred: support/QA) | 32d / 32d | Reply to the alabidae admin with the timetable path; if it is hard to find, add an entry point on /school |
| 17 | [hogwarts#402](https://github.com/databayt/hogwarts/issues/402) | P2 | aseel (inferred: QA) | 84d / 5d | Ali runs the live-class QA pass on the paying school's real flows; findings go back as reports |
| 18 | [kun#12](https://github.com/databayt/kun/issues/12) | P2 | needs-human | 210d / 210d | Abdout + Abobaker lock the reserve split before the first cash lands (Al-Ibda, 12-19) |
| 19 | [hogwarts#493](https://github.com/databayt/hogwarts/issues/493) | P2 | abdout (assigned) | 0d / 0d | Check the readiness-digest Worker cron (shipped today); the issue closes itself on the next ok |
| 20 | [hogwarts#460](https://github.com/databayt/hogwarts/issues/460) | P2 | abdout (assigned) | 21d / 21d | Take the 2 open decisions so Playwright on main can go green |
| 21 | [mkan#69](https://github.com/databayt/mkan/issues/69) | P2 | abdout (assigned) | 15d / 0d | Free disk on the owner Mac (under 10 GiB) so the TikTok evening slot renders again |
| 22 | [mkan#84](https://github.com/databayt/mkan/issues/84) | P2 | abdout (assigned) | 3d / 1d | Find why the TikTok render failed twice; house posting is never off |
| 23 | [mkan#66](https://github.com/databayt/mkan/issues/66) | P2 | abdout (author) | 16d / 16d | Move mkan from the $29/mo container to a plain Worker (cash) |
| 24 | [kun#163](https://github.com/databayt/kun/issues/163) | P2 | abdout (assigned) | 51d / 0d | Confirm auto-renew for balqalam.com in the Cloudflare dashboard (expires 2027-08-02) and set DMARC |
| 25 | [hogwarts#485](https://github.com/databayt/hogwarts/issues/485) | P2 | abdout (inferred) | 8d / 8d | Retest the team's "could not enter the class" on demo after the live fixes; close or fix |

**Fix first (5):** (1) the alabidae login cluster #486/#467/#463/#452 as one sweep: a school that pays cannot afford people locked out. (2) hogwarts#468: the product does not know about trials or invoices, and the first bill is 12-19. (3) hogwarts#484: wrong data on every school's dashboard is the first thing a principal sees. (4) hogwarts#490: 5–6 s pages on the phones the school actually uses. (5) marketing#1 + #3: a public token mint and PII in production logs, both verified live today. Do the 10-minute #470/#469 verify-and-close alongside.

## 2. Every open issue, normalized

Bucket: a = revenue/paying school · b = production/data · c = stale/noise · d = enhancement · x = outside the rubric. Disposition: top / keep / bot (opened and closed by a script) / park / close.

| Issue | Sev | Type | Bucket | Disp | Owner | Age | Idle | Labels now | Why it matters |
|---|---|---|---|---|---|---|---|---|---|
| [hogwarts#486](https://github.com/databayt/hogwarts/issues/486) | P0 | bug | a | top | abdout (inferred: sole committer) | 7d | 7d | report, needs-human | alabidae login fails with correct details (11-16, anonymous, Android) — login at the live paying school |
| [hogwarts#467](https://github.com/databayt/hogwarts/issues/467) | P0 | bug | a | top | abdout (inferred) | 17d | 17d | report, needs-human | alabidae: recovered account, then login says no account exists (11-06) |
| [hogwarts#463](https://github.com/databayt/hogwarts/issues/463) | P0 | bug | a | top | abdout (inferred) | 20d | 20d | report, needs-human | alabidae password reset: email not recognised (11-03) |
| [hogwarts#452](https://github.com/databayt/hogwarts/issues/452) | P0 | bug | a | top | abdout (inferred) | 28d | 28d | report, needs-human | alabidae password reset: code never sent (10-26) |
| [hogwarts#468](https://github.com/databayt/hogwarts/issues/468) | P1 | feature | a | top | abdout (author) | 16d | 16d | enhancement, area: finance, P2 | billing: trialEndsAt never set, no invoices in-app; Al-Ibda bill due 12-19; body predates 11-17 pricing change |
| [hogwarts#470](https://github.com/databayt/hogwarts/issues/470) | P1 | chore | a | top | abdout (author) | 15d | 12d | P0 | go-live tracker still open, 0/5 boxes ticked; memory says LiveKit self-hosted + alabidae online since 11-09 — verify and close |
| [hogwarts#469](https://github.com/databayt/hogwarts/issues/469) | P1 | bug | a | top | abdout (inferred) | 15d | 15d | report, needs-human | student at alabidae could not enter class (11-08); root cause #470 — confirm STUDENT rows in live_class_participants, close via report |
| [hogwarts#484](https://github.com/databayt/hogwarts/issues/484) | P1 | bug | a | top | abdout (author) | 9d | 9d | bug, area: i18n | every school: dashboard always shows an alert, wrong grade letters, English labels on Arabic screens |
| [hogwarts#490](https://github.com/databayt/hogwarts/issues/490) | P1 | feature | a | top | abdout (inferred: sole committer) | 2d | 2d | enhancement, area: platform, P1, epic | live paying school slow on phones: LCP 5.1–6.3 s vs 2.5 s target on dashboard, live room, join, timetable |
| [marketing#1](https://github.com/databayt/marketing/issues/1) | P1 | bug | b | top | abdout (inferred) | 213d | 213d | bug | /api/upload-auth unauthenticated — www.databayt.org returned 200 + upload token on 11-24 |
| [marketing#3](https://github.com/databayt/marketing/issues/3) | P1 | bug | b | top | abdout (inferred) | 213d | 213d | bug | auth.ts still ships debug: true and logs sign-in PII in prod (checked 11-24) |
| [kun#167](https://github.com/databayt/kun/issues/167) | P1 | chore | a | top | abdout (assigned) | 44d | 10d | P1-high, scope:business, assign:abdout, type/chore | Databayt Ltd registered 11-08; e-tax/EBM + bank still open — needed to invoice and receive the Al-Ibda payment |
| [kun#180](https://github.com/databayt/kun/issues/180) | P1 | chore | x | top | abdout (subject) | 11d | 10d | — | Rwanda V6 visa expired 11-16; memory says past grace since 11-21 unless renewed — legal, outside the code rubric |
| [mkan#85](https://github.com/databayt/mkan/issues/85) | P1 | feature | a | top | abdout (author) | 2d | 2d | enhancement | chat funnel rebuild on main, not deployed — 44 people → 0 viewing times in 60 d |
| [mkan#54](https://github.com/databayt/mkan/issues/54) | P1 | bug | b | top | abdout (author) | 47d | 15d | bug | prod: search ignores location, photo tour never loads (47 d; verify it still reproduces) |
| [hogwarts#451](https://github.com/databayt/hogwarts/issues/451) | P2 | report | a | keep | aseel (inferred: support/QA) | 32d | 32d | report, low-confidence | alabidae ADMIN could not find where to create timetables (32 d) — UX/support gap at the paying school |
| [hogwarts#402](https://github.com/databayt/hogwarts/issues/402) | P2 | chore | a | keep | aseel (inferred: QA) | 84d | 5d | stale, area: platform, qa, P1 | human QA pass of live classes (room, join, attendance, recordings) |
| [kun#12](https://github.com/databayt/kun/issues/12) | P2 | chore | a | keep | needs-human | 210d | 210d | type/chore, priority/p1, status/triage, area: workflow | lock founder/operating/contributor split "before the first cash distribution" — Al-Ibda bill lands 12-19 |
| [hogwarts#493](https://github.com/databayt/hogwarts/issues/493) | P2 | chore | b | bot | abdout (assigned) | 0d | 0d | job-health | readiness-digest cron silent 135 min on prod (feature shipped 11-24); auto-closes on next ok |
| [hogwarts#460](https://github.com/databayt/hogwarts/issues/460) | P2 | chore | b | keep | abdout (assigned) | 21d | 21d | — | Playwright has no green run since 09-18; red on main today; 2 decisions left |
| [mkan#69](https://github.com/databayt/mkan/issues/69) | P2 | chore | b | bot | abdout (assigned) | 15d | 0d | job-health | evening TikTok slot cannot render — owner Mac disk under 10 GiB (touched today) |
| [mkan#84](https://github.com/databayt/mkan/issues/84) | P2 | chore | b | bot | abdout (assigned) | 3d | 1d | job-health | TikTok render failed twice (house posting is never off) |
| [mkan#66](https://github.com/databayt/mkan/issues/66) | P2 | chore | a | keep | abdout (author) | 16d | 16d | enhancement | move mkan off its $29/mo container to a plain Worker (cash) |
| [kun#163](https://github.com/databayt/kun/issues/163) | P2 | chore | b | bot | abdout (assigned) | 51d | 0d | priority/p1, domains | balqalam.com (the paying school's domain) auto-renew unverified; expires 2027-08-02 |
| [hogwarts#485](https://github.com/databayt/hogwarts/issues/485) | P2 | report | a | keep | abdout (inferred) | 8d | 8d | report, team, needs-human | team admin could not enter a class on demo — retest after live fixes |
| [space#29](https://github.com/databayt/space/issues/29) | P2 | bug | b | keep | abdout (inferred: sole committer) | 39d | 39d | report, low-confidence | space ADMIN cannot reach price settings (39 d, low-confidence) |
| [marketing#9](https://github.com/databayt/marketing/issues/9) | P2 | bug | b | keep | abdout (inferred) | 213d | 213d | bug | SessionProvider still commented out in [lang]/layout.tsx (checked 11-24) — client auth reads unauthenticated |
| [marketing#5](https://github.com/databayt/marketing/issues/5) | P2 | bug | b | keep | abdout (inferred) | 213d | 213d | bug | ik.imagekit.io missing from images.remotePatterns — verify on www.databayt.org |
| [kun#188](https://github.com/databayt/kun/issues/188) | P2 | feature | d | keep | abdout (author) | 1d | 1d | dept:video, P2, film | Balqalam 2:00 intro film — drives free-month sign-ups |
| [kun#183](https://github.com/databayt/kun/issues/183) | P2 | chore | d | keep | abdout (author) | 10d | 9d | type/chore, priority/p1, status/in-progress, epic | Kun v5 overhaul tracker |
| [hogwarts#483](https://github.com/databayt/hogwarts/issues/483) | P2 | feature | d | keep | abdout (author) | 10d | 10d | enhancement, area: platform | report dialog: private, one click, tracked (approved plan 11-13) |
| [mkan#64](https://github.com/databayt/mkan/issues/64) | P2 | chore | d | keep | abdout (author) | 17d | 15d | enhancement | launch-readiness leftovers (rotation, French copy, indexes) |
| [kun#171](https://github.com/databayt/kun/issues/171) | P2 | chore | d | keep | abdout (approver) | 21d | 21d | engine-decision | skill fleet 4 keep / 13 merge / 13 retire — waits for a yes |
| [kun#170](https://github.com/databayt/kun/issues/170) | P2 | chore | d | keep | abdout (approver) | 21d | 21d | priority/p2 | Anthropic SDK 1.0 migration plan — 2 decisions owed |
| [kun#169](https://github.com/databayt/kun/issues/169) | P3 | chore | d | bot | abdout (approver) | 22d | 0d | engine-decision | engine decisions queue (improve.mjs) |
| [catalog#1](https://github.com/databayt/catalog/issues/1) | P3 | chore | d | bot | abdout (author) | 44d | 0d | — | textbook loop tracker (one comment per tick) |
| [kun#187](https://github.com/databayt/kun/issues/187) | P3 | chore | d | keep | abdout (author) | 1d | 1d | — | friction log for the first film from the Kun app |
| [kun#133](https://github.com/databayt/kun/issues/133) | P3 | chore | d | bot | abdout (author) | 137d | 1d | config-health | Config Health Dashboard (health.sh posts here) |
| [hogwarts#447](https://github.com/databayt/hogwarts/issues/447) | P3 | docs | d | park | abdout (author) | 37d | 6d | documentation, stale, P2 | tutorial videos for every support guide |
| [hogwarts#446](https://github.com/databayt/hogwarts/issues/446) | P3 | chore | d | park | abdout (author) | 37d | 6d | enhancement, stale, P2 | richer demo data for help-center screenshots |
| [hogwarts#482](https://github.com/databayt/hogwarts/issues/482) | P3 | feature | d | keep | abdout (author) | 10d | 10d | enhancement, area: platform | WhatsApp support agent, shadow first (approved plan, nothing built) |
| [space#31](https://github.com/databayt/space/issues/31) | P3 | feature | d | keep | needs-human | 14d | 14d | report, needs-human | card colours/wording request (anonymous) |
| [kun#168](https://github.com/databayt/kun/issues/168) | P3 | feature | d | park | needs-human | 35d | 33d | type:infra | TikTok Content Posting API for mkan |
| [space#30](https://github.com/databayt/space/issues/30) | P3 | feature | d | keep | needs-human | 39d | 39d | report, needs-human | booking: pick a start and end date |
| [hogwarts#442](https://github.com/databayt/hogwarts/issues/442) | P3 | feature | d | keep | abdout (inferred) | 40d | 40d | report, team, needs-human | team request: desktop dashboard first row like mobile |
| [space#28](https://github.com/databayt/space/issues/28) | P3 | feature | d | keep | needs-human | 43d | 43d | report, needs-human | icon focus fill style |
| [kun#134](https://github.com/databayt/kun/issues/134) | P3 | chore | d | keep | abdout (inferred) | 136d | 136d | P2-medium, type:infra | Prisma 6 → 7 plan; 6.x maintenance ended Apr 2026 |
| [kun#166](https://github.com/databayt/kun/issues/166) | P3 | chore | c | bot | abdout (assigned) | 51d | 0d | priority/p1, domains | nmbdsd.org auto-renew unverified; expires 2027-09-08 |
| [kun#165](https://github.com/databayt/kun/issues/165) | P3 | chore | c | bot | abdout (assigned) | 51d | 0d | priority/p1, domains | abdoutgroup.com auto-renew OFF; expires 2027-11-05; DNS probes failing |
| [kun#164](https://github.com/databayt/kun/issues/164) | P3 | chore | c | bot | abdout (assigned) | 51d | 0d | priority/p1, domains | mkan.sd auto-renew unverified; expires 2027-07-08; spoofable mail |
| [kun#161](https://github.com/databayt/kun/issues/161) | P3 | chore | c | bot | abdout (assigned) | 51d | 0d | priority/p1, domains | databayt.org auto-renew unverified; expires 2027-06-14 |
| [mkan#65](https://github.com/databayt/mkan/issues/65) | P3 | chore | c | bot | abdout (assigned) | 17d | 0d | job-health | sprint-runner no ok for 3 h (17 d old, touched today) |
| [hogwarts#487](https://github.com/databayt/hogwarts/issues/487) | P3 | report | c | close | aseel (inferred: support/QA) | 7d | 7d | report, low-confidence | teacher asks where the trial class is — a support answer (practice room shipped 11-16), not a bug |
| [hogwarts#481](https://github.com/databayt/hogwarts/issues/481) | P3 | report | c | close | aseel (inferred: support/QA) | 11d | 11d | report, low-confidence | teacher asks if a class is 60 or 40 min — a support answer, not a bug |
| [hogwarts#472](https://github.com/databayt/hogwarts/issues/472) | P3 | chore | c | bot | abdout (assigned) | 14d | 14d | job-health | perf.yml scheduled run fails after re-run — CI noise; fix or delete the workflow |
| [hogwarts#461](https://github.com/databayt/hogwarts/issues/461) | P3 | chore | c | close | abdout (assigned) | 21d | 14d | job-health | keep-cache-warm.yml warms Vercel, which no longer serves prod (Cloudflare) — delete the workflow, then close |
| [hogwarts#455](https://github.com/databayt/hogwarts/issues/455) | P3 | report | c | close | needs-human | 23d | 23d | report, needs-human | keyboard mash on balqalam.com/en (anonymous) — spam |
| [hogwarts#448](https://github.com/databayt/hogwarts/issues/448) | P3 | report | c | close | needs-human | 35d | 35d | report, low-confidence | gibberish from an alabidae ADMIN session |
| [hogwarts#441](https://github.com/databayt/hogwarts/issues/441) | P3 | report | c | close | needs-human | 40d | 40d | report, needs-human | keyboard mash on balqalam.com/en (anonymous) — spam |
| [kun#162](https://github.com/databayt/kun/issues/162) | P3 | chore | c | close | abdout (assigned) | 51d | 51d | priority/p1 | duplicate of the per-domain bot issues #161 #163–#166 |
| [kun#160](https://github.com/databayt/kun/issues/160) | P3 | chore | c | close | needs-human | 58d | 58d | — | Cowork jobs handoff; UNDP deadline was 29 Sep |
| [kun#159](https://github.com/databayt/kun/issues/159) | P3 | chore | c | park | abdout (assigned) | 62d | 62d | P1-high | Cloudflare NS for abdoutgroup.com + nmbdsd.org (62 d) |
| [hogwarts#422](https://github.com/databayt/hogwarts/issues/422) | P3 | report | c | close | needs-human | 64d | 64d | report, low-confidence | alwafi is primary-only — tenant data note, 64 d; confirm alwafi is still a tenant |
| [kun#156](https://github.com/databayt/kun/issues/156) | P3 | chore | c | park | needs-human | 72d | 72d | scope:cross-repo, assign:captain, type/chore, priority/p1, status/ready | hogwarts PWA follow-through delegated to Cowork (72 d) |
| [kun#155](https://github.com/databayt/kun/issues/155) | P3 | chore | c | close | abdout (assigned) | 77d | 77d | type:infra, scope:captain, assign:abdout | balqalam.com DOWN on Vercel (09-07) — obsolete: it answers 200 on Cloudflare today |
| [kun#15](https://github.com/databayt/kun/issues/15) | P3 | chore | c | park | abdout (assigned) | 210d | 78d | assign:abdout, type/chore, priority/p2, status/triage, area: workflow | SSH commit signing for 4 contributors (210 d) |
| [kun#153](https://github.com/databayt/kun/issues/153) | P3 | bug | c | close | needs-human | 92d | 92d | bug, P1-high, type:infra | CRM URLs dead (08-24) — CRM moved to Hetzner 11-14; verify then close |
| [kun#151](https://github.com/databayt/kun/issues/151) | P3 | feature | c | park | needs-human | 92d | 92d | type/feat | social media-brief panel (92 d) |
| [kun#149](https://github.com/databayt/kun/issues/149) | P3 | bug | c | park | abdout (assigned) | 109d | 92d | P1-high, assign:abdout, type/fix | social approval gate has no review destination (92 d) |
| [kun#148](https://github.com/databayt/kun/issues/148) | P3 | chore | c | park | needs-human | 110d | 92d | P3-low, type:infra | CDN social bucket decision (110 d) |
| [kun#145](https://github.com/databayt/kun/issues/145) | P3 | chore | c | close | abdout (assigned) | 115d | 92d | P1-high, scope:captain | 2 FB posts staged with 24 h links (115 d) — links long expired |
| [kun#150](https://github.com/databayt/kun/issues/150) | P3 | feature | c | park | abdout (assigned) | 97d | 97d | P1-high, assign:abdout, type/feat | social comment→DM capture (97 d, labeled P1-high) |
| [mkan#52](https://github.com/databayt/mkan/issues/52) | P3 | feature | c | park | abdout (author) | 99d | 99d | enhancement | restore disabled dialogs (99 d) |
| [kun#147](https://github.com/databayt/kun/issues/147) | P3 | chore | c | park | needs-human | 110d | 110d | P1-high, scope:captain | collect real scenes from Ahmed Baha (110 d) |
| [kun#146](https://github.com/databayt/kun/issues/146) | P3 | chore | c | park | needs-human | 110d | 110d | P1-high, scope:captain | Hogwarts FB page has 0 followers (110 d) |
| [kun#141](https://github.com/databayt/kun/issues/141) | P3 | chore | c | park | needs-human | 119d | 110d | — | five brands on FB + IG status (119 d) |
| [kun#143](https://github.com/databayt/kun/issues/143) | P3 | chore | c | park | needs-human | 119d | 116d | — | Hermes relay never ran end to end (119 d) — Hermes now relays Slack; verify, likely superseded |
| [kun#142](https://github.com/databayt/kun/issues/142) | P3 | chore | c | park | needs-human | 119d | 116d | — | social pipeline config/cron (119 d) |
| [kun#140](https://github.com/databayt/kun/issues/140) | P3 | chore | c | park | needs-human | 120d | 116d | P2-medium, type:infra, scope:business | Instagram for 3 brands (120 d) |
| [kun#144](https://github.com/databayt/kun/issues/144) | P3 | feature | c | park | needs-human | 119d | 119d | — | social groups model — "deliberately ranked last" |
| [mkan#17](https://github.com/databayt/mkan/issues/17) | P3 | feature | c | park | abdout (author) | 209d | 120d | enhancement | Phase D polish/observability (209 d; still names Vercel) |
| [mkan#11](https://github.com/databayt/mkan/issues/11) | P3 | chore | c | park | abdout (author) | 210d | 120d | — | QA Homes & Transport A→Z (210 d) |
| [mkan#9](https://github.com/databayt/mkan/issues/9) | P3 | feature | c | park | abdout (author) | 210d | 120d | enhancement | Phase C1 host publish + real reviews (210 d) |
| [mkan#7](https://github.com/databayt/mkan/issues/7) | P3 | feature | c | park | abdout (author) | 211d | 120d | enhancement | Phase B i18n/RTL sweep (211 d) |
| [kun#137](https://github.com/databayt/kun/issues/137) | P3 | feature | c | park | needs-human | 136d | 136d | enhancement, P3-low | engine graph view (136 d) |
| [kun#136](https://github.com/databayt/kun/issues/136) | P3 | chore | c | park | needs-human | 136d | 136d | P3-low, type:infra | cloud routine for P0 issues (136 d) |
| [kun#135](https://github.com/databayt/kun/issues/135) | P3 | chore | c | park | needs-human | 136d | 136d | P2-medium, type:infra | shadcn Base UI default decision (136 d) |
| [marketing#49](https://github.com/databayt/marketing/issues/49) | P3 | chore | c | close | needs-human | 152d | 152d | request | test project request ("safe to ignore") |
| [kun#131](https://github.com/databayt/kun/issues/131) | P3 | chore | c | close | needs-human | 172d | 172d | P2-medium, type:rule, type:infra, scope:tech | adopt path-scoping/drift guards (172 d) — path-scoped rules exist now; verify then close |
| [kun#129](https://github.com/databayt/kun/issues/129) | P3 | docs | c | close | abdout (assigned) | 172d | 172d | P1-high, type:docs, assign:abdout | GTM docs (172 d) — written in the PR era; verify docs/GO-TO-MARKET.md, close |
| [kun#127](https://github.com/databayt/kun/issues/127) | P3 | chore | c | park | abdout (assigned) | 178d | 178d | assign:abdout, type/refactor, priority/p2 | consolidate quality vocab (178 d) |
| [kun#125](https://github.com/databayt/kun/issues/125) | P3 | feature | c | close | abdout (assigned) | 179d | 179d | assign:abdout, type/feat, priority/p2 | /release orchestrator — the skill exists |
| [ios-app#3](https://github.com/databayt/ios-app/issues/3) | P3 | feature | c | close | ibrahim + abdout (named in epic) | 186d | 179d | enhancement, epic | mobile public launch "by end of August" — date passed; re-plan or close |
| [ios-app#35](https://github.com/databayt/ios-app/issues/35) | P3 | feature | c | park | needs-human | 182d | 182d | — | iOS translate client (182 d) |
| [kun#76](https://github.com/databayt/kun/issues/76) | P3 | chore | c | close | abdout (author) | 186d | 183d | scope:captain, status/in-progress, epic | Q3 Jun–Aug sprint tracker — quarter is over |
| [android-app#12](https://github.com/databayt/android-app/issues/12) | P3 | feature | c | park | abdout (inferred: sole committer) | 183d | 183d | enhancement | wire 4 dashboard tiles (183 d) — verify against APK 1.3.3 |
| [android-app#2](https://github.com/databayt/android-app/issues/2) | P3 | docs | c | park | abdout (inferred) | 183d | 183d | documentation | refresh epics roadmap (183 d) |
| [ios-app#5](https://github.com/databayt/ios-app/issues/5) | P3 | bug | c | park | needs-human | 184d | 184d | — | Swift 6 concurrency errors (184 d) — iOS CI red since 11-15 |
| [ios-app#4](https://github.com/databayt/ios-app/issues/4) | P3 | chore | c | park | needs-human | 184d | 184d | — | pin Xcode/iOS combo in CI (184 d) |
| [kun#78](https://github.com/databayt/kun/issues/78) | P3 | bug | c | close | needs-human | 186d | 186d | bug | /docs/<slug> 404 — /docs/onboarding answers 307 today |
| [kun#77](https://github.com/databayt/kun/issues/77) | P3 | docs | c | close | abdout (author) | 186d | 186d | documentation | onboarding announcement (186 d), not work; pin elsewhere if wanted |
| [kun#74](https://github.com/databayt/kun/issues/74) | P3 | docs | c | close | needs-human | 186d | 186d | type:docs | onboarding feedback via report (186 d) — superseded |
| [kun#72](https://github.com/databayt/kun/issues/72) | P3 | docs | c | close | needs-human | 186d | 186d | type:docs | onboarding field notes (186 d) — #74 replaced it |
| [kun#28](https://github.com/databayt/kun/issues/28) | P3 | chore | c | park | abdout (assigned) | 191d | 191d | — | bootstrap.ps1 spec (191 d) — check against the Machine app |
| [kun#27](https://github.com/databayt/kun/issues/27) | P3 | chore | c | park | abdout (assigned) | 191d | 191d | — | maintain.ps1 spec (191 d) |
| [kun#24](https://github.com/databayt/kun/issues/24) | P3 | docs | c | park | abdout (assigned) | 191d | 191d | — | onboarding 3-action rewrite (191 d) |
| [kun#19](https://github.com/databayt/kun/issues/19) | P3 | chore | c | park | needs-human | 195d | 195d | P3-low, type:infra | dotfiles install one-liner (195 d) |
| [kun#14](https://github.com/databayt/kun/issues/14) | P3 | chore | c | close | needs-human | 210d | 210d | type/chore, priority/p2, status/triage, area: workflow | replicate .github kit to 12 repos (210 d) — PR-era kit; main-only workflow now |
| [kun#13](https://github.com/databayt/kun/issues/13) | P3 | chore | c | park | needs-human | 210d | 210d | type/chore, priority/p2, status/triage, area: workflow | create databayt/revenue repo (210 d) |
| [kun#11](https://github.com/databayt/kun/issues/11) | P3 | bug | c | close | needs-human | 210d | 210d | type/fix, priority/p2, status/triage, area: workflow | TS2322 in mdx-components (210 d) — kun CI green today; verify typecheck, close |
| [kun#9](https://github.com/databayt/kun/issues/9) | P3 | feature | c | park | abdout (assigned) | 212d | 210d | P1-high, type:infra, scope:cross-repo, assign:abdout, status/in-review | unified git workflow + evidence layer (status/in-review, 210 d) |
| [marketing#47](https://github.com/databayt/marketing/issues/47) | P3 | feature | c | park | abdout (inferred: sole committer) | 211d | 211d | — | report-issue site-wide (211 d) |
| [kun#8](https://github.com/databayt/kun/issues/8) | P3 | chore | c | close | needs-human | 212d | 212d | enhancement | cdn.databayt.org CNAME (212 d) — CDN migration done per memory; verify, close |
| [marketing#45](https://github.com/databayt/marketing/issues/45) | P3 | bug | c | park | abdout (inferred) | 212d | 212d | bug | Next 16 LayoutProps typing (212 d) |
| [marketing#43](https://github.com/databayt/marketing/issues/43) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | documentation | delete dead pricing scaffolding (212 d) |
| [marketing#41](https://github.com/databayt/marketing/issues/41) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | documentation | delete dead wizard/branding scaffolding (212 d) |
| [marketing#39](https://github.com/databayt/marketing/issues/39) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | enhancement | lazy-load chatbot, RSC layout (212 d) |
| [marketing#37](https://github.com/databayt/marketing/issues/37) | P3 | docs | c | park | abdout (inferred) | 212d | 212d | documentation | consolidate i18n docs (212 d) |
| [marketing#35](https://github.com/databayt/marketing/issues/35) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | documentation | tree hygiene (212 d) |
| [marketing#33](https://github.com/databayt/marketing/issues/33) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | enhancement | drop extra icon libraries (212 d) |
| [marketing#31](https://github.com/databayt/marketing/issues/31) | P3 | feature | c | park | abdout (inferred) | 212d | 212d | enhancement | per-segment loading.tsx (212 d) |
| [marketing#29](https://github.com/databayt/marketing/issues/29) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | enhancement | strip console.* in prod (212 d) |
| [marketing#27](https://github.com/databayt/marketing/issues/27) | P3 | chore | c | park | abdout (inferred) | 212d | 212d | documentation | delete duplicate i18n middleware (212 d) |
| [marketing#25](https://github.com/databayt/marketing/issues/25) | P3 | bug | c | park | abdout (inferred) | 212d | 212d | bug | RTL: physical Tailwind props (212 d) |
| [marketing#23](https://github.com/databayt/marketing/issues/23) | P3 | feature | c | park | abdout (inferred) | 212d | 212d | enhancement | locale-aware date/currency (212 d) |
| [marketing#21](https://github.com/databayt/marketing/issues/21) | P3 | feature | c | park | abdout (inferred) | 212d | 212d | enhancement | chatbot/mode-switcher translations (212 d) |
| [marketing#19](https://github.com/databayt/marketing/issues/19) | P3 | feature | c | park | abdout (inferred) | 212d | 212d | enhancement | expert-modal translations (212 d) |
| [marketing#17](https://github.com/databayt/marketing/issues/17) | P3 | bug | c | park | abdout (inferred) | 212d | 212d | bug | User.username → name drift (212 d) |
| [marketing#15](https://github.com/databayt/marketing/issues/15) | P3 | feature | c | park | abdout (inferred) | 212d | 212d | enhancement | auth-form strings to dictionaries (212 d) |
| [marketing#13](https://github.com/databayt/marketing/issues/13) | P3 | bug | c | park | abdout (inferred) | 212d | 212d | bug | dictionary type drift (212 d) |
| [marketing#11](https://github.com/databayt/marketing/issues/11) | P3 | bug | c | park | abdout (inferred) | 213d | 213d | bug | strict-mode prep fixes (212 d) |
| [marketing#7](https://github.com/databayt/marketing/issues/7) | P3 | bug | c | park | abdout (inferred) | 213d | 213d | bug | 404 page hardcodes English (213 d) |
| [ios-app#1](https://github.com/databayt/ios-app/issues/1) | P3 | feature | c | park | needs-human | 214d | 214d | — | WhatsApp chat-list in SwiftUI (214 d) |
| [kun#5](https://github.com/databayt/kun/issues/5) | P3 | chore | c | close | needs-human | 238d | 238d | type:agent, scope:captain, assign:captain | Agent OS built (238 d) — a report, not work |
| [kun#4](https://github.com/databayt/kun/issues/4) | P3 | chore | c | park | needs-human | 238d | 238d | P1-high, type:infra, scope:cross-repo | test Windows install for 4 roles (238 d) |
| [kun#3](https://github.com/databayt/kun/issues/3) | P3 | chore | c | close | abdout (assigned) | 238d | 238d | P2-medium, type:infra, assign:abdout | persist browser sessions (238 d) — superseded by vault Chrome + auth skill |
| [kun#2](https://github.com/databayt/kun/issues/2) | P3 | chore | c | close | needs-human | 238d | 238d | P2-medium, type:mcp, scope:captain | Discord plugin (238 d) — team is on Slack |
| [kun#1](https://github.com/databayt/kun/issues/1) | P3 | chore | c | close | abdout (assigned) | 238d | 238d | P1-high, type:mcp, assign:abdout | 7 MCP API keys (238 d) — superseded by Keychain credentials |
| [hogwarts#11](https://github.com/databayt/hogwarts/issues/11) | P3 | chore | c | close | needs-human | 455d | 294d | good first issue | typography refactor (455 d, last touch 294 d) |
| [hogwarts#18](https://github.com/databayt/hogwarts/issues/18) | P3 | docs | c | close | needs-human | 455d | 455d | documentation, good first issue | good-first-issue from 2025 (455 d); no outside contributors |
| [hogwarts#17](https://github.com/databayt/hogwarts/issues/17) | P3 | docs | c | close | needs-human | 455d | 455d | documentation, good first issue | good-first-issue from 2025 (455 d) |
| [hogwarts#15](https://github.com/databayt/hogwarts/issues/15) | P3 | chore | c | close | needs-human | 455d | 455d | good first issue | commitlint setup (455 d) |
| [hogwarts#14](https://github.com/databayt/hogwarts/issues/14) | P3 | chore | c | close | needs-human | 455d | 455d | good first issue | ESLint setup (455 d) |
| [hogwarts#13](https://github.com/databayt/hogwarts/issues/13) | P3 | chore | c | close | needs-human | 455d | 455d | good first issue | Prettier setup (455 d) |
| [hogwarts#12](https://github.com/databayt/hogwarts/issues/12) | P3 | chore | c | close | needs-human | 455d | 455d | good first issue | hardcoded colors (455 d) |

## 3. Proposed shared label scheme — 11 labels

| Label | Meaning | Replaces |
|---|---|---|
| `priority/p0` | drop everything: a paying school is blocked, or prod/data is broken now | P0, P0-critical |
| `priority/p1` | this week | P1, P1-high, priority/p1 |
| `priority/p2` | this sprint | P2, P2-medium, priority/p2 |
| `priority/p3` | backlog | P3-low |
| `type:bug` | something is wrong | bug, type/fix |
| `type:feature` | new capability | enhancement, type/feat |
| `type:chore` | ops, infra, docs, refactor, config, decisions | documentation, type:infra, type:docs, type:mcp, type:rule, type:agent, type/chore, type/refactor |
| `report` | came from the in-app report dialog (already shared) | — |
| `needs-human` | a person must decide (already shared) | — |
| `low-confidence` | report scored low (already shared) | — |
| `team` | reported by a databayt team member (already shared) | — |

**Why `priority/pN` and not bare `P<n>`:** the brief names `P<n>` as the global convention (`github-workflow.md`), but kun's own writers already emit `priority/pN`: `scripts/domains/check.mjs:301`, `.claude/scripts/improve.mjs:89` (required_labels), and `scripts/issues/hygiene.sh` declares it canonical (orchestration plan item 3, 2026-11-01). Picking `priority/pN` needs no code change; the rule doc changes one line. **needs-human:** Abdout picks. The script below has `PFX` at the top; set `PFX=P` to use `P0..P3`, and then those three files must change too.

**Not in the scheme, so the script leaves them alone:** labels that code writes or reads. Renaming any of them breaks a job. `job-health` (supervise.mjs), `domains` (scripts/domains/check.mjs), `engine-decision` and `config-health` (improve.mjs, health.sh), `stale` (hogwarts `.github/workflows/stale.yml`), and the report pipeline's `verified-report`, `accepted`, `corroborated`, `cannot-reproduce`, `severity/*`, `lang/*` (`kun/src/lib/report/labels.ts`).

**Dropped, no replacement:** `assign:abdout` becomes the GitHub assignee abdout. `assign:captain` is dropped (captain is an agent, not a GitHub user). `status/*` is dropped (open/closed plus the assignee carry the state). `area:*`, `scope:*`, `dept:video`, `film`, `qa`, `epic`, `good first issue` and `request` are dropped (the repo and title carry the area; there are no outside contributors). Note: hogwarts `stale.yml` exempts `good first issue`, so removing it lets the stale bot reach #11–#18, which this list closes anyway.

### Per-repo mapping (current label → new)

- **kun**: `type:infra` (13) → type:chore · `P1-high` (12) → priority/p1 · `assign:abdout` (11) → assignee abdout · `priority/p1` (9) → priority/p1 (kept) · `type/chore` (7) → type:chore · `priority/p2` (7) → priority/p2 (kept) · `scope:captain` (7) → (drop) · `P2-medium` (6) → priority/p2 · `domains` (5) → (machine — untouched) · `status/triage` (5) → (drop) · `area: workflow` (5) → (drop) · `P3-low` (4) → priority/p3 · `scope:cross-repo` (3) → (drop) · `type/feat` (3) → type:feature · `type:docs` (3) → type:chore · `status/in-progress` (2) → (drop) · `epic` (2) → (drop) · `engine-decision` (2) → (machine — untouched) · `scope:business` (2) → (drop) · `assign:captain` (2) → (drop) · `bug` (2) → type:bug · `type/fix` (2) → type:bug · `enhancement` (2) → type:feature · `type:mcp` (2) → type:chore · `dept:video` (1) → (drop) · `P2` (1) → priority/p2 · `film` (1) → (drop) · `status/ready` (1) → (drop) · `config-health` (1) → (machine — untouched) · `type:rule` (1) → type:chore · `scope:tech` (1) → (drop) · `type/refactor` (1) → type:chore · `documentation` (1) → type:chore · `status/in-review` (1) → (drop) · `type:agent` (1) → type:chore
- **hogwarts**: `report` (14) → report (kept) · `needs-human` (9) → needs-human (kept) · `good first issue` (7) → (drop) · `enhancement` (5) → type:feature · `low-confidence` (5) → low-confidence (kept) · `area: platform` (4) → (drop) · `job-health` (3) → (machine — untouched) · `P2` (3) → priority/p2 · `documentation` (3) → type:chore · `stale` (3) → (machine — untouched) · `P1` (2) → priority/p1 · `team` (2) → team (kept) · `epic` (1) → (drop) · `bug` (1) → type:bug · `area: i18n` (1) → (drop) · `P0` (1) → priority/p0 · `area: finance` (1) → (drop) · `qa` (1) → (drop)
- **marketing**: `bug` (10) → type:bug · `enhancement` (8) → type:feature · `documentation` (5) → type:chore · `request` (1) → (drop)
- **mkan**: `enhancement` (7) → type:feature · `job-health` (3) → (machine — untouched) · `bug` (1) → type:bug
- **ios-app**: `enhancement` (1) → type:feature · `epic` (1) → (drop)
- **space**: `report` (4) → report (kept) · `needs-human` (3) → needs-human (kept) · `low-confidence` (1) → low-confidence (kept)
- **android-app**: `enhancement` (1) → type:feature · `documentation` (1) → type:chore
- **catalog**: no labels on open issues — gets `priority/pN` + `type:*` from the triage only.

The script applies the **triaged** severity and type from §2, not a mechanical copy of the old label, so an old `P1-high` on a 97-day-idle issue becomes `priority/p3`. The mapping above shows where each old label goes.

### Relabel script — DO-NOT-RUN-WITHOUT-ABDOUT

> ⚠️ **DO-NOT-RUN-WITHOUT-ABDOUT.** Every line mutates GitHub. Stage 1 creates labels, stage 2 relabels 132 open issues (the 13 bot-owned ones are skipped), stage 3 (commented) deletes retired labels, stage 4 (commented) closes the issues in §4. Run each stage on its own, after a yes.

```bash
#!/usr/bin/env bash
# DO-NOT-RUN-WITHOUT-ABDOUT — generated 2026-11-24 by a read-only triage run. Mutates labels on databayt/*.
set -euo pipefail
PFX=priority/p   # or PFX=P to follow github-workflow.md literally (then update check.mjs:301, improve.mjs:89, hygiene.sh)
REPOS=(kun hogwarts marketing mkan ios-app space android-app catalog)

# --- stage 1: create the scheme in every repo (idempotent: --force updates colour/description) ---
for r in "${REPOS[@]}"; do
  gh label create "${PFX}0" -R databayt/$r --color B60205 --description "drop everything" --force
  gh label create "${PFX}1" -R databayt/$r --color D93F0B --description "this week" --force
  gh label create "${PFX}2" -R databayt/$r --color FBCA04 --description "this sprint" --force
  gh label create "${PFX}3" -R databayt/$r --color C5DEF5 --description "backlog" --force
  gh label create type:bug -R databayt/$r --color D73A4A --description "something is wrong" --force
  gh label create type:feature -R databayt/$r --color A2EEEF --description "new capability" --force
  gh label create type:chore -R databayt/$r --color EDEDED --description "ops, infra, docs, refactor, decisions" --force
done

# --- stage 2: relabel each open issue (triaged severity + type; strip retired labels; assign:abdout → assignee) ---
# note: if PFX=P, an old priority/pN label matching the new severity survives; delete priority/p0..p3 by hand afterwards (stage 3 keeps them because kun scripts write them).
# bot-owned issues (job-health, domains, engine-decision, config-health, textbook loop) are skipped: their scripts rewrite the labels on every run.
gh issue edit 486 -R databayt/hogwarts --add-label "${PFX}0,type:bug"
gh issue edit 467 -R databayt/hogwarts --add-label "${PFX}0,type:bug"
gh issue edit 463 -R databayt/hogwarts --add-label "${PFX}0,type:bug"
gh issue edit 452 -R databayt/hogwarts --add-label "${PFX}0,type:bug"
gh issue edit 468 -R databayt/hogwarts --add-label "${PFX}1,type:feature" --remove-label "P2,area: finance,enhancement"
gh issue edit 470 -R databayt/hogwarts --add-label "${PFX}1,type:chore" --remove-label "P0"
gh issue edit 469 -R databayt/hogwarts --add-label "${PFX}1,type:bug"
gh issue edit 484 -R databayt/hogwarts --add-label "${PFX}1,type:bug" --remove-label "area: i18n,bug"
gh issue edit 490 -R databayt/hogwarts --add-label "${PFX}1,type:feature" --remove-label "P1,area: platform,enhancement,epic"
gh issue edit 1 -R databayt/marketing --add-label "${PFX}1,type:bug" --remove-label "bug"
gh issue edit 3 -R databayt/marketing --add-label "${PFX}1,type:bug" --remove-label "bug"
gh issue edit 167 -R databayt/kun --add-label "${PFX}1,type:chore" --remove-label "P1-high,assign:abdout,scope:business,type/chore"
gh issue edit 180 -R databayt/kun --add-label "${PFX}1,type:chore"
gh issue edit 85 -R databayt/mkan --add-label "${PFX}1,type:feature" --remove-label "enhancement"
gh issue edit 54 -R databayt/mkan --add-label "${PFX}1,type:bug" --remove-label "bug"
gh issue edit 451 -R databayt/hogwarts --add-label "${PFX}2"
gh issue edit 402 -R databayt/hogwarts --add-label "${PFX}2,type:chore" --remove-label "P1,area: platform,qa"
gh issue edit 12 -R databayt/kun --add-label "${PFX}2,type:chore" --remove-label "area: workflow,priority/p1,status/triage,type/chore"
# skip hogwarts#493 — bot-owned; triaged P2 in section 2
gh issue edit 460 -R databayt/hogwarts --add-label "${PFX}2,type:chore"
# skip mkan#69 — bot-owned; triaged P2 in section 2
# skip mkan#84 — bot-owned; triaged P2 in section 2
gh issue edit 66 -R databayt/mkan --add-label "${PFX}2,type:chore" --remove-label "enhancement"
# skip kun#163 — bot-owned; triaged P2 in section 2
gh issue edit 485 -R databayt/hogwarts --add-label "${PFX}2"
gh issue edit 29 -R databayt/space --add-label "${PFX}2,type:bug"
gh issue edit 9 -R databayt/marketing --add-label "${PFX}2,type:bug" --remove-label "bug"
gh issue edit 5 -R databayt/marketing --add-label "${PFX}2,type:bug" --remove-label "bug"
gh issue edit 188 -R databayt/kun --add-label "${PFX}2,type:feature" --remove-label "P2,dept:video,film"
gh issue edit 183 -R databayt/kun --add-label "${PFX}2,type:chore" --remove-label "epic,priority/p1,status/in-progress,type/chore"
gh issue edit 483 -R databayt/hogwarts --add-label "${PFX}2,type:feature" --remove-label "area: platform,enhancement"
gh issue edit 64 -R databayt/mkan --add-label "${PFX}2,type:chore" --remove-label "enhancement"
gh issue edit 171 -R databayt/kun --add-label "${PFX}2,type:chore"
gh issue edit 170 -R databayt/kun --add-label "${PFX}2,type:chore"
# skip kun#169 — bot-owned; triaged P3 in section 2
# skip catalog#1 — bot-owned; triaged P3 in section 2
gh issue edit 187 -R databayt/kun --add-label "${PFX}3,type:chore"
# skip kun#133 — bot-owned; triaged P3 in section 2
gh issue edit 447 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "P2,documentation"
gh issue edit 446 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "P2,enhancement"
gh issue edit 482 -R databayt/hogwarts --add-label "${PFX}3,type:feature" --remove-label "area: platform,enhancement"
gh issue edit 31 -R databayt/space --add-label "${PFX}3,type:feature"
gh issue edit 168 -R databayt/kun --add-label "${PFX}3,type:feature" --remove-label "type:infra"
gh issue edit 30 -R databayt/space --add-label "${PFX}3,type:feature"
gh issue edit 442 -R databayt/hogwarts --add-label "${PFX}3,type:feature"
gh issue edit 28 -R databayt/space --add-label "${PFX}3,type:feature"
gh issue edit 134 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P2-medium,type:infra"
# skip kun#166 — bot-owned; triaged P3 in section 2
# skip kun#165 — bot-owned; triaged P3 in section 2
# skip kun#164 — bot-owned; triaged P3 in section 2
# skip kun#161 — bot-owned; triaged P3 in section 2
# skip mkan#65 — bot-owned; triaged P3 in section 2
gh issue edit 487 -R databayt/hogwarts --add-label "${PFX}3"
gh issue edit 481 -R databayt/hogwarts --add-label "${PFX}3"
# skip hogwarts#472 — bot-owned; triaged P3 in section 2
gh issue edit 461 -R databayt/hogwarts --add-label "${PFX}3,type:chore"
gh issue edit 455 -R databayt/hogwarts --add-label "${PFX}3"
gh issue edit 448 -R databayt/hogwarts --add-label "${PFX}3"
gh issue edit 441 -R databayt/hogwarts --add-label "${PFX}3"
gh issue edit 162 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "priority/p1"
gh issue edit 160 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 159 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high"
gh issue edit 422 -R databayt/hogwarts --add-label "${PFX}3"
gh issue edit 156 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "assign:captain,priority/p1,scope:cross-repo,status/ready,type/chore"
gh issue edit 155 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "assign:abdout,scope:captain,type:infra" --add-assignee abdout
gh issue edit 15 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "area: workflow,assign:abdout,priority/p2,status/triage,type/chore" --add-assignee abdout
gh issue edit 153 -R databayt/kun --add-label "${PFX}3,type:bug" --remove-label "P1-high,bug,type:infra"
gh issue edit 151 -R databayt/kun --add-label "${PFX}3,type:feature" --remove-label "type/feat"
gh issue edit 149 -R databayt/kun --add-label "${PFX}3,type:bug" --remove-label "P1-high,assign:abdout,type/fix" --add-assignee abdout
gh issue edit 148 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P3-low,type:infra"
gh issue edit 145 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high,scope:captain"
gh issue edit 150 -R databayt/kun --add-label "${PFX}3,type:feature" --remove-label "P1-high,assign:abdout,type/feat" --add-assignee abdout
gh issue edit 52 -R databayt/mkan --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 147 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high,scope:captain"
gh issue edit 146 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high,scope:captain"
gh issue edit 141 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 143 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 142 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 140 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P2-medium,scope:business,type:infra"
gh issue edit 144 -R databayt/kun --add-label "${PFX}3,type:feature"
gh issue edit 17 -R databayt/mkan --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 11 -R databayt/mkan --add-label "${PFX}3,type:chore"
gh issue edit 9 -R databayt/mkan --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 7 -R databayt/mkan --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 137 -R databayt/kun --add-label "${PFX}3,type:feature" --remove-label "P3-low,enhancement"
gh issue edit 136 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P3-low,type:infra"
gh issue edit 135 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P2-medium,type:infra"
gh issue edit 49 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "request"
gh issue edit 131 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P2-medium,scope:tech,type:infra,type:rule"
gh issue edit 129 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high,assign:abdout,type:docs" --add-assignee abdout
gh issue edit 127 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "assign:abdout,priority/p2,type/refactor" --add-assignee abdout
gh issue edit 125 -R databayt/kun --add-label "${PFX}3,type:feature" --remove-label "assign:abdout,priority/p2,type/feat" --add-assignee abdout
gh issue edit 3 -R databayt/ios-app --add-label "${PFX}3,type:feature" --remove-label "enhancement,epic"
gh issue edit 35 -R databayt/ios-app --add-label "${PFX}3,type:feature"
gh issue edit 76 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "epic,scope:captain,status/in-progress"
gh issue edit 12 -R databayt/android-app --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 2 -R databayt/android-app --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 5 -R databayt/ios-app --add-label "${PFX}3,type:bug"
gh issue edit 4 -R databayt/ios-app --add-label "${PFX}3,type:chore"
gh issue edit 78 -R databayt/kun --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 77 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 74 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "type:docs"
gh issue edit 72 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "type:docs"
gh issue edit 28 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 27 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 24 -R databayt/kun --add-label "${PFX}3,type:chore"
gh issue edit 19 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P3-low,type:infra"
gh issue edit 14 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "area: workflow,priority/p2,status/triage,type/chore"
gh issue edit 13 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "area: workflow,priority/p2,status/triage,type/chore"
gh issue edit 11 -R databayt/kun --add-label "${PFX}3,type:bug" --remove-label "area: workflow,priority/p2,status/triage,type/fix"
gh issue edit 9 -R databayt/kun --add-label "${PFX}3,type:feature" --remove-label "P1-high,assign:abdout,scope:cross-repo,status/in-review,type:infra" --add-assignee abdout
gh issue edit 47 -R databayt/marketing --add-label "${PFX}3,type:feature"
gh issue edit 8 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "enhancement"
gh issue edit 45 -R databayt/marketing --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 43 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 41 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 39 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "enhancement"
gh issue edit 37 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 35 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 33 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "enhancement"
gh issue edit 31 -R databayt/marketing --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 29 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "enhancement"
gh issue edit 27 -R databayt/marketing --add-label "${PFX}3,type:chore" --remove-label "documentation"
gh issue edit 25 -R databayt/marketing --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 23 -R databayt/marketing --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 21 -R databayt/marketing --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 19 -R databayt/marketing --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 17 -R databayt/marketing --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 15 -R databayt/marketing --add-label "${PFX}3,type:feature" --remove-label "enhancement"
gh issue edit 13 -R databayt/marketing --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 11 -R databayt/marketing --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 7 -R databayt/marketing --add-label "${PFX}3,type:bug" --remove-label "bug"
gh issue edit 1 -R databayt/ios-app --add-label "${PFX}3,type:feature"
gh issue edit 5 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "assign:captain,scope:captain,type:agent"
gh issue edit 4 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high,scope:cross-repo,type:infra"
gh issue edit 3 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P2-medium,assign:abdout,type:infra" --add-assignee abdout
gh issue edit 2 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P2-medium,scope:captain,type:mcp"
gh issue edit 1 -R databayt/kun --add-label "${PFX}3,type:chore" --remove-label "P1-high,assign:abdout,type:mcp" --add-assignee abdout
gh issue edit 11 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "good first issue"
gh issue edit 18 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "documentation,good first issue"
gh issue edit 17 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "documentation,good first issue"
gh issue edit 15 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "good first issue"
gh issue edit 14 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "good first issue"
gh issue edit 13 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "good first issue"
gh issue edit 12 -R databayt/hogwarts --add-label "${PFX}3,type:chore" --remove-label "good first issue"

# --- stage 3 (commented): delete retired labels once stage 2 is done. Removes them from closed issues too. ---
# gh label delete "P1-high" -R databayt/kun --yes
# gh label delete "P2" -R databayt/kun --yes
# gh label delete "P2-medium" -R databayt/kun --yes
# gh label delete "P3-low" -R databayt/kun --yes
# gh label delete "area: workflow" -R databayt/kun --yes
# gh label delete "assign:abdout" -R databayt/kun --yes
# gh label delete "assign:captain" -R databayt/kun --yes
# gh label delete "bug" -R databayt/kun --yes
# gh label delete "dept:video" -R databayt/kun --yes
# gh label delete "documentation" -R databayt/kun --yes
# gh label delete "enhancement" -R databayt/kun --yes
# gh label delete "epic" -R databayt/kun --yes
# gh label delete "film" -R databayt/kun --yes
# gh label delete "scope:business" -R databayt/kun --yes
# gh label delete "scope:captain" -R databayt/kun --yes
# gh label delete "scope:cross-repo" -R databayt/kun --yes
# gh label delete "scope:tech" -R databayt/kun --yes
# gh label delete "status/in-progress" -R databayt/kun --yes
# gh label delete "status/in-review" -R databayt/kun --yes
# gh label delete "status/ready" -R databayt/kun --yes
# gh label delete "status/triage" -R databayt/kun --yes
# gh label delete "type/chore" -R databayt/kun --yes
# gh label delete "type/feat" -R databayt/kun --yes
# gh label delete "type/fix" -R databayt/kun --yes
# gh label delete "type/refactor" -R databayt/kun --yes
# gh label delete "type:agent" -R databayt/kun --yes
# gh label delete "type:docs" -R databayt/kun --yes
# gh label delete "type:infra" -R databayt/kun --yes
# gh label delete "type:mcp" -R databayt/kun --yes
# gh label delete "type:rule" -R databayt/kun --yes
# gh label delete "P0" -R databayt/hogwarts --yes
# gh label delete "P1" -R databayt/hogwarts --yes
# gh label delete "P2" -R databayt/hogwarts --yes
# gh label delete "area: finance" -R databayt/hogwarts --yes
# gh label delete "area: i18n" -R databayt/hogwarts --yes
# gh label delete "area: platform" -R databayt/hogwarts --yes
# gh label delete "bug" -R databayt/hogwarts --yes
# gh label delete "documentation" -R databayt/hogwarts --yes
# gh label delete "enhancement" -R databayt/hogwarts --yes
# gh label delete "epic" -R databayt/hogwarts --yes
# gh label delete "good first issue" -R databayt/hogwarts --yes
# gh label delete "qa" -R databayt/hogwarts --yes
# gh label delete "bug" -R databayt/marketing --yes
# gh label delete "documentation" -R databayt/marketing --yes
# gh label delete "enhancement" -R databayt/marketing --yes
# gh label delete "request" -R databayt/marketing --yes
# gh label delete "bug" -R databayt/mkan --yes
# gh label delete "enhancement" -R databayt/mkan --yes
# gh label delete "enhancement" -R databayt/ios-app --yes
# gh label delete "epic" -R databayt/ios-app --yes
# gh label delete "documentation" -R databayt/android-app --yes
# gh label delete "enhancement" -R databayt/android-app --yes

# --- stage 4 (commented): close the §4 'close' list as not planned, one-line reason each ---
# gh issue close 487 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: teacher asks where the trial class is — a support answer (practice room shipped 11-16), not a bug"
# gh issue close 481 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: teacher asks if a class is 60 or 40 min — a support answer, not a bug"
# gh issue close 461 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: keep-cache-warm.yml warms Vercel, which no longer serves prod (Cloudflare) — delete the workflow, then close"
# gh issue close 455 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: keyboard mash on balqalam.com/en (anonymous) — spam"
# gh issue close 448 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: gibberish from an alabidae ADMIN session"
# gh issue close 441 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: keyboard mash on balqalam.com/en (anonymous) — spam"
# gh issue close 162 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: duplicate of the per-domain bot issues #161 #163–#166"
# gh issue close 160 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: Cowork jobs handoff; UNDP deadline was 29 Sep"
# gh issue close 422 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: alwafi is primary-only — tenant data note, 64 d; confirm alwafi is still a tenant"
# gh issue close 155 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: balqalam.com DOWN on Vercel (09-07) — obsolete: it answers 200 on Cloudflare today"
# gh issue close 153 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: CRM URLs dead (08-24) — CRM moved to Hetzner 11-14; verify then close"
# gh issue close 145 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: 2 FB posts staged with 24 h links (115 d) — links long expired"
# gh issue close 49 -R databayt/marketing --reason "not planned" --comment "Triage 2026-11-24: test project request ('safe to ignore')"
# gh issue close 131 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: adopt path-scoping/drift guards (172 d) — path-scoped rules exist now; verify then close"
# gh issue close 129 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: GTM docs (172 d) — written in the PR era; verify docs/GO-TO-MARKET.md, close"
# gh issue close 125 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: /release orchestrator — the skill exists"
# gh issue close 3 -R databayt/ios-app --reason "not planned" --comment "Triage 2026-11-24: mobile public launch 'by end of August' — date passed; re-plan or close"
# gh issue close 76 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: Q3 Jun–Aug sprint tracker — quarter is over"
# gh issue close 78 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: /docs/<slug> 404 — /docs/onboarding answers 307 today"
# gh issue close 77 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: onboarding announcement (186 d), not work; pin elsewhere if wanted"
# gh issue close 74 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: onboarding feedback via report (186 d) — superseded"
# gh issue close 72 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: onboarding field notes (186 d) — #74 replaced it"
# gh issue close 14 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: replicate .github kit to 12 repos (210 d) — PR-era kit; main-only workflow now"
# gh issue close 11 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: TS2322 in mdx-components (210 d) — kun CI green today; verify typecheck, close"
# gh issue close 8 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: cdn.databayt.org CNAME (212 d) — CDN migration done per memory; verify, close"
# gh issue close 5 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: Agent OS built (238 d) — a report, not work"
# gh issue close 3 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: persist browser sessions (238 d) — superseded by vault Chrome + auth skill"
# gh issue close 2 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: Discord plugin (238 d) — team is on Slack"
# gh issue close 1 -R databayt/kun --reason "not planned" --comment "Triage 2026-11-24: 7 MCP API keys (238 d) — superseded by Keychain credentials"
# gh issue close 11 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: typography refactor (455 d, last touch 294 d)"
# gh issue close 18 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: good-first-issue from 2025 (455 d); no outside contributors"
# gh issue close 17 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: good-first-issue from 2025 (455 d)"
# gh issue close 15 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: commitlint setup (455 d)"
# gh issue close 14 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: ESLint setup (455 d)"
# gh issue close 13 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: Prettier setup (455 d)"
# gh issue close 12 -R databayt/hogwarts --reason "not planned" --comment "Triage 2026-11-24: hardcoded colors (455 d)"
```

## 4. Do not touch — close or park

Nobody should work on these. **Close** means it is done, obsolete, a duplicate, spam or expired; per the report rule, close as *not planned* with a one-line reason. **Park** means it may matter one day, but it is idle past 60 days with no revenue link; leave it open at `priority/p3` and take it out of any active list. Items marked *verify* need one check before closing; the note says which check.

### Close

| Issue | Idle | Reason |
|---|---|---|
| [hogwarts#487](https://github.com/databayt/hogwarts/issues/487) | 7d | teacher asks where the trial class is — a support answer (practice room shipped 11-16), not a bug |
| [hogwarts#481](https://github.com/databayt/hogwarts/issues/481) | 11d | teacher asks if a class is 60 or 40 min — a support answer, not a bug |
| [hogwarts#461](https://github.com/databayt/hogwarts/issues/461) | 14d | keep-cache-warm.yml warms Vercel, which no longer serves prod (Cloudflare) — delete the workflow, then close |
| [hogwarts#455](https://github.com/databayt/hogwarts/issues/455) | 23d | keyboard mash on balqalam.com/en (anonymous) — spam |
| [hogwarts#448](https://github.com/databayt/hogwarts/issues/448) | 35d | gibberish from an alabidae ADMIN session |
| [hogwarts#441](https://github.com/databayt/hogwarts/issues/441) | 40d | keyboard mash on balqalam.com/en (anonymous) — spam |
| [hogwarts#422](https://github.com/databayt/hogwarts/issues/422) | 64d | alwafi is primary-only — tenant data note, 64 d; confirm alwafi is still a tenant |
| [hogwarts#18](https://github.com/databayt/hogwarts/issues/18) | 455d | good-first-issue from 2025 (455 d); no outside contributors |
| [hogwarts#17](https://github.com/databayt/hogwarts/issues/17) | 455d | good-first-issue from 2025 (455 d) |
| [hogwarts#15](https://github.com/databayt/hogwarts/issues/15) | 455d | commitlint setup (455 d) |
| [hogwarts#14](https://github.com/databayt/hogwarts/issues/14) | 455d | ESLint setup (455 d) |
| [hogwarts#13](https://github.com/databayt/hogwarts/issues/13) | 455d | Prettier setup (455 d) |
| [hogwarts#12](https://github.com/databayt/hogwarts/issues/12) | 455d | hardcoded colors (455 d) |
| [hogwarts#11](https://github.com/databayt/hogwarts/issues/11) | 294d | typography refactor (455 d, last touch 294 d) |
| [ios-app#3](https://github.com/databayt/ios-app/issues/3) | 179d | mobile public launch "by end of August" — date passed; re-plan or close |
| [kun#162](https://github.com/databayt/kun/issues/162) | 51d | duplicate of the per-domain bot issues #161 #163–#166 |
| [kun#160](https://github.com/databayt/kun/issues/160) | 58d | Cowork jobs handoff; UNDP deadline was 29 Sep |
| [kun#155](https://github.com/databayt/kun/issues/155) | 77d | balqalam.com DOWN on Vercel (09-07) — obsolete: it answers 200 on Cloudflare today |
| [kun#153](https://github.com/databayt/kun/issues/153) | 92d | CRM URLs dead (08-24) — CRM moved to Hetzner 11-14; verify then close |
| [kun#145](https://github.com/databayt/kun/issues/145) | 92d | 2 FB posts staged with 24 h links (115 d) — links long expired |
| [kun#131](https://github.com/databayt/kun/issues/131) | 172d | adopt path-scoping/drift guards (172 d) — path-scoped rules exist now; verify then close |
| [kun#129](https://github.com/databayt/kun/issues/129) | 172d | GTM docs (172 d) — written in the PR era; verify docs/GO-TO-MARKET.md, close |
| [kun#125](https://github.com/databayt/kun/issues/125) | 179d | /release orchestrator — the skill exists |
| [kun#78](https://github.com/databayt/kun/issues/78) | 186d | /docs/<slug> 404 — /docs/onboarding answers 307 today |
| [kun#77](https://github.com/databayt/kun/issues/77) | 186d | onboarding announcement (186 d), not work; pin elsewhere if wanted |
| [kun#76](https://github.com/databayt/kun/issues/76) | 183d | Q3 Jun–Aug sprint tracker — quarter is over |
| [kun#74](https://github.com/databayt/kun/issues/74) | 186d | onboarding feedback via report (186 d) — superseded |
| [kun#72](https://github.com/databayt/kun/issues/72) | 186d | onboarding field notes (186 d) — #74 replaced it |
| [kun#14](https://github.com/databayt/kun/issues/14) | 210d | replicate .github kit to 12 repos (210 d) — PR-era kit; main-only workflow now |
| [kun#11](https://github.com/databayt/kun/issues/11) | 210d | TS2322 in mdx-components (210 d) — kun CI green today; verify typecheck, close |
| [kun#8](https://github.com/databayt/kun/issues/8) | 212d | cdn.databayt.org CNAME (212 d) — CDN migration done per memory; verify, close |
| [kun#5](https://github.com/databayt/kun/issues/5) | 238d | Agent OS built (238 d) — a report, not work |
| [kun#3](https://github.com/databayt/kun/issues/3) | 238d | persist browser sessions (238 d) — superseded by vault Chrome + auth skill |
| [kun#2](https://github.com/databayt/kun/issues/2) | 238d | Discord plugin (238 d) — team is on Slack |
| [kun#1](https://github.com/databayt/kun/issues/1) | 238d | 7 MCP API keys (238 d) — superseded by Keychain credentials |
| [marketing#49](https://github.com/databayt/marketing/issues/49) | 152d | test project request ("safe to ignore") |

### Park

| Issue | Idle | Reason |
|---|---|---|
| [android-app#12](https://github.com/databayt/android-app/issues/12) | 183d | wire 4 dashboard tiles (183 d) — verify against APK 1.3.3 |
| [android-app#2](https://github.com/databayt/android-app/issues/2) | 183d | refresh epics roadmap (183 d) |
| [hogwarts#447](https://github.com/databayt/hogwarts/issues/447) | 6d | tutorial videos for every support guide |
| [hogwarts#446](https://github.com/databayt/hogwarts/issues/446) | 6d | richer demo data for help-center screenshots |
| [ios-app#35](https://github.com/databayt/ios-app/issues/35) | 182d | iOS translate client (182 d) |
| [ios-app#5](https://github.com/databayt/ios-app/issues/5) | 184d | Swift 6 concurrency errors (184 d) — iOS CI red since 11-15 |
| [ios-app#4](https://github.com/databayt/ios-app/issues/4) | 184d | pin Xcode/iOS combo in CI (184 d) |
| [ios-app#1](https://github.com/databayt/ios-app/issues/1) | 214d | WhatsApp chat-list in SwiftUI (214 d) |
| [kun#168](https://github.com/databayt/kun/issues/168) | 33d | TikTok Content Posting API for mkan |
| [kun#159](https://github.com/databayt/kun/issues/159) | 62d | Cloudflare NS for abdoutgroup.com + nmbdsd.org (62 d) |
| [kun#156](https://github.com/databayt/kun/issues/156) | 72d | hogwarts PWA follow-through delegated to Cowork (72 d) |
| [kun#151](https://github.com/databayt/kun/issues/151) | 92d | social media-brief panel (92 d) |
| [kun#150](https://github.com/databayt/kun/issues/150) | 97d | social comment→DM capture (97 d, labeled P1-high) |
| [kun#149](https://github.com/databayt/kun/issues/149) | 92d | social approval gate has no review destination (92 d) |
| [kun#148](https://github.com/databayt/kun/issues/148) | 92d | CDN social bucket decision (110 d) |
| [kun#147](https://github.com/databayt/kun/issues/147) | 110d | collect real scenes from Ahmed Baha (110 d) |
| [kun#146](https://github.com/databayt/kun/issues/146) | 110d | Hogwarts FB page has 0 followers (110 d) |
| [kun#144](https://github.com/databayt/kun/issues/144) | 119d | social groups model — "deliberately ranked last" |
| [kun#143](https://github.com/databayt/kun/issues/143) | 116d | Hermes relay never ran end to end (119 d) — Hermes now relays Slack; verify, likely superseded |
| [kun#142](https://github.com/databayt/kun/issues/142) | 116d | social pipeline config/cron (119 d) |
| [kun#141](https://github.com/databayt/kun/issues/141) | 110d | five brands on FB + IG status (119 d) |
| [kun#140](https://github.com/databayt/kun/issues/140) | 116d | Instagram for 3 brands (120 d) |
| [kun#137](https://github.com/databayt/kun/issues/137) | 136d | engine graph view (136 d) |
| [kun#136](https://github.com/databayt/kun/issues/136) | 136d | cloud routine for P0 issues (136 d) |
| [kun#135](https://github.com/databayt/kun/issues/135) | 136d | shadcn Base UI default decision (136 d) |
| [kun#127](https://github.com/databayt/kun/issues/127) | 178d | consolidate quality vocab (178 d) |
| [kun#28](https://github.com/databayt/kun/issues/28) | 191d | bootstrap.ps1 spec (191 d) — check against the Machine app |
| [kun#27](https://github.com/databayt/kun/issues/27) | 191d | maintain.ps1 spec (191 d) |
| [kun#24](https://github.com/databayt/kun/issues/24) | 191d | onboarding 3-action rewrite (191 d) |
| [kun#19](https://github.com/databayt/kun/issues/19) | 195d | dotfiles install one-liner (195 d) |
| [kun#15](https://github.com/databayt/kun/issues/15) | 78d | SSH commit signing for 4 contributors (210 d) |
| [kun#13](https://github.com/databayt/kun/issues/13) | 210d | create databayt/revenue repo (210 d) |
| [kun#9](https://github.com/databayt/kun/issues/9) | 210d | unified git workflow + evidence layer (status/in-review, 210 d) |
| [kun#4](https://github.com/databayt/kun/issues/4) | 238d | test Windows install for 4 roles (238 d) |
| [marketing#47](https://github.com/databayt/marketing/issues/47) | 211d | report-issue site-wide (211 d) |
| [marketing#45](https://github.com/databayt/marketing/issues/45) | 212d | Next 16 LayoutProps typing (212 d) |
| [marketing#43](https://github.com/databayt/marketing/issues/43) | 212d | delete dead pricing scaffolding (212 d) |
| [marketing#41](https://github.com/databayt/marketing/issues/41) | 212d | delete dead wizard/branding scaffolding (212 d) |
| [marketing#39](https://github.com/databayt/marketing/issues/39) | 212d | lazy-load chatbot, RSC layout (212 d) |
| [marketing#37](https://github.com/databayt/marketing/issues/37) | 212d | consolidate i18n docs (212 d) |
| [marketing#35](https://github.com/databayt/marketing/issues/35) | 212d | tree hygiene (212 d) |
| [marketing#33](https://github.com/databayt/marketing/issues/33) | 212d | drop extra icon libraries (212 d) |
| [marketing#31](https://github.com/databayt/marketing/issues/31) | 212d | per-segment loading.tsx (212 d) |
| [marketing#29](https://github.com/databayt/marketing/issues/29) | 212d | strip console.* in prod (212 d) |
| [marketing#27](https://github.com/databayt/marketing/issues/27) | 212d | delete duplicate i18n middleware (212 d) |
| [marketing#25](https://github.com/databayt/marketing/issues/25) | 212d | RTL: physical Tailwind props (212 d) |
| [marketing#23](https://github.com/databayt/marketing/issues/23) | 212d | locale-aware date/currency (212 d) |
| [marketing#21](https://github.com/databayt/marketing/issues/21) | 212d | chatbot/mode-switcher translations (212 d) |
| [marketing#19](https://github.com/databayt/marketing/issues/19) | 212d | expert-modal translations (212 d) |
| [marketing#17](https://github.com/databayt/marketing/issues/17) | 212d | User.username → name drift (212 d) |
| [marketing#15](https://github.com/databayt/marketing/issues/15) | 212d | auth-form strings to dictionaries (212 d) |
| [marketing#13](https://github.com/databayt/marketing/issues/13) | 212d | dictionary type drift (212 d) |
| [marketing#11](https://github.com/databayt/marketing/issues/11) | 213d | strict-mode prep fixes (212 d) |
| [marketing#7](https://github.com/databayt/marketing/issues/7) | 213d | 404 page hardcodes English (213 d) |
| [mkan#52](https://github.com/databayt/mkan/issues/52) | 99d | restore disabled dialogs (99 d) |
| [mkan#17](https://github.com/databayt/mkan/issues/17) | 120d | Phase D polish/observability (209 d; still names Vercel) |
| [mkan#11](https://github.com/databayt/mkan/issues/11) | 120d | QA Homes & Transport A→Z (210 d) |
| [mkan#9](https://github.com/databayt/mkan/issues/9) | 120d | Phase C1 host publish + real reviews (210 d) |
| [mkan#7](https://github.com/databayt/mkan/issues/7) | 120d | Phase B i18n/RTL sweep (211 d) |

### Leave to the bots

These are opened, rewritten and closed by scripts (job-health, domains, engine-decision, config-health, the textbook loop). Don't close them by hand: fix the job and they close themselves. [catalog#1](https://github.com/databayt/catalog/issues/1), [hogwarts#472](https://github.com/databayt/hogwarts/issues/472), [hogwarts#493](https://github.com/databayt/hogwarts/issues/493), [kun#133](https://github.com/databayt/kun/issues/133), [kun#161](https://github.com/databayt/kun/issues/161), [kun#163](https://github.com/databayt/kun/issues/163), [kun#164](https://github.com/databayt/kun/issues/164), [kun#165](https://github.com/databayt/kun/issues/165), [kun#166](https://github.com/databayt/kun/issues/166), [kun#169](https://github.com/databayt/kun/issues/169), [mkan#65](https://github.com/databayt/mkan/issues/65), [mkan#69](https://github.com/databayt/mkan/issues/69), [mkan#84](https://github.com/databayt/mkan/issues/84).

## 5. Gaps found while triaging (no issue exists)

- **android-app CI** has failed 3 runs in a row (latest 11-24, see `org-inventory.md` §6), and alabidae runs on the Android app (reports show `hogwarts-android/1.2.2`; APK 1.3.3 rolled out 11-22). No open issue tracks it.
- **hogwarts Playwright + keep-cache-warm** both failed on 11-24. #460 covers Playwright; keep-cache-warm (#461) warms Vercel, which no longer serves prod.
- **marketing**: 25 issues are a 212-day-old audit plan, never started. Three of them (#1, #3, #9) are still true in today's code. The other 22 could be one batched pass when there's time.
- **Three priority schemes inside kun**, and `scripts/issues/hygiene.sh --apply` already exists to fold `P*-high` into `priority/pN`, yet 22 open kun issues still carry `P1-high`/`P2-medium`/`P3-low`.
