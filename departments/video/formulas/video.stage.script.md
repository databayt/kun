---
{
  "id": "video.stage.script",
  "label": {
    "en": "Script",
    "ar": "السكربت"
  },
  "icon": "ScrollText",
  "when": {
    "intent": "work the script stage",
    "project": "open",
    "stage": "script"
  },
  "route": "do",
  "gate": "script",
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
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
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
      "script stage",
      "write the script"
    ],
    "ar": [
      "مرحلة السكربت",
      "اكتب السكربت"
    ]
  }
}
---

## Task
Write the film's script from the approved brief, in the language of the focus version, ready for the person's sign-off.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per year
- Destination: {{platform}} · {{format}} · {{length}}
- Video settings: {{settings}}
- Stage: 04 script. Gate: script

## References
- Brief: `{{project_dir}}/01-brief/creative-brief.md`
- Research: `{{project_dir}}/02-research/product-research.md`
- Reference transcript, if any: `{{project_dir}}/02-research/reference/`
- Markets: {{markets_url}}

## Constraints
- Write for the ear: short sentences, the market's dialect, numbers and currency as the viewer says them.
- Each scene states what is shown and whether it is a real capture or an illustrative generated scene.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Deliverable file: `{{project_dir}}/03-script/script.md`.
- Also write the script as a Claude Doc so the team can comment, and record it: `produce set {{project}} doc script <url>`. If the Docs tools are unavailable, say so and keep the Markdown file.
- Stop at the script gate: tell the person the script is ready and give the exact command they would run to sign it (`produce approve {{project}} --gate script --version {{version}} --by <login>`). Never run it.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} script --file <03-script/script.md>`.
