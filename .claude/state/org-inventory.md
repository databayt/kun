# Org inventory — read-only snapshot
Generated 2026-11-24 ~11:30 (+02:00) by a headless Claude run for Abdout (Slack). No edits, commits or mutations were made except this file. Ambiguous items are marked **needs-human**.

## 1. Local git repos (depth 3 under /Users/abdout, skipping Library, node_modules)

38 repos found. "Registry" = the registry has an entry whose url matches this origin (after redirects: abdout/X → databayt/X where GitHub redirects). "Registry claims" = the entry's `local` path.

| Path | Origin | Branch | Last commit | Dirty | In registry | Registry claims | Path ok? |
|---|---|---|---|---|---|---|---|
| ~/.cache/android-133 | (none) | main | 2026-11-22 | 82 | no |  |  |
| ~/.hermes/hermes-agent | gh:NousResearch/hermes-agent.git | main | 2026-07-10 | 2 | no |  |  |
| ~/acme | gh:abdout/co.git | main | 2026-03-31 | 25 | no |  |  |
| ~/almersal | gh:abdout/almersal.git | main | 2026-09-20 | 1 | no |  |  |
| ~/android-app | gh:databayt/android-app.git | main | 2026-11-24 | 72 | android-app | ~/oss/android-app | NO — real path is /Users/abdout/android-app |
| ~/apple | gh:databayt/apple.git | main | 2026-09-20 | 146 | apple | ~/apple | yes |
| ~/catalog | gh:databayt/catalog.git | main | 2026-10-27 | 0 | catalog | ~/catalog | yes |
| ~/co | gh:databayt/co.git | main | 2026-09-22 | 0 | no |  |  |
| ~/codebase | gh:databayt/codebase.git | main | 2026-11-14 | 16 | codebase | ~/codebase | yes |
| ~/farm | gh:databayt/farm.git | main | 2026-11-16 | 9 | farm | ~/farm | yes |
| ~/food | gh:databayt/food.git | main | 2026-11-14 | 16 | food | ~/food | yes |
| ~/gocart | gh:databayt/gocart.git | main | 2026-09-21 | 1 | no |  |  |
| ~/heirs | gh:abdout/heirs.git | main | 2026-05-16 | 0 | no |  |  |
| ~/hogwarts | gh:databayt/hogwarts | main | 2026-11-24 | 5 | hogwarts | ~/oss/hogwarts | NO — real path is /Users/abdout/hogwarts |
| ~/ios-app | gh:databayt/ios-app.git | main | 2026-11-15 | 0 | ios-app | ~/oss/ios-app | NO — real path is /Users/abdout/ios-app |
| ~/kun | gh:databayt/kun.git | main | 2026-11-24 | 52 | kun | ~/kun | yes |
| ~/lab | (none) | main | 2026-06-03 | 2 | no |  |  |
| ~/leader | gh:databayt/leader.git | main | 2026-11-14 | 3 | leader | ~/leader | yes |
| ~/loreal | (none) | main | 2026-10-10 | 0 | no |  |  |
| ~/machine | gh:databayt/machine.git | main | 2026-11-24 | 0 | machine | ~/machine | yes |
| ~/maid | gh:abdout/maid.git | main | 2026-09-22 | 12 | no |  |  |
| ~/marketing | gh:databayt/marketing.git | main | 2026-11-17 | 2 | marketing | ~/oss/marketing | NO — real path is /Users/abdout/marketing |
| ~/mazin | gh:abdout/mazin.git | main | 2026-09-22 | 0 | no |  |  |
| ~/mkan | gh:databayt/mkan.git | main | 2026-11-22 | 8 | mkan | ~/oss/mkan | NO — real path is /Users/abdout/mkan |
| ~/nike | gh:databayt/nike.git | local | 2026-10-17 | 1 | no |  |  |
| ~/nmbd | gh:abdout/nmbd.git | main | 2025-12-21 | 989 | no |  |  |
| ~/noor | (none) | main | 2026-10-08 | 0 | no |  |  |
| ~/oss/shadcn-ui | gh:shadcn-ui/ui | main | 2026-10-10 | 0 | no |  |  |
| ~/oss/video-use | gh:browser-use/video-use.git | main | 2026-09-23 | 5 | no |  |  |
| ~/shifa | gh:databayt/shifa.git | main | 2026-11-14 | 5 | shifa | ~/oss/shifa | NO — real path is /Users/abdout/shifa |
| ~/souq | gh:abdout/wathba | main | 2025-12-21 | 7 | souq (origin is abdout/wathba — needs-human) | ~/oss/souq | NO — real path is /Users/abdout/souq |
| ~/space | gh:databayt/space.git | main | 2026-11-22 | 1 | space | ~/space | yes |
| ~/spma | gh:databayt/spma.git | main | 2026-02-23 | 30 | spma | ~/oss/spma | NO — real path is /Users/abdout/spma |
| ~/thmanyah | (none) | main | 2026-09-22 | 0 | no |  |  |
| ~/topmate | gh:abdout/topmate.git | main | 2026-09-20 | 53 | no |  |  |
| ~/twenty | gh:databayt/twenty.git | databayt | 2026-11-14 | 28 | no |  |  |
| ~/zenda | gh:abdout/zenda.git | main | 2026-09-20 | 60 | no |  |  |
| ~/ziara | gh:databayt/ziara.git | main | 2026-10-03 | 0 | no |  |  |

