---
name: produce
description: The video factory — one engine, three lines (hogwarts, mkan, databayt), 14 stages from request to Facebook
when_to_use: "Use when a whole video must be produced end to end for a brand — a request becomes a project, a script, a storyboard, assets, an edit, QA, an approved master on the CDN and a publish-ready package. It chains /draft, /record, /shoot, /higgs, /blender, /carousel, /edit, /approve, /publish and /facebook and re-implements none of them; for one stage run that skill directly. Triggers on: produce, video production, production request, make a video for hogwarts, make a video for mkan, make a video for databayt, إنتاج فيديو, فيديو تعريفي."
argument-hint: "<brand> <category> <subject> [--lang ar,en] | status <ID> | ship <ID>"
lane: build
effort: medium
---

# Produce — the video factory

One shared engine, three production lines: **hogwarts** (product explainers and tutorials, real UI),
**mkan** (marketplace intro, property storytelling), **databayt** (company, people, engineering).
`scripts/produce.mjs` is the ledger — project folder, stage record, gates, CDN keys. The work of each
stage belongs to an existing skill (table below). Blueprint: `~/.claude/playwright-output/chatgpt-share.md`
(§6 stages, §10 CDN + naming, §11 structure, §12 standards, §16 gates, §19 pilots).

```bash
P="node ~/.claude/skills/produce/scripts/produce.mjs"
$P init --brand hogwarts --category intro --subject introduction --lang ar,en   # → hogwarts-intro-introduction-v001
$P issue <ID> [--create|--sync] # the FILM issue (tracker): draft without a flag, create once, then rewrite from state
$P order <ID> <formula> --to <login> [--set k=v]… [--after refs] [--create]   # a WORK ORDER for one person
$P submit <issue-ref> <file>… [--summary …] [--next …] [--create]            # upload deliverables + receipt, status:review
$P init … --markets sa,ae,eg,sd --slug intro   # market x language versions (content/media/markets.json)
$P set <ID> identity balqalam   # change the on-film identity of an existing project
$P set <ID> slug intro          # | set <ID> markets sa,ae,eg,sd
$P status <ID>                  # shared stages, then a variant x per-variant-stage grid + predicted URLs
$P advance <ID> <stage> --file <deliverable> [--verdict pass|fail] [--variant sa-ar]
$P approve <ID> --version V001 --by <login> [--gate script|look|version|publish] [--variant sa-ar|--all] [--destination facebook] [--issue databayt/x#n]
$P url <ID> [--variant sa-ar]   # predicted CDN URLs, before anything renders
$P build <ID> --variant sa-ar|--all [--dry-run]   # piece.mjs -> assemble.mjs per variant; unchanged inputs are skipped
$P ship <ID> [--variant v|--all] --dry-run        # CDN keys + plan; real run only after the version approval
$P index                        # rebuild the local video index
$P readiness [--fix] [--json]   # ffmpeg, blender, filmcraft-cli, mlx_whisper, uv, Playwright browsers, disk >= 15 GB, power, Kun.app, MCPs, GEMINI key; exit 1 if a critical row fails (--fix installs webkit + chromium)
$P init … --from-reference clip.mp4   # | from-reference <ID> clip.mp4: copy to 02-research/reference/, whisper transcript.srt, contact.png, seed 03-script/script.md; research = "seeded"
$P from-reference <ID> clip.mp4 --voiceover [--variant sd-ar|--all]   # + the video's audio as 48 kHz mono wav in 07-audio/voiceover/<variant>.wav; recorded in project.json voice.<variant>
$P status <ID> --json           # stage_list, variants grid, gates, next, urls, paths (shot-list, asset-manifest), voice: what the Kun app's production strip reads
$P list --json [--repo hogwarts]   # every project with next stage, focus, variants
```

**Focus** — `project.json → focus` (e.g. `["sd-ar"]`) is the build order: Machine's starter and `build` work those versions first.

## The 14 stages

Deliverables live in `~/media/_projects/<ID>/` (never inside a repo). Run `advance` after each stage.

