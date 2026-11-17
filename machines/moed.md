# Moed's machine — Windows 11, own Claude Pro (audit of 15 lanes)

Audit date 2026-11-17. Report only: no skill was edited. Moed (business development, copywriting,
network; `team.json` id `moed`, installRole `business`) runs Claude Code on his own Windows 11
laptop (Git Bash + node), with his own Twenty API key and Gemini key. He has none of Abdout's
Mac Keychain, vault Chrome (:9222), WhatsApp Desktop DB, launchd jobs or credentials, and gets none.

Verdicts: **READY** works with his own keys · **PORTABLE** small named fixes · **MAC-ONLY** needs a
real port · **ABDOUT-ONLY** stays on Abdout's Mac; Moed reaches it only through the kun web UI.

## Table

| Skill | Lane | Verdict | Needs | Fixes (file:line) |
|---|---|---|---|---|
| scrape | sales | PORTABLE (OSM/website lane only) | node, tsx, `TWENTY_API_URL`+key, scrapling (uv) | set URL: `scripts/lib/twenty-rest.mjs:18`, `scripts/jobs/board.ts:14` default `localhost:3100` is Abdout's SSH tunnel; Keychain fallback `twenty-rest.mjs:27`, `board.ts:58` harmless if env key set |
| funnel | sales | ABDOUT-ONLY | hogwarts prod Postgres, Evolution WhatsApp sender, launchd | none (see notes) |
| proposal | sales | READY | kun clone, `analyst`/`revenue` agents | optional: `proposal/SKILL.md:15` names Ali as deliverer |
| pricing | sales | READY | kun clone, `.claude/agents/revenue.md`, `ops.md` | none |
| draft | marketing | PORTABLE (hand-run); queue mode ABDOUT-ONLY | kun clone, `copy.mdx` | `scripts/social-drafts.mjs:64-68` exits if `DATABASE_URL` unset, even for `check`; make DB lazy |
| calendar | marketing | PORTABLE | kun clone; Hub `/social/calendar` | step 3 `calendar/SKILL.md:60-62` reads `SocialPiece` from prod DB; use the Hub instead |
| social | marketing | ABDOUT-ONLY (chain); Moed uses the Hub | all of draft/approve/publish | none |
| carousel | marketing | PORTABLE (render + stage) | kun clone, `pnpm dev` :3000, Chrome, node | `scripts/render-carousel.mjs:84` hard-codes `/Users/abdout/hogwarts`; `carousel/SKILL.md:72` cites `scripts/post-to-telegram.mjs`, which does not exist; publish steps ABDOUT-ONLY |
| measure | marketing | ABDOUT-ONLY | `CRON_SECRET`, prod SQL, PostHog MCP, Meta token | none; Moed reads `/social/measure` |
| approve | marketing | PORTABLE (it is a web click) | Hub login | Moed is not in the login allowlist: `src/components/root/context/contributors.server.ts:25-30` |
| publish | marketing | ABDOUT-ONLY | Facebook Page token, cron drain | none; Moed's part is the Approve click and the WhatsApp copy-out block (`publish/SKILL.md:55-63`) |
| edit | video | MAC-ONLY (partial route exists) | ffmpeg-full, mlx-whisper, mlx-audio, FilmCraft.app, brew | see Edit notes |
| shoot | video | PORTABLE (stills, demo tenant) | node, playwright-core, `~/hogwarts` clone | `edit/scripts/lib.sh:4`, `media/rt.mjs:27` brew path; skip derive with `--no-derive` (`shoot.mjs:84`); `--publish` is ABDOUT-ONLY |
| record | video | MAC-ONLY + ABDOUT-ONLY | `screencapture`, `osascript`, Outlook, vault Chrome, Drive | `scripts/record.sh:42,83,112,122-129,407-411` |
| higgs | video | PORTABLE (Google direct, his key) | node, `GEMINI_API_KEY` | rungs ½/library push are Abdout's; see notes |

## Per-skill notes

**scrape.** Moed's lane is `pnpm sales:leads discover|audit|gap|push` (Overpass + HTTP audit +
Twenty REST; `SKILL.md` §0 "databayt") and the `website` mode via `scrapling` (`SKILL.md:197-206`,
Python via `uv`, works on Windows). Set `TWENTY_API_URL=https://crm-api.databayt.org` and
`TWENTY_API_KEY_DATABAYT=<his key>` (`twenty-rest.mjs:24`); never the Keychain examples at
`SKILL.md:58-59`. `facebook`, `whatsapp`, `tiktok`, `facebook for mkan` are ABDOUT-ONLY: they need the
hogwarts/mkan repos, the dedicated scrape account on a CDP port (`SKILL.md:108-166`, `scrape-guard.sh`
blocks without `FB_SCRAPE_PROFILE`), `caffeinate` (`:222`), the Keychain `mkan-ANTHROPIC_API_KEY` (`:237`)
and the Evolution sender (`:178`). `hooks/scrape-guard.sh:55` needs `jq` (falls back to raw scan) and
`:126` uses `ps -axo` (empty on Git Bash); both only matter for FB/IG scrapes, so the hook stays inert
for his lane. `.claude/skills/scrape` also expects `contact-gap.json` from the product repo (`SKILL.md:15`).

