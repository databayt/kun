---
{
  "id": "video.stage.approval",
  "label": {
    "en": "Version approval",
    "ar": "اعتماد النسخة"
  },
  "icon": "BadgeCheck",
  "when": {
    "intent": "work the approval stage",
    "project": "open",
    "stage": "approval"
  },
  "route": "do",
  "gate": "version",
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
  "weight": 2,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "approval stage",
      "prepare the version approval"
    ],
    "ar": [
      "مرحلة الاعتماد",
      "جهّز اعتماد النسخة"
    ]
  }
}
---

## Task
Prepare the exact version of one variant for the person's approval, and stop at the version gate.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per month
- Stage: 12 approval (per variant). Gate: version

## References
- QA report: `{{project_dir}}/09-quality/qa-report.md`
- Master: {{video_url}}

## Constraints
- The approval is for one exact version of the file. Do not proceed if the QA verdict is not pass.
- Never run `produce approve`.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- A review package: the master, its poster, the captions, the QA verdict and what changed since the last version.
- Give the exact command the person would run: `produce approve {{project}} --gate version --version {{version}} --variant {{variant}} --by <login>`. Stop.