| #   | Stage      | Deliverable                                                                                           | Done by                                                                                                                                            | Gate                                                                           |
| --- | ---------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 01  | request    | `01-brief/request.json`                                                                               | `produce init` (infers brand defaults, asks only what is missing)                                                                                  | —                                                                              |
| 02  | research   | `02-research/product-research.md`                                                                     | read the product docs + `content/docs/*`, `/codebase`; split verified functionality from assumptions                                               | facts verified                                                                 |
| 03  | brief      | `01-brief/creative-brief.md`                                                                          | `/draft` voice doctrine (`content/docs/brand.mdx`); audience, message, tone, duration, formats                                                     | —                                                                              |
| 04  | script     | `03-script/script.md`, `voiceover.md`                                                                 | `/draft` (Arabic first, English mirrored)                                                                                                          | **script sign-off (light)**: `approve --gate script` before any heavy stage    |
| 05  | storyboard | `04-storyboard/shot-list.json`                                                                        | agent writes it; `advance` validates `schema/shot-list.schema.json` + the hard rules                                                               | schema valid                                                                   |
| 06  | assets     | `05-assets/asset-manifest.json`                                                                       | reuse first: `~/media/<repo>/` and the CDN; else `/shoot`, `/record`, `/higgs`, `/blender`, `/carousel` (cards), `shoot/flows/hogwarts/*.mjs`      | reuse before generate                                                          |
| 07  | visual     | `06-production/visual-manifest.json`                                                                  | `/record` (real UI, flows), `/blender` (3D), `/higgs` (AI clips and stills, illustrative only), `edit/scripts/hf.sh` (HyperFrames motion graphics) | script signed                                                                  |
| 08  | audio      | `07-audio/audio-package.json`                                                                         | `edit/scripts/media/voice.mjs` (consent-gated Arabic narration), `lyria.py` (music bed), `media.sh` loudness (−14 social / −16 web LUFS)           | script signed                                                                  |
| 09  | edit       | `06-production/editing/edit-project.json`                                                             | `/edit` — `edit/scripts/media.sh`, `reel.sh`, `fc/assemble.mjs` (FilmCraft), `vtt.mjs` captions, `brand.mjs --css/--ass` for brand                 | script signed                                                                  |
| 10  | render     | `08-render/masters/master.mp4` + `delivery/{fb-16x9,fb-9x16,fb-1x1}.mp4`, `{lang}.vtt`, `poster.webp` | `media.sh encode`, `media.sh poster`, `vtt.mjs`                                                                                                    | script signed                                                                  |
| 11  | qa         | `09-quality/qa-report.md`                                                                             | `media.sh qa-pack` (`qa.mjs`, `probe.mjs`) then the `media-qa` agent (Arabic shaping, RTL, brand, PII, safe areas, claims vs product)              | **qa must pass**: `advance … --verdict pass`                                   |
| 12  | approval   | approval record in `project.json`                                                                     | human: `approve --version Vnnn --by <login>` (per exact version, master sha pinned); `/approve` for the review queue                               | **exact-version approval**                                                     |
| 13  | cdn        | `10-publishing/manifest.json`, CDN keys                                                               | `produce ship` → `edit/scripts/media/publish.mjs` (mp4) + wrapper (vtt/webp/json)                                                                  | refuses without approval                                                       |
| 14  | publish    | `10-publishing/{caption.md,publishing-record.md}`                                                     | `/publish` + `/facebook` + `/social`                                                                                                               | **separate publish approval**: `approve --gate publish --destination facebook` |

## Markets and versions