**funnel.** Gate state is hogwarts production Postgres (`funnel/SKILL.md`, "source of truth"); the
roll scripts live in `hogwarts/scripts/funnel/`; the clock is launchd (`:49`, `:177`); Keychain key at
`:88`; WhatsApp via Evolution. Moed can still work the Twenty Kanban on sales.databayt.org by hand
(drag a card, add a note) and write follow-up copy to paste; the skill itself should not be exposed.

**proposal / pricing.** Pure prompt skills over repo files (`.claude/agents/revenue.md`,
`ops.md`, `memory/team.json`). Note `ops.md` carries company cost tracking; he is the business role,
so acceptable, but Abdout should decide. No binaries, no keys.

**draft.** Steps 1-10 (brand, voice docs, three angles, UTM, moral gate) are prompt + repo files and
work anywhere. The mechanical craft gate is `node scripts/social-drafts.mjs check --ar f --en f`
(`social-drafts.mjs` header), but `:64-68` aborts without `DATABASE_URL` (Abdout's prod Neon: never
give it to Moed). Fix: read the URL lazily so `check` runs offline. Queue mode (`answer`/`attach`/`fail`/
`lessons`) is ABDOUT-ONLY, drained by launchd (`drain-drafts.sh:118`, `seed-drafts.sh:101`). Moed's loop:
write copy locally, run `check`, paste into the Hub composer; or file an ask in the Hub and let Abdout's
drain answer it. The `google-free` lane (`social-drafts.mjs:~609`, `GEMINI_API_KEY`) still needs the DB.

**calendar.** Steps 1-2 and 4-6 are read-and-plan over `content/docs/social/*.mdx`,
`content/social/pillars.json`, `plan.ts`. Step 3 (diff vs shipped) is a DB read: replace with the Hub
page `/social/calendar`. Its **Queue now** button files a brief as a draft ask.

**social.** Compound orchestrator over every stage incl. DB, drain and Facebook; no Windows-safe slice
beyond calendar + draft + the Hub. Do not expose; teach him the Hub path instead.

