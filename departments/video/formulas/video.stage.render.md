---
{
  "id": "video.stage.render",
  "label": {
    "en": "Render",
    "ar": "الإخراج"
  },
  "icon": "Clapperboard",
  "when": {
    "intent": "work the render stage",
    "project": "open",
    "stage": "render"
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
    "market_name": {
      "json": "content/media/markets.json",
      "path": "{{market}}.name.en"
    },
    "language": {
      "map": {
        "ar": "Arabic",
        "en": "English"
      },
      "of": "lang"
    },
    "dialect": {
      "json": "content/media/markets.json",
      "path": "{{market}}.voice.{{lang}}.dialect"
    },
    "price": {
      "json": "content/media/markets.json",
      "path": "{{market}}.price"
    },
    "currency": {
      "json": "content/media/markets.json",
      "path": "{{market}}.currency"
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
    "project_dir": {
      "context": "project.dir"
    },
    "video_url": {
      "argv": [
        "node",
        "~/.claude/skills/produce/scripts/produce.mjs",
        "url",
        "{{project}}",
        "--variant",
        "{{variant}}"
      ],
      "regex": "video\\s+(https?://\\S+)"
    },
    "market": {
      "choice": [
        "sd",
        "sa",
        "ae",
        "eg",
        "rw"
      ],
      "default": "sd"
    },
    "lang": {
      "choice": [
        "ar",
        "en"
      ],
      "default": "ar"
    }
  },
  "drive": 0.8,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "render stage",
      "render the master"
    ],
    "ar": [
      "مرحلة الإخراج",
      "اخرج النسخة"
    ]
  },
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Render the master of one version and confirm it plays.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per year
- Destination: {{platform}} · {{format}}
- Video settings: {{settings}}
- Stage: 10 render (per variant)

## References
- Edit project: `{{project_dir}}/06-production/editing/edit-project.json`
- Predicted CDN address: {{video_url}}
- Locked spec: `{{project_dir}}/00-plan/10-render.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- Overwrite the version's file on re-render; never leave a second copy next to it.
- Check the duration, the aspect, the audio levels and the captions on the rendered file, not the project.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/08-render/masters/master.mp4`.
- The master under `08-render/masters/` and the delivery file under `08-render/delivery/`, with the checks you ran and their numbers.
- Advance with the variant flag (below).
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} render --file <08-render/masters/master.mp4> --variant {{variant}}`.