`--markets sa,ae,eg,sd` (ids from `content/media/markets.json`: currency, on-screen price, symbol, voice dialect) turns a
project into **variants** `<market>-<lang>` (`sa-ar`, `eg-en`). Stages 01–07 (request … visual) are **shared**, done once.
Stages audio, edit, render, qa, approval, cdn, publish are **per variant**, stored in `project.json → variantStages[<variant>]`;
`advance` takes `--variant` for them and errors with the list on a multi-variant project without it. `build` runs
`piece.mjs` (writes `03-script/variants/<v>.json` + `06-production/editing/<v>.video.json`) then `assemble.mjs --deliver`
into `08-render/<v>/fb-9x16.mp4`, skipping a variant whose input hash is unchanged. `approve --variant|--all` pins each
variant's master sha; `ship` uploads the `_v/<Vnnn>/` archive, then the stable keys, then a merged `manifest.json`.
Projects without markets keep the old single-line flow.

## Human gates (three, never merged)

1. **Script sign-off** — light, before expensive stages (visual, audio, edit, render refuse without it unless `--force`).
2. **Exact-version approval** — attached to one `Vnnn` and the sha of its master. A re-render changes the sha, drops the qa stage and voids the approval. `approve` refuses if qa has not passed; `ship` refuses without it.
3. **Publish approval** — a separate yes naming the destination. Approving a version is not approving a post.

## Hard rules

- **Real product UI only for product claims.** A scene that states what the product does is `source.type: capture` (a `/record` or `/shoot` flow). `productClaim:true` on any other source fails `advance storyboard`.
- **Generated property scenes are illustrative** (`/higgs`, `/blender`): they set `illustrative:true`, are listed in the manifest, and the video says so. Never a generated "screenshot" of the app.
- **No publish without approve.** No agent publishes because it believes the video is done.
- No invented metric, customer, price or date in script or caption; brand TODO fields are never guessed (renderers refuse a draft brand).
- Thmanyah fonts stay local (`~/Library/Fonts`); never commit or rehost.
- Free and local by default (`engine.json → media`); log any spend with `produce cost`.

## One film issue and its work orders

The film has **one tracker issue**; every piece a person does is **its own work order**. Nothing is written to GitHub
without `--create` (draft output otherwise); `gh` missing means a clear message from the command that needed it.

| Command | What it does |
| --- | --- |
| `issue <ID>` | prints the draft film issue: brief, versions with predicted CDN URLs, the 14 stages ticked from state, the four gates (script · look · version · publish), `## Work orders`, last line `<!-- kun: repos=<repo>; items=skill:produce; film=<ID> -->`. Labels `dept:video`, `P2`, `film` |
| `issue <ID> --create` | creates it once and stores `issue` in project.json; if it exists, `--create` and `--sync` rewrite the body from current state |
| `order <ID> <formula> --to <login> [--set k=v] [--after refs]` | draft of a work order: `station.mjs fill` writes the body (refuses on missing slots or a formula whose `record` is not `issue`), prints title, labels and the reference files it would upload |
| `order … --create` | uploads local references to the CDN, creates the issue in the film issue's repo with labels `dept:video`, `P2`, `for:<login>` and the block `<!-- kun: repos=…; items=…; after=…; film=<ID>; formula=<id>; weight=<n> -->`, adds its line to the film issue, records it in `orders` |
| `submit <issue-ref> <file>…` | for a machine with CDN keys: uploads to `work/<film>/<issue>/<file>`, comments the run receipt (same layout the API writes: artifact URLs, sha256, formula, stage, next) and sets `status:review`; draft without `--create` |
| `advance`, `approve` | with an issue on the project they tick the film issue and comment (`advance: <stage> · <deliverable> · sha · by`, `approved: <gate> · <version> · by <login>`); a GitHub failure only warns |
| `status <ID> [--json]` | adds Contributors (who · what · when, from orders, stage records and approvals); JSON carries `issue` and `orders` |

A work order's issue body **is** the filled formula; references are links, never local paths. Only the CEO closes an
issue; the film issue closes after publish. Tests: `node --test scripts/produce.test.mjs` (`PRODUCE_STUB_DIR` stubs gh, the uploader and station).

## Lock the plan (`00-plan/`)

A **spec** is one stage's decisions written down, a **lock** is a spec recorded in `project.json → locks`, the **plan** is all 14 compiled in order.
Decisions of a stage = `settings.json` default ← `plan.picks` ← `plan.stages` ← `--set` ← `--spec`. Local writes only, safe to repeat, no `--create`.