Notes: `~/.cache/android-133` is a cache dir with a .git and no remote (ignore). `~/oss/` only holds shadcn-ui (upstream shadcn-ui/ui) and video-use (browser-use/video-use). `~/nike` is on branch `local`, not main. `~/twenty` is on branch `databayt`. `~/nmbd` has 989 dirty files, `~/apple` 146, `~/android-app` 72, `~/zenda` 60, `~/topmate` 53, `~/kun` 52 (mostly untracked screenshots).

## 2. Registry vs disk (~/.claude/memory/repositories.json, lastUpdated 2026-11-17, sync.lastFullSync = null)

24 entries (core 6, products 6, specialized 8, sites 4). 22 have a `local` field; sijillee and moallimee have no url/local. `~/kun/.claude/memory/repositories.json` is byte-identical to the global copy.

| id | group | registry `local` | exists? | real checkout |
|---|---|---|---|---|
| codebase | core | ~/codebase | yes |  |
| shadcn | core | ~/oss/shadcn | **NO** | none (~/oss/shadcn-ui is upstream shadcn-ui/ui, not databayt/shadcn) |
| radix | core | ~/oss/radix | **NO** | none |
| kun | core | ~/kun | yes |  |
| catalog | core | ~/catalog | yes |  |
| machine | core | ~/machine | yes |  |
| hogwarts | products | ~/oss/hogwarts | **NO** | ~/hogwarts |
| souq | products | ~/oss/souq | **NO** | ~/souq (origin abdout/wathba → databayt/wathba; org also has databayt/souq — needs-human) |
| mkan | products | ~/oss/mkan | **NO** | ~/mkan |
| shifa | products | ~/oss/shifa | **NO** | ~/shifa |
| sijillee | products | (none) | n/a | n/a |
| moallimee | products | (none) | n/a | n/a |
| ios-app | specialized | ~/oss/ios-app | **NO** | ~/ios-app |
| android-app | specialized | ~/oss/android-app | **NO** | ~/android-app |
| crm | specialized | ~/oss/crm | **NO** | none |
| distributed-computer | specialized | ~/oss/distributed-computer | **NO** | none |
| marketing | specialized | ~/oss/marketing | **NO** | ~/marketing |
| apple | specialized | ~/apple | yes |  |
| lab | specialized | ~/oss/lab | **NO** | ~/lab (no remote — needs-human) |
| spma | specialized | ~/oss/spma | **NO** | ~/spma |
| space | sites | ~/space | yes |  |
| food | sites | ~/food | yes |  |
| farm | sites | ~/farm | yes |  |
| leader | sites | ~/leader | yes |  |

