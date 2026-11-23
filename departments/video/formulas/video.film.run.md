---
{
  "id": "video.film.run",
  "label": {
    "en": "Run the locked plan",
    "ar": "تشغيل الخطة المقفلة"
  },
  "icon": "Play",
  "when": {
    "intent": "run the film's locked plan, stage by stage, to the next human gate",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "repo": {
      "context": "repo",
      "default": "hogwarts"
    },
    "stage_now": {
      "context": "project.next_stage"
    },
    "brand": {
      "choice": [
        "Balqalam",
        "Hogwarts",
        "Mkan",
        "Databayt"
      ],
      "default_by_repo": {
        "hogwarts": "Balqalam",
        "mkan": "Mkan",
        "kun": "Databayt"
      },
      "default": "Balqalam"
    },
    "project": {
      "context": "project.id"
    },
    "version": {
      "context": "project.version"
    },
    "variant": {
      "context": "project.focus.0"
    },
    "project_dir": {
      "context": "project.dir"
    }
  },
  "drive": 0.9,
  "weight": 1,
  "role": "next",
  "board": false,
  "record": "none",
  "needs": [
    "tools"
  ],
  "triggers": {
    "en": [
      "run the plan",
      "run the line",
      "run the locked plan",
      "execute the plan"
    ],
    "ar": [
      "شغل الخطة",
      "شغل الخط",
      "نفذ الخطة"
    ]
  },
  "order": [],
  "model": "opus",
  "effort": "high"
}
---

## Task
Run the locked plan of the open {{repo}} film from the next stage that is not done ({{stage_now}}), stage by stage, and stop at the next human gate or at the first failure.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Next stage: {{stage_now}}
- This formula is reached through "Continue production" once every stage is locked.

## References
- The plan: `{{project_dir}}/00-plan/plan.md` (and `plan.json`, the same steps as data)
- One spec per stage: `{{project_dir}}/00-plan/<NN>-<stage>.spec.md`
- The tool ladder: `~/kun/departments/video/stages.json` (cheapest rung first)
- Ledger: `node ~/.claude/skills/produce/scripts/produce.mjs status {{project}} --json`

## Constraints
- For each stage, read its spec first and work only from it. If a spec is missing, stop and say so.
- Each piece (a scene, a still, a clip, a card, a voice track) goes to a Sonnet sub-agent. Its brief is not written by hand: it is the filled order formula, for example `node ~/kun/.claude/scripts/station.mjs fill video.order.<kind> --dept video --project {{project}} --set scene=<scene id>`, with `<kind>` one of blender, capture, still, image, clip, motion, voice, filmcraft, review.
- Independent pieces run in parallel, each sub-agent writing only inside its own folder.
- Scripts (voice, encode, mirror, ship) are run directly: they cost nothing and need no sub-agent.
- Free tools are the default. A paid tool is used only when the person has set it up on this machine (`node ~/kun/.claude/scripts/video-tools.mjs status <tool>` says ready); otherwise take the next free rung and never ask anyone to pay. A piece meant for a person becomes a work order (`produce order …`), not a sub-agent.
- After each stage run `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} <stage> --file <its file>`.
- Never approve a gate (script, look, version, publish). Sub-agents run on sonnet or haiku only.
- Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Where the run stopped and why: a gate that needs the person's yes (name it and show the files by path), or a failure (the stage, the piece, the error).
- The stages finished in this run, one line each, and the next step with its tool.
