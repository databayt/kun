---
{
  "id": "video.stage.storyboard",
  "label": {
    "en": "Storyboard",
    "ar": "القصة المصورة"
  },
  "icon": "LayoutGrid",
  "when": {
    "intent": "work the storyboard stage",
    "project": "open",
    "stage": "storyboard"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "repo": {
      "context": "repo",
      "default": "hogwarts"
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
    "platform": {
      "choice": [
        "Facebook",
        "Instagram",
        "WhatsApp"
      ],
      "default": "Facebook"
    },
    "settings": { "value": "as in the film request" },
    "format": {
      "choice": [
        "vertical 9:16, mobile",
        "square 1:1, mobile",
        "horizontal 16:9, desktop"
      ],
      "default": "vertical 9:16, mobile"
    },
    "length": {
      "choice": [
        "about 2:00",
        "about 1:00",
        "about 0:30"
      ],
      "default": "about 2:00"
    },
    "project_dir": {
      "context": "project.dir"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    }
  },
  "drive": 0.8,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "storyboard stage",
      "write the storyboard"
    ],
    "ar": [
      "مرحلة القصة المصورة",
      "اكتب القصة المصورة"
    ]
  }
}
---

## Task
Turn the approved script into the shot list: every scene, its source, its timing and its words.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Destination: {{platform}} · {{format}} · {{length}}
- Video settings: {{settings}}
- Stage: 05 storyboard

## References
- Script: `{{project_dir}}/03-script/script.md`
- Brand kit: {{brand_kit_url}}
- Locked spec: `{{project_dir}}/00-plan/05-storyboard.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- A scene that makes a product claim must have `source.type = capture` (real product UI).
- A generated or 3D scene must set `illustrative: true`.
- Check the script is signed (`produce status {{project}}`) before writing; the heavy stages after this one depend on it.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/04-storyboard/shot-list.json`.
- Each scene MAY carry the optional structured `shot` object: `{ "size", "lens", "move", "light", "mood", "beats": [{ "at", "action" }], "audio": { "line", "sfx", "ambient" }, "refs": [] }`. The rig lives in those fields and the prose prompt carries only the scene. The still, clip and Blender orders (`video.order.still`, `video.order.clip`, `video.order.blender`) read it.
- Validate the file with `node ~/.claude/skills/produce/scripts/produce.mjs validate {{project_dir}}/04-storyboard/shot-list.json` and fix every error.
- Add the storyboard as a Claude Doc and record it: `produce set {{project}} doc storyboard <url>`.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} storyboard --file <04-storyboard/shot-list.json>`.
