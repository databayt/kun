---
{
  "id": "video.versions.fanout",
  "label": {
    "en": "All versions at once",
    "ar": "كل النسخ معاً"
  },
  "icon": "Workflow",
  "when": {
    "intent": "the same stage for every market version of a film, in parallel",
    "project": "open",
    "min_variants": 2,
    "stage_in": [
      "audio",
      "edit",
      "render",
      "qa",
      "approval",
      "cdn",
      "publish"
    ]
  },
  "route": "workflow",
  "gate": null,
  "slots": {
    "stage_now": {
      "context": "project.next_stage"
    },
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
    "variants": {
      "context": "project.variants"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    }
  },
  "drive": 0.7,
  "weight": 3,
  "role": "next",
  "board": true,
  "record": "none",
  "needs": [
    "tools"
  ],
  "triggers": {
    "en": [
      "all versions",
      "every version",
      "fan out",
      "versions in parallel",
      "all markets"
    ],
    "ar": [
      "كل النسخ",
      "جميع النسخ",
      "كل الاسواق",
      "نسخ بالتوازي"
    ]
  }
}
---

## Task
Run the {{stage_now}} stage for every version of the film in parallel: one agent per version, each result verified, stopping at the human gates.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Stage: {{stage_now}}
- Versions: {{variants}}

## References
- Ledger: `node ~/.claude/skills/produce/scripts/produce.mjs status {{project}}`
- Markets: {{markets_url}}

## Constraints
- Use a workflow: fan out one sonnet agent per version (or per independent piece), each with a written brief naming the variant, the market's language, dialect, price and currency, and the exact files in scope.
- Verify every result yourself before recording it with `produce advance {{project}} {{stage_now}} --variant <v>`.
- A version that fails verification is reported, not retried silently.

## Deliverable
- A table: version · deliverable path · checks · verdict. Then stop at the next gate; never approve.