**carousel.** Deck JSON + `pnpm carousel:render <brand>/<slug>` (`render-carousel.mjs:159` launches
system Chrome via playwright-core, works on Windows) needs a kun clone, `pnpm install`, `pnpm dev` on
3000 (fonts auto-fetched by `scripts/fetch-thmanyah.mjs`, predev) and Chrome. Output goes to
`~/Downloads/carousels` (`:73`, fine). Stage-and-stop is the right mode for him: `post-to-facebook.mjs`
needs `FACEBOOK_PAGE_ACCESS_TOKEN_<BRAND>` (Abdout's, `:225`), and `higgs-library.mjs push` shells out to
`aws s3 cp` into Abdout's bucket (`:336`). Verify the render route does not need `DATABASE_URL`.

**measure.** `curl -H "Authorization: Bearer $CRON_SECRET" $SITE_URL/api/social/metrics`
(`SKILL.md:33`), SQL re-arm (`:60s`), PostHog MCP, Meta scopes. All prod secrets. Read-only view:
`/social/measure`.

**approve / publish.** The lanes are web actions (`/social/publish` queue: edit, Approve, Dismiss;
signed 12-hour links). Delivery is server-side (`/api/social/drain`, HMAC and bearer routes in
`src/app/api/social/*`), so nothing runs on his laptop. Blocker: Moed cannot sign in (see below).

**edit.** Mac-bound pieces: `lib.sh:4` and `media/rt.mjs:27`, `fc/assemble.mjs:160` (`/opt/homebrew`),
`lib.sh:17` and `media.sh:153,166` (`df -g`: GNU df lacks it, so `disk_guard` yields 0 GiB and
`vu.sh:12`, `hf.sh:10`, `reel.sh:19` refuse to render, exit 3), `media.sh:135` (`stat -f%z`),
`lib.sh:33`, `media/voice.mjs:29-30`, `rt.mjs:14` (`~/Library/...`), `setup.sh:10-16` (brew, mlx-whisper,
mlx-audio, Apple Silicon only), `filmcraft.sh` (macOS dmg, Keychain token), `media/wa-pull.py:31`
(WhatsApp DB, ABDOUT-ONLY), `media/publish.mjs:50` (aws, Abdout's `databayt-cdn`). Usable on Windows
with fixes: HyperFrames via `hf.sh` (node, ffmpeg, Chrome; fix `df -g`), and video-use cuts through
`vu.sh` if he exports `VIDEO_USE_ASR=scribe` plus his own `ELEVENLABS_API_KEY` (upstream Scribe path,
patch line 9-11) because `vu.sh:14` defaults to Apple-only mlx-whisper. Captions need Thmanyah Sans
installed in Windows fonts (`lib.sh:12`, licensed local use only). A real Windows port is its own task.

**shoot.** `shoot.mjs` is headless playwright against `https://demo.balqalam.com`, whose role picker
is password-less (`SKILL.md:125-129`): no Abdout identity. Needs the hogwarts repo cloned at
`~/hogwarts` (`shoot.mjs:86`, commit stamp at `:285`; private repo access is Abdout's call) and the media
runtime from `setup.sh:18` (sharp + playwright-core, installed by pnpm, not brew). `record.sh stale`
(`shoot.mjs:262`) only matters for `--stale`. Frame is Abdout's MacBook (`shoot.mjs:97`), cosmetic.
`--publish`, `--video`, `--support` call `media.sh publish` (aws) and voice (mlx): leave off.

**record.** `screencapture` (`record.sh:83,112`), `osascript` (`:122,286,407-411`), Outlook OTP
(`:123`), Chrome bounds (`:407`), Drive of Abdout's Google account (`:42`), vault Chrome :9222
(`record/SKILL.md:70-72`). Nothing portable and most of it is his identity. Moed records with OBS and
hands the file to `/edit`.

**higgs.** Rung 0 `higgs-library.mjs lookup` (local `content/media/library.json`) and rung Google direct
`node scripts/gemini-media.mjs image|video|omni` (`:145` reads `GEMINI_API_KEY`, falls back to kun
`.env`; output `~/Downloads/gemini`, Windows-safe). It spends his key: the script prints an estimate and
requires `--yes` (`:257`). Rungs ½ and Antigravity are Abdout's Google seat/CDP vault
(`gemini-web.mjs:8,34`, `agy-image.mjs`) and the Higgsfield workspace is Abdout's credits: not for Moed
unless he runs his own `higgsfield auth login`. `higgs-library.mjs add` is fine locally; `push` is not (`:336`).
Use `~/` paths from Git Bash; the `SKILL.md` examples assume zsh.

## Kun web surfaces for Moed

| Surface | Use | Login |
|---|---|---|
| kun.databayt.org/en/social (`calendar`, `draft`, `media`, `publish`, `measure`) | plan, file asks, review queue, approve, numbers | Credentials login, **allowlist only**: abdout, ali, samia, sedon (`contributors.server.ts:25-30`). Moed has none yet. |
| sales.databayt.org (Twenty UI) | leads, Website Leads kanban, stages | needs a Twenty member seat |
| /docs, /machine, /seek | read-only docs | public / per page |

Proxy and layout gate `/social/*` in production (`src/proxy.ts`, `social/layout.tsx`); bearer/HMAC
`/api/social/*` routes are not his.

## Day-one set (expose in Moed's menu now)

1. **proposal**, **pricing** — READY, no setup.
2. **scrape** (website + `sales:leads` modes only, with his Twenty key).
3. **calendar** (read plan; Hub for state), **draft** (hand-run; paste into Hub after the `social-drafts.mjs` fix).
4. **higgs** (Google direct, his Gemini key, spend gate on).
5. **carousel** (render and stage only).
6. **shoot** (stills on demo tenant, `--no-derive`).
7. Doctrine only (no execution): **approve**, **publish** WhatsApp copy-out. Web actions once he has a login.

Hide: funnel, social, measure, record, edit (until ported).

## Credentials Moed needs, each issued as HIS own

| Credential | Used by | How to issue |
|---|---|---|
| Claude Pro login | everything | `claude` then `/login` on his laptop; his plan, not Abdout's Max |
| Twenty API key | scrape, funnel (read) | sales.databayt.org: Abdout invites `moed@databayt.org` as a member with a limited role; Moed opens Settings > APIs & Webhooks > Create API key (bound to his role, revocable); set `TWENTY_API_KEY_DATABAYT`, and `TWENTY_API_URL=https://crm-api.databayt.org` |
| Gemini API key | higgs | his own at aistudio.google.com/apikey; `GEMINI_API_KEY` in his kun `.env` (trim trailing newline) |
| kun contributor login | approve, Hub | Abdout adds `moed` to `contributors-public.ts` (role union at `:19` lacks `business`) and `CONTRIBUTOR_EMAILS` (`contributors.server.ts:25`); Moed runs `node scripts/hash-password.mjs` and Abdout sets `AUTH_PASSWORD_HASH_MOED` (`auth.config.ts:15`) in prod env; redeploy kun |
| GitHub access | clone kun (and hogwarts for shoot) | his own GitHub account, invited to the repos he needs |
| ElevenLabs key (optional) | edit via video-use on Windows | his own, `ELEVENLABS_API_KEY` |
| Higgsfield (optional) | higgs | `higgsfield auth login` with his own account and credits |

Never give Moed: `DATABASE_URL`, `CRON_SECRET`, Facebook Page tokens, AWS credentials, the Keychain
Twenty key, vault Chrome access, the Antigravity/Gemini-app seat, Evolution/WhatsApp.
