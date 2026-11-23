---
{
  "id": "video.film.continue",
  "label": {
    "en": "Continue production",
    "ar": "متابعة الإنتاج"
  },
  "icon": "Play",
  "when": {
    "intent": "carry on with the film already under way",
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
    }
  },
  "drive": 0.9,
  "weight": 1,
  "role": "next",
  "board": true,
  "record": "none",
  "needs": [
    "tools"
  ],
  "redirects": [
    {
      "to": "video.film.run",
      "if": "all_locked"
    },
    {
      "to": "video.stage.{stage}",
      "if": "open_project"
    }
  ],
  "triggers": {
    "en": [
      "continue production",
      "continue the film",
      "next step",
      "where are we",
      "carry on"
    ],
    "ar": [
      "متابعة الانتاج",
      "كمل الفيديو",
      "الخطوة التالية",
      "وين وصلنا",
      "اكمل الفيلم"
    ]
  },
  "order": [],
  "model": "opus",
  "effort": "high"
}
---

## Task
Continue the open {{repo}} video production at its current stage ({{stage_now}}): report where it stands, then work that one stage.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Current stage: {{stage_now}}

## References
- Ledger: `node ~/.claude/skills/produce/scripts/produce.mjs status {{project}}`
- Predicted public address: {{video_url}}

## Constraints
- Read `produce list --json --repo {{repo}}` and `status {{project}}`: stages done, the waiting gate, the predicted CDN addresses.
- Work one stage, then stop at its gate; never approve.

## Deliverable
- Where we stand in one line · what needs the person's decision · the next step with its tool and what it produces.
