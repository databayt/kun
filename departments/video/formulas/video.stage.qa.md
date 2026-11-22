---
{
  "id": "video.stage.qa",
  "label": {
    "en": "Quality check",
    "ar": "فحص الجودة"
  },
  "icon": "ShieldCheck",
  "when": {
    "intent": "work the qa stage",
    "project": "open",
    "stage": "qa"
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
    "project_dir": {
      "context": "project.dir"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
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
      "qa stage",
      "quality check",
      "run media qa"
    ],
    "ar": [
      "مرحلة الفحص",
      "فحص الجودة"
    ]
  }
}
---

## Task
Check the rendered master of one version against the numbers and by eye, and write the QA report.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per month
- Stage: 11 qa (per variant)

## References
- Master: `{{project_dir}}/08-render/masters/master.mp4`
- Brand kit: {{brand_kit_url}}
- Markets: {{markets_url}}

## Constraints
- Hand the check to the `media-qa` agent; it never edits pixels, and neither do you.
- Check Arabic shaping, text direction, brand, safe areas, the price and currency, and that no real student or parent appears.
- A fail is recorded as a fail, with the frame and the timecode.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Deliverable file: `{{project_dir}}/09-quality/qa-report.md`.
- The report lists every check with pass or fail and evidence.
- Advance with `--verdict pass` or `--verdict fail` and the variant flag (below). On a fail, name the stage to redo.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} qa --file <09-quality/qa-report.md> --variant {{variant}}`.