**Dead paths: 13**, all under /Users/abdout/oss/*: shadcn, radix, hogwarts, souq, mkan, shifa, ios-app, android-app, crm, distributed-computer, marketing, lab, spma.
Of those, 8 exist elsewhere at ~/<name> (hogwarts, mkan, shifa, souq, ios-app, android-app, marketing, spma) plus lab (~/lab, no remote). 4 have no local checkout at all: shadcn, radix, crm, distributed-computer.

## 3. Unregistered local repos (have a remote, absent from registry)

| Path | Origin | Org / personal | README first line |
|---|---|---|---|
| ~/.hermes/hermes-agent | gh:NousResearch/hermes-agent.git | upstream third-party | <p align="center"> |
| ~/acme | gh:abdout/co.git | abdout → redirects to databayt/co | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs |
| ~/almersal | gh:abdout/almersal.git | abdout → redirects to databayt/almersal | (no README) |
| ~/co | gh:databayt/co.git | databayt org | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs |
| ~/gocart | gh:databayt/gocart.git | databayt org | <div align="center"> |
| ~/heirs | gh:abdout/heirs.git | abdout → redirects to databayt/heirs | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs |
| ~/maid | gh:abdout/maid.git | abdout → redirects to databayt/maid | # Maid UAE - Domestic Worker Hiring Platform |
| ~/mazin | gh:abdout/mazin.git | abdout personal | # Mazin |
| ~/nike | gh:databayt/nike.git | databayt org | <div align="center"> |
| ~/nmbd | gh:abdout/nmbd.git | abdout → redirects to databayt/nmbd | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs |
| ~/oss/shadcn-ui | gh:shadcn-ui/ui | upstream third-party | # shadcn/ui |
| ~/oss/video-use | gh:browser-use/video-use.git | upstream third-party | <p align="center"> |
| ~/topmate | gh:abdout/topmate.git | abdout → redirects to databayt/topmate | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs |
| ~/twenty | gh:databayt/twenty.git | databayt org | <p align="center"> |
| ~/zenda | gh:abdout/zenda.git | abdout → redirects to databayt/zenda | This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs |
| ~/ziara | gh:databayt/ziara.git | databayt org | # E-Commerce Shop - Next.js Application |

No remote and unregistered: ~/loreal ("loreal — essentiality-of-beauty.loreal.com, 1:1"), ~/noor ("Noor Natural — Digital Experience prototype"), ~/thmanyah (no README), ~/lab (registered, see §2), ~/.cache/android-133.
`~/mazin` is abdout/mazin (genuinely personal — not in org). `~/acme` has origin abdout/co → redirects to private databayt/co, same remote as ~/co (duplicate checkout of one repo; needs-human which to keep).
`~/oss/video-use` and `~/oss/shadcn-ui` are upstream clones (browser-use, shadcn-ui) and `~/.hermes/hermes-agent` is NousResearch — third-party, not org.

## 4. GitHub org databayt — 36 repos (`gh api orgs/databayt/repos --paginate`)

Local checkout = a local repo whose origin resolves to it.

| Repo | Vis | Lang | Pushed | Fork | Registry | Local checkout | Description |
|---|---|---|---|---|---|---|---|
| android-app | public | Kotlin | 2026-11-24 |  | yes | ~/android-app | Hogwarts Android App - Kotlin/Jetpack Compose school management platform |
| machine | public | Rust | 2026-11-24 |  | yes | ~/machine | Kun on every teammate's computer — the desktop gate to the shared Kun configuration (Tauri |
| hogwarts | public | TypeScript | 2026-11-24 |  | yes | ~/hogwarts | Educational automation streamlining operations for students, educators, and school leaders |
| kun | public | JavaScript | 2026-11-24 |  | yes | ~/kun | Remote AI Development Infrastructure - كن (Be!) |
| mkan | public | TypeScript | 2026-11-22 |  | yes | ~/mkan | Mkan - Rental marketplace application with Airbnb-inspired design |
| space | private | TypeScript | 2026-11-22 |  | yes | ~/space | Space (سبيس) — coworking space and business hub in Port Sudan. Arabic-first Next.js 16 pla |
| marketing | public | TypeScript | 2026-11-17 |  | yes | ~/marketing |  |
| farm | public | TypeScript | 2026-11-16 |  | yes | ~/farm | Feasibility study and plan for a technology-enabled integrated farm in Rwanda — rendered a |
| ios-app | public | Swift | 2026-11-15 |  | yes | ~/ios-app | Hogwarts iOS App - Swift/SwiftUI school management platform |
| codebase | public | TypeScript | 2026-11-14 |  | yes | ~/codebase |  |
| shifa | public | TypeScript | 2026-11-14 |  | yes | ~/shifa | Shifa - Medical platform |
| leader | private | TypeScript | 2026-11-14 |  | yes | ~/leader | Leader — garment manufacturer & exporter site (leader.databayt.org) |
| food | public | TypeScript | 2026-11-14 |  | yes | ~/food | Charles Burgers — mobile-first QR ordering for Kigali (SCAN → CHOOSE → ORDER). Live at bu. |
| twenty | public | TypeScript | 2026-11-14 | fork | no | ~/twenty | The open alternative to Salesforce, designed for AI. |
| catalog | public | TypeScript | 2026-10-26 |  | yes | ~/catalog | Open curriculum catalog — curricula, subjects, chapters, lessons, question banks and textb |
| nike | public | TypeScript | 2026-10-17 |  | no | ~/nike |  |
| ziara | public | TypeScript | 2026-10-03 |  | no | ~/ziara |  |
| maid | public | TypeScript | 2026-09-22 |  | no | ~/maid |  |
| nmbd | private | TypeScript | 2026-09-22 |  | no | ~/nmbd |  |
| co | private | TypeScript | 2026-09-22 |  | no | ~/acme, ~/co |  |
| gocart | public | JavaScript | 2026-09-21 | fork | no | ~/gocart | GoCart is a free and open-source multi-vendor e-commerce template built with Next.js and T |
| apple | public | TypeScript | 2026-09-20 |  | yes | ~/apple | Apple design reference — UI patterns and design language to follow |
| topmate | public | TypeScript | 2026-09-20 |  | no | ~/topmate | Topmate.io clone — Next.js 16 / React 19 / Tailwind v4 / shadcn-ui. Pixel-mirrored header  |
| zenda | public | TypeScript | 2026-09-20 |  | no | ~/zenda | Zenda website clone - School payment fintech app |
| almersal | public | TypeScript | 2026-09-20 |  | no | ~/almersal | Almersal Media Production - Arabic media company website with Next.js 16, React 19, Tailwi |
| crm-hub | private | TypeScript | 2026-08-14 |  | no | **NONE** |  |
| crm | public | TypeScript | 2026-06-09 |  | yes | **NONE** | Open-source CRM — a Twenty clone on the databayt stack. Arabic-first, multi-tenant, metada |
| lab | public |  | 2026-06-03 |  | yes | ~/lab (no remote) | Lab — engineering lab for autonomous / remotely-operated vehicles (air, land, sea). Report |
| heirs | private | TypeScript | 2026-05-16 |  | no | ~/heirs | Internal Arabic-only inheritance coordination tool for the six brothers in Port Sudan |
| shadcn | public | TypeScript | 2026-05-06 | fork | yes | **NONE** | A set of beautifully-designed, accessible components and a code distribution platform. Wor |
| .github | public |  | 2026-05-06 |  | no | **NONE** |  |
| souq | public | JavaScript | 2026-04-25 |  | yes | **NONE** | Alwathba Coop - Multi-vendor e-commerce platform |
| wathba | public | JavaScript | 2026-04-25 |  | no | ~/souq (origin abdout/wathba) |  |
| radix | public | TypeScript | 2026-04-01 | fork | yes | **NONE** | Radix Primitives is an open-source UI component library for building high-quality, accessi |
| spma | public | TypeScript | 2026-02-23 |  archived | yes | ~/spma |  |
| distributed-computer | public | Rust | 2025-12-17 |  | yes | **NONE** | Native Rust infrastructure for justice-based sharing economy - Hogwarts Coin (HWC) |

Org repos with no local checkout: crm-hub, crm, shadcn, .github, souq, radix, distributed-computer.
Registered but not in org (or differently named): sijillee, moallimee (no url). Org has `wathba` and `souq` both — registry only knows souq. Org-only and unregistered: nmbd, co, gocart, nike, ziara, wathba, maid, almersal, zenda, spma(registered), heirs, topmate, crm-hub, twenty, .github.
Registered org repos missing from org list: none.

## 5. Open issues + labels (limit 300; none hit the cap)

Issues disabled: shadcn, radix, gocart, twenty. Zero open: nmbd, co, .github, nike, ziara, wathba, codebase, distributed-computer, souq, maid, shifa, almersal, zenda, apple, spma, heirs, lab, crm, topmate, crm-hub, food, leader, farm, machine.

| Repo | Open | Label vocabulary (count) |
|---|---|---|
| hogwarts | 34 | report (14), needs-human (9), good first issue (7), enhancement (5), low-confidence (5), area: platform (4), job-health (3), P2 (3), documentation (3), stale (3), P1 (2), team (2), epic (1), bug (1), area: i18n (1), P0 (1), area: finance (1), qa (1) |
| ios-app | 5 | enhancement (1), epic (1) |
| marketing | 25 | bug (10), enhancement (8), documentation (5), request (1) |
| mkan | 12 | enhancement (7), job-health (3), bug (1) |
| kun | 62 | type:infra (13), P1-high (12), assign:abdout (11), priority/p1 (9), type/chore (7), priority/p2 (7), scope:captain (7), P2-medium (6), domains (5), status/triage (5), area: workflow (5), P3-low (4), scope:cross-repo (3), type/feat (3), type:docs (3), status/in-progress (2), epic (2), engine-decision (2), scope:business (2), assign:captain (2), bug (2), type/fix (2), enhancement (2), type:mcp (2), dept:video (1), P2 (1), film (1), status/ready (1), config-health (1), type:rule (1), scope:tech (1), type/refactor (1), documentation (1), status/in-review (1), type:agent (1) |
| android-app | 2 | enhancement (1), documentation (1) |
| catalog | 1 | (no labels) |
| space | 4 | report (4), needs-human (3), low-confidence (1) |

Inconsistency: kun alone mixes three priority schemes (`P1-high/P2-medium/P3-low`, `priority/p1/p2`, bare `P2`), two type schemes (`type:infra/docs/mcp/rule/agent` vs `type/chore/feat/fix/refactor`) and `status/*`; hogwarts uses `P0/P1/P2` plus `area: *`; mkan/marketing/android/ios use only GitHub defaults; the global rule says `type:<type>,P<n>`. Only the `report`/`needs-human`/`low-confidence`/`team` lane labels are shared (hogwarts, space). catalog has 1 open issue with no labels. Report-lane totals: hogwarts report 14 (9 needs-human, 5 low-confidence, 2 team), space report 4.

## 6. CI — latest runs (`gh run list -L 3`)

| Repo | Latest | Result |
|---|---|---|
| shadcn | Write Beta Release comment (main, 2026-05-06) | skipped; last 3: skipped, success, skipped |
| hogwarts | Stale Issue Management (main, 2026-11-24) | success; last 3: success, failure, failure |
| codebase | PR Automation with Subagents (feat/report-canonical, 2026-05-22) | failure; last 3: failure, failure, failure |
| ios-app | Build & Test (main, 2026-11-15) | failure; last 3: failure, failure, failure |
| mkan | Listing images (main, 2026-11-24) | success; last 3: success, success, success |
| maid | CI (main, 2026-09-22) | failure; last 3: failure, failure, failure |
| kun | CI (main, 2026-11-24) | success; last 3: success, success, success |
| android-app | Android CI (main, 2026-11-24) | failure; last 3: failure, failure, failure |
| crm | CI (main, 2026-06-09) | success; last 3: success, success, success |
| twenty | Pull translations from Crowdin (main, 2026-10-09) | success; last 3: success, success, success |
| food | prod-smoke (main, 2026-11-24) | success; last 3: success, success, success |
| catalog | publish (main, 2026-10-26) | skipped; last 3: skipped, success, skipped |
| leader | CI (main, 2026-11-14) | success; last 3: success, success, success |
| machine | release (v0.1.1, 2026-11-24) | success; last 3: success, failure, cancelled |

Red on main right now: **hogwarts** (Playwright Tests failure 11-24 08:14, Keep Vercel Cache Warm failure 11-24 08:51), **android-app** (Android CI failing 3 in a row, latest 11-24), **machine** (Machine workflow failure 11-24 08:15 on main, though the v0.1.1 release run succeeded), **ios-app** (Build & Test + i18n gates failing since 11-15), **maid** (CI failing since Feb, stale). **mkan main is green** (Listing images ×3, but that is the only workflow — no build/test workflow on mkan). kun, food, leader, catalog, crm green. codebase last runs are old failing runs on a feat branch from 2026-05-22. 18 org repos have no workflow runs.

## 7. Stale state — JSON in ~/.claude/memory and ~/kun/.claude/memory

Recorded date = the file's own last_updated/lastUpdated field. **STALE** = recorded date before 2026-09-01. mtime is often newer than the recorded date (files are touched without the field being bumped) — the field is what counts.

| File | Recorded updated | Updated by | mtime | Bytes | Flag |
|---|---|---|---|---|---|
| ~/.claude/memory/atom.json | 2026-08-01 | - | 2026-08-01 | 11527 | **STALE** |
| ~/.claude/memory/block.json | 2025-12-30T12:00:00Z | - | 2026-01-11 | 4412 | **STALE** |
| ~/.claude/memory/capacity.json | 2026-07-02 | engine-boost-refresh | 2026-11-24 | 9114 | **STALE** |
| ~/.claude/memory/config-changes.jsonl | - | - | 2026-07-02 | 100591 | n/a (not JSON) |
| ~/.claude/memory/coverage-index.json | - | - | 2026-04-08 | 186 | no field |
| ~/.claude/memory/crm.json | 2026-07-02 | - | 2026-11-24 | 1358 | **STALE** |
| ~/.claude/memory/customers.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-24 | 3003 |  |
| ~/.claude/memory/customers.legacy.json | 2026-05-12 | captain-os-bootstrap | 2026-11-24 | 1478 | **STALE** |
| ~/.claude/memory/north_star.json | 2026-11-21 | weekly-plan-2026-11-22 (business desk; measured on Hogwarts production) | 2026-11-24 | 2232 |  |
| ~/.claude/memory/okrs.json | 2026-05-12 | captain-os-bootstrap | 2026-11-24 | 4075 | **STALE** |
| ~/.claude/memory/pipeline.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-24 | 2669 |  |
| ~/.claude/memory/preferences.json | 2026-02-04 | - | 2026-02-04 | 645 | **STALE** |
| ~/.claude/memory/repositories.json | 2026-11-17 | - | 2026-11-24 | 19881 |  |
| ~/.claude/memory/revenue.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-24 | 1373 |  |
| ~/.claude/memory/risks.json | 2026-05-12 | captain-os-bootstrap | 2026-11-24 | 6857 | **STALE** |
| ~/.claude/memory/runway.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-24 | 1894 |  |
| ~/.claude/memory/skill-scores.json | 2026-11-02 | bench-dispatch.js | 2026-11-24 | 70059 |  |
| ~/.claude/memory/tc-report.json | 2025-01-11T12:00:00Z | - | 2026-01-11 | 4139 | **STALE** |
| ~/.claude/memory/team.json | 2026-11-08 | - | 2026-11-24 | 4997 |  |
| ~/.claude/memory/template.json | 2026-08-01 | - | 2026-08-01 | 8027 | **STALE** |
| ~/.claude/memory/textbook-scores.json | 2026-10-25 | - | 2026-11-24 | 465373 |  |
| ~/.claude/memory/whatsapp_tokens.json | - | - | 2026-09-10 | 6484 | no field |
| ~/kun/.claude/memory/1on1/ | (directory) | | | | |
| ~/kun/.claude/memory/capacity.json | 2026-07-02 | engine-boost-refresh | 2026-08-05 | 9114 | **STALE** |
| ~/kun/.claude/memory/captain_journal.md | - | - | 2026-11-22 | 9142 | n/a (not JSON) |
| ~/kun/.claude/memory/crm.json | 2026-07-02 | - | 2026-08-20 | 1358 | **STALE** |
| ~/kun/.claude/memory/customers.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-08 | 3003 |  |
| ~/kun/.claude/memory/customers.legacy.json | 2026-05-12 | captain-os-bootstrap | 2026-05-18 | 1478 | **STALE** |
| ~/kun/.claude/memory/decisions/ | (directory) | | | | |
| ~/kun/.claude/memory/feedback.jsonl | - | - | 2026-05-18 | 784 | n/a (not JSON) |
| ~/kun/.claude/memory/hiring.md | - | - | 2026-07-02 | 3921 | n/a (not JSON) |
| ~/kun/.claude/memory/learnings.md | - | - | 2026-05-18 | 4222 | n/a (not JSON) |
| ~/kun/.claude/memory/north_star.json | 2026-11-21 | weekly-plan-2026-11-22 (business desk; measured on Hogwarts production) | 2026-11-21 | 2232 |  |
| ~/kun/.claude/memory/okrs.json | 2026-05-12 | captain-os-bootstrap | 2026-05-18 | 4075 | **STALE** |
| ~/kun/.claude/memory/pipeline.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-08 | 2669 |  |
| ~/kun/.claude/memory/repositories.json | 2026-11-17 | - | 2026-11-22 | 19881 |  |
| ~/kun/.claude/memory/revenue.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-08 | 1373 |  |
| ~/kun/.claude/memory/risks.json | 2026-05-12 | captain-os-bootstrap | 2026-05-18 | 6857 | **STALE** |
| ~/kun/.claude/memory/runway.json | 2026-11-08 | interim-ceo-session-2026-11-08 | 2026-11-08 | 1894 |  |
| ~/kun/.claude/memory/skill-scores.json | 2026-11-02 | bench-dispatch.js | 2026-11-15 | 70059 |  |
| ~/kun/.claude/memory/team.json | 2026-11-08 | - | 2026-11-17 | 4997 |  |
| ~/kun/.claude/memory/textbook-scores.json | 2026-10-25 | - | 2026-11-24 | 465373 |  |
| ~/kun/.claude/memory/weekly/ | (directory) | | | | |

Stale by recorded date (< 2026-09-01): atom.json 08-01, template.json 08-01, block.json 2025-12-30, tc-report.json 2025-01-11, preferences.json 2026-02-04, capacity.json 07-02, crm.json 07-02, okrs.json 05-12, risks.json 05-12, customers.legacy.json 05-12 (+ their ~/kun copies). Files with no date field: coverage-index.json (lastUpdated absent in my parse; mtime 2026-04-08), whatsapp_tokens.json (extractedAt only; mtime 09-10), config-changes.jsonl (last written 07-02).
capacity.json says updated 07-02 by engine-boost-refresh but is the date the field was last written — the global copy has mtime 11-24 and is identical to the kun copy. Every shared JSON present in both dirs is byte-identical (14/14) — no drift between the two directories, so they are effectively duplicates (symlink/sync). Many mtimes of 11-24 are from sync, not real edits. The registry itself says lastUpdated 2026-11-17 yet is wrong about 13 paths; sync.* all `synced:false/hash:null`.
decisions/ has 11 files (latest 2026-11-22), weekly/ has 2 (latest 2026-11-22), 1on1/ exists (not enumerated).

## 8. Hermes cron (`hermes cron list`; store ~/.hermes/cron/jobs.json)

18 jobs, all `[active]`, 0 disabled, all last_status ok, no next_run in the past (checked at 11:29 +02:00).

| Name | Schedule | Last run | Next run | Deliver |
|---|---|---|---|---|
| databayt-4h-heartbeat | 0 */4 * * * | 2026-11-24T08:01  ok | 2026-11-24T12:00 | origin |
| hogwarts-crm-digest | 0 8 * * * | 2026-11-24T08:00  ok | 2026-11-25T08:00 | slack:D0AQ0JR5ZU4 |
| hogwarts-crm-activity | 0 */2 * * * | 2026-11-24T10:00  ok | 2026-11-24T12:00 | slack:D0AQ0JR5ZU4 |
| hogwarts-snapshot-freshness | 0 */3 * * * | 2026-11-24T09:00  ok | 2026-11-24T12:00 | slack:D0AQ0JR5ZU4 |
| databayt-weekly-social-plan | 0 18 * * 0 | 2026-11-22T18:00  ok | 2026-11-29T18:00 | slack:C0AQ9RNPVDF |
| databayt-daily-social-digest | 30 8 * * 1-5 | 2026-11-24T08:30  ok | 2026-11-25T08:30 | slack:C0AQ9RNPVDF |
| mkan-demand-match | 0 9 * * * | 2026-11-24T09:00  ok | 2026-11-25T09:00 | slack:C0BS2NZE2AY |
| mkan-web-sweep | 45 6,18 * * * | 2026-11-24T06:45  ok | 2026-11-24T18:45 | slack:C0BS2NZE2AY |
| mkan-tiktok-sweep | 0 6,15 * * * | 2026-11-24T06:26  ok | 2026-11-24T15:00 | slack:C0BS2NZE2AY |
| mkan-price-ask | 30 9 * * * | 2026-11-24T09:30  ok | 2026-11-25T09:30 | local |
| mkan-sprint-runner | 0,15,30,45 7-21 * * * | 2026-11-24T11:15  ok | 2026-11-24T11:30 | local |
| mkan-agencies | 0 11 * * * | 2026-11-24T11:00  ok | 2026-11-25T11:00 | slack:C0BS2NZE2AY |
| mkan-sprint-runner-night | 0 22,23,0-6 * * * | 2026-11-24T06:26  ok | 2026-11-24T22:00 | local |
| mkan-tiktok-post | 0 7 * * * | 2026-11-24T07:00  ok | 2026-11-25T07:00 | slack:C0BS2NZE2AY |
| mkan-tiktok-upload-retry | 30 8-17 * * * | 2026-11-24T10:30  ok | 2026-11-24T11:30 | slack:C0BS2NZE2AY |
| mkan-tiktok-upload-evening | 30 18-22 * * * | 2026-11-23T23:51  ok | 2026-11-24T18:30 | slack:C0BS2NZE2AY |
| mkan-tiktok-stats | 0 21 * * * | 2026-11-23T21:00  ok | 2026-11-24T21:00 | slack:C0BS2NZE2AY |
| mkan-tiktok-inbox | */10 7-22 * * * | 2026-11-24T11:20  ok | 2026-11-24T11:30 | slack:C0BS2NZE2AY |

Notes: `mkan-tiktok-upload-evening` (30 18-22) last ran 11-23 23:51, later than its 22:30 slot — odd but ok; `mkan-sprint-runner` and `-night` share one script. No job lists a last_status other than ok. Hermes state files: jobs.json plus 5 dated backups.
