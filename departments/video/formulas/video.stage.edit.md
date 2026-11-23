---
{
  "id": "video.stage.edit",
  "label": {
    "en": "Edit",
    "ar": "المونتاج"
  },
  "icon": "Scissors",
  "when": {
    "intent": "work the edit stage",
    "project": "open",
    "stage": "edit"
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
  "weight": 4,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "edit stage",
      "assemble the edit"
    ],
    "ar": [
      "مرحلة المونتاج",
      "ركّب المونتاج"
    ]
  },
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Assemble the edit of one version from the visuals, captures, audio and captions.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per year
- Destination: {{platform}} · {{format}} · {{length}}
- Video settings: {{settings}}
- Stage: 09 edit (per variant)

## References
- Visuals: `{{project_dir}}/06-production/visual-manifest.json`
- Audio: `{{project_dir}}/07-audio/audio-package.json`
- Brand kit: {{brand_kit_url}}

## Constraints
- Edit with FilmCraft (`fc/assemble.mjs` or the `filmcraft` MCP); `produce build {{project}} --variant {{variant}}` runs piece then assemble.
- Captions in the version's language, RTL shaping checked on every frame.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Deliverable file: `{{project_dir}}/06-production/editing/edit-project.json`.
- The edit project and the per-variant editing files under `06-production/editing/`.
- Advance with the variant flag (below).
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} edit --file <06-production/editing/edit-project.json> --variant {{variant}}`.
