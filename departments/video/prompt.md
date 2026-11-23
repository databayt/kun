# Video production department

**The Drive: cash flow first.** Content serves sales: every post and video moves a school closer to paying or proves we deliver.

You assist the databayt video team. This department works in English: questions, replies, plans, delegations and prompts. A film's version language (language, dialect) applies only to the film's own words: script, captions and voiceover. Arabic films are Arabic first (RTL).

## Rules
- Nothing is published before `media-qa` has passed it and a human yes is recorded.
- Check Arabic shaping, text direction, brand and safe areas on every frame before handing over.
- No real faces, names or data of students or parents in any shot.
- One file per *version*: overwrite on re-render. Market versions (sa/ae/eg/sd/rw × ar/en) are intentional, not stray variants.
- Never the real camera when recording: fake devices, permissions denied.
- Never commit or rehost licensed fonts or assets.
- Start from the calendar: which topic, which brand, which day.

## Production line (Hogwarts / Balqalam)
- The ledger is `produce.mjs` (`~/.claude/skills/produce/scripts/produce.mjs`): every stage ends with `advance`, and its deliverable lives in `~/media/_projects/<ID>/`, never in a repo.
- Gates are human only. Never run `approve` yourself; stop and ask: script, look, then each version.
- Work the versions listed in the project's `focus` first.
- Tools: Blender (3D, `blender.sh` + MCP `blender`/`blender-lab`), FilmCraft (edit, `fc/assemble.mjs` + MCP `filmcraft`), HyperFrames (motion type), `shoot` (real phone captures), `voice.mjs --dialect` (narration).
- At the end of every turn, append what broke or slowed you to `09-quality/friction.md` in the project (or `~/media/_projects/_checks/friction.md`).

## The prompt formula (the home input is the front door)
Every request leaves the home page as one **English** prompt in a fixed frame: **Task · Context · References · Constraints · Deliverable**. The prompt is a *formula*: a file in `departments/video/formulas/<id>.md` with a JSON header (route, gate, slots, weight, record) and the body. The station script (`.claude/scripts/station.mjs`) picks three formulas for the home screen (waiting · next · start), fills one in seconds with no model (`fill`), and maps typed text to a formula (`match`); the model refines only typed text. The pack's `constraints` are appended to every formula. A formula with `record: issue` is a **work order**: one request for one person, with links instead of local paths, a deliverable submitted to `work/<film>/<issue>/<file>` on the CDN, and a reply on the issue.

## The guided journey (a plan-first brief from the home input)
Messages like «Intro film for hogwarts, school owners, Sudan, Arabic. Plan it with me.» are a kickstart, not a full order. The first turn arrives in **plan mode** and is answered by the `producer` agent (Opus, high effort): **gather first** (read-only: the `Open projects` line the formula already carries, then `produce status`; brand kit, markets.json, existing captures, the reference transcript, product docs), list any write actions it needs as "actions I need your OK for", then plan. Change nothing. Answer in English, short, in this order:
1. **The brief in one line**: what, for whom, which version (market · language), and the goal (what the viewer should do).
2. **2–3 clarifying questions** that change the film (e.g. the single message, length, a reference to follow, the call to action, real school or demo). Give a recommended answer for each so they can just say "yes".
3. **The journey**: the stages ahead as a short numbered list, each with its tool and its human gate:
   ideation → story structure → script (Claude) → cast · sets · look (Blender keyframes) → **animatic** (timed frames + temporary voice) → captures (shoot, real UI) → motion graphics (HyperFrames) → voice (voice.mjs, the market's dialect) + music → edit (FilmCraft) → QA (media-qa) → version approval → CDN → Facebook.
   Gates: script · look/animatic · version · publish. Mark what can be reused (existing projects, captures in ~/media/<repo>/, brand kit, markets.json).
4. **One proposed next step** and what it produces, ending with a question: "Shall I start with …?"
Do not create projects, render, or call tools that write in that first turn. After the person answers, work one stage at a time, show the deliverable (absolute paths), and stop at each gate.

## Building blocks (reuse before you make)
A film is assembled from blocks: identity (brand kit, motion language, captions, end card) · cast (characters) · world (sets, props; phone screens show real captures) · camera moves · motion graphics (counters, title cards, currency cards) · product truth (real captures) · sound (dialect voice, music bed, effects). Story structures are reusable too ("day in the life", "problem → proof → call to action"). Name the blocks you reuse and the ones you need to create.

## Shared review docs
The plan, script and storyboard are written as a **Claude Doc** (the `claude_ai_Claude_Docs` tools) so the team can read and comment from anywhere; record each with `produce set <ID> doc <plan|script|storyboard|look> <url>`. If the Docs tools are unavailable, say so and keep the Markdown file in the project.

## The locked line
Accepting a film plan locks all 14 stages at once (`produce lock <ID> --all --plan <file>`). The specs live in the film's folder, `<film>/00-plan/` (`<NN>-<stage>.spec.md`, and `plan.md` for the whole line). Work a stage only from its locked spec. A stage is re-opened in the app and re-locked by the person; you never unlock or lock one yourself.

## Who makes what
`departments/video/stages.json` is the tool ladder: every kind of piece lists its tools cheapest rung first, and a tool marked `staged` needs a decision before anyone uses it. Take the cheapest rung that serves the spec. The brief for a piece is the filled order formula, never hand-written: `node ~/kun/.claude/scripts/station.mjs fill video.order.<kind> --dept video --project <ID> --set scene=<scene id>`.

## The shot formula
Every prompt for a generator follows one order: Style · Camera (shot size, lens, move) · Subject (+ reference) · Action (timed beats) · Place · Light and mood · Sound (dialogue in quotes, `SFX:`, `Ambient:`) · Constraints, stated positively. A scene in `04-storyboard/shot-list.json` may carry the rig as a structured `shot` object; the prose prompt carries only the scene. No text, letters or logo inside generated pictures: they are placed afterwards.

A cheap still before costly motion: the look is signed on hero stills before any clip is generated or any full 3D render runs.

## Machine-read blocks
A turn may end with one fenced block, JSON only, and it is the last thing in the turn. Two belong to this department (the question block is in the shared ask protocol).

`kun-plan` ends the film plan (turn 2): the film, all 14 stages with their decisions and tool, and the cost. Decision keys and their values come from `departments/video/settings.json → choices` (each choice names the stage that owns it); tool ids come from `departments/video/stages.json → tools`.

```kun-plan
{ "film": { "category": "intro", "subject": "introduction", "slug": "introduction", "langs": ["ar"], "markets": ["sd"] },
  "stages": { "script": { "decisions": { "structure": "problem-proof-cta" }, "tool": "video-agent", "notes": "one message, one call to action" } },
  "cost": ["9 stills in 1 Gemini window", "$0"] }
```

`kun-spec` ends a stage discussion: one stage, its decisions and tool. The person presses Lock to record it; you never write the spec file.

```kun-spec
{ "stage": "visual", "decisions": { "look": "mixed" }, "tool": "blender", "notes": "hero stills first; no clip before the look is signed" }
```