| Command | What it does |
| --- | --- |
| `lock <ID> --all [--plan <file>] [--set k=v]…` | writes `00-plan/<NN>-<stage>.spec.{json,md}` for all 14 stages, locks them, recompiles `plan.json` + `plan.md`; the `--plan` file is kept as `plan.input.json` |
| `lock <ID> <stage> [--set k=v]… [--spec <file>]` | one stage; a `--set` key the stage does not own is an error; `--spec` is the `kun-spec` block and its `stage` must match; add `--by`, `--no-sync` (skip the film-issue rewrite), `--json` |
| `unlock <ID> <stage>` / `plan <ID> [--json]` | drop one lock (specs stay) / recompile the plan |
| `advance <ID> visual\|audio\|edit\|render …` | refused without a lock (after the script gate) unless `--force` |
| `url <ID> --path <rel>` | the CDN URL of a film file: `~/media/_projects/<ID>/<rel>` = `work/<ID>/ref/<rel>` |
| `mirror <ID> [--stage <s>] [--create]` | uploads the stage folder(s) and `00-plan/` under that rule plus an `index.json` per folder; draft without `--create`; never `08-render/**`, fonts or files over 50 MB (each listed with its reason) |

`status --json` adds `locks`, `plan` and, per stage, `dir`, `spec`, `spec_url`, `file_url`, `locked`; the film issue shows `locked by <login>` or `open` per stage and a `## Plan` section.

## Identity

**brand** = the production line, by its full name (hogwarts / mkan / databayt — never a code; CDN `video/<brand>/`). **identity** = the brand-kit
face that appears on film — name, wordmark, colors. It defaults to the brand; set `init --identity balqalam` (or
`set <ID> identity balqalam`) to make a hogwarts-line production under Balqalam, e.g. the intro film for school
owners. `brand.mjs`, captions and the end card read `brand-kit[identity]`; a `balqalam` piece never carries the
Hogwarts wordmark, a `hogwarts` piece never says بالقلم. `init` also takes `--audience` and `--objective`.

## Brands

`content/media/brand-kit.json → production.<brand>` (read by `edit/scripts/media/brand.mjs`): logo, fonts,
colors, `produce.{direction,voiceNote,subtitle,lowerThird,intro,outro}`. Unknowns are `TODO`
(lower-third, intro, outro, approved examples) — fill them with the team, do not invent.

## CDN (`content/docs/cdn.mdx`, `media.mdx`)

Variant projects (stable slug, URL known before the render, e.g. `https://cdn.databayt.org/video/hogwarts/intro/sa-ar/fb-9x16.mp4`):

```
video/<cdn>/<slug>/<variant>/{fb-9x16.mp4, poster.webp, <lang>.vtt}   stable — overwritten on re-approval, invalidated
video/<cdn>/<slug>/manifest.json                                       every shipped variant (max-age 60)
video/<cdn>/<slug>/_v/<Vnnn>/<variant>/…                               immutable archive per version
```

`ship` refuses when another film (different category/subject) already owns the brand+slug. Legacy projects:

```
video/<brand>/<ID>/{master.mp4, fb-16x9.mp4, fb-9x16.mp4, fb-1x1.mp4, <lang>.vtt, poster.webp, manifest.json}
video/index.json     product · feature · version · approved · current · urls   (approved videos only)
```

`<ns>/<lang>/<flow>/video.mp4` tutorial keys are a different tier and stay as `/record` + `/shoot` publish them.
Run `ship --dry-run` first; the real run uploads, verifies and invalidates.

## Pilots (blueprint §19)

hogwarts — product feature explainer (real capture) · mkan — marketplace introduction (illustrative property scenes) ·
databayt — company introduction (real people). Compare the three afterwards: what was shared, what was brand-specific.

## Schemas

`schema/project.schema.json`, `schema/shot-list.schema.json`; `produce validate <file>` checks either.
