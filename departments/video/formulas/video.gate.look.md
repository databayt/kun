---
{
  "id": "video.gate.look",
  "label": {
    "en": "Review the look",
    "ar": "مراجعة الشكل"
  },
  "icon": "Eye",
  "when": {
    "intent": "a human gate is waiting: look",
    "project": "open",
    "gate": "look"
  },
  "route": "do",
  "gate": "look",
  "slots": {
    "login": {
      "context": "login"
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
    "project_dir": {
      "context": "project.dir"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
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
  "weight": 2,
  "role": "waiting",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "review the look",
      "look approval",
      "review the animatic"
    ],
    "ar": [
      "راجع الشكل",
      "اعتماد الشكل",
      "راجع الانيماتيك"
    ]
  },
  "order": [],
  "model": "opus",
  "effort": "high"
}
---

## Task
Walk {{login}} through the look gate of the film: present the look (cast, sets, camera and the animatic), answer questions, and record the decision. The decision is the person's; you never make it.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Gate: look (human only)
- Reviewer: {{login}}

## References
- Deliverable under review: `{{project_dir}}/06-production/visual-manifest.json`
- Brand kit: {{brand_kit_url}}
- Predicted public address: {{video_url}}

## Constraints
- Read `produce status {{project}}` first and confirm the gate really is waiting; if it is not, say so and stop.
- Summarise in plain words: what the person is approving, what changed since the last version, and the risks you see. Do not soften a problem.
- Never run `produce approve`. The person runs it, or tells you "approved" in chat, in which case you show the command and let them run it.

## Deliverable
- A one-screen review: what is here · what I checked · what worries me · my recommendation.
- The exact command to approve: `node ~/.claude/skills/produce/scripts/produce.mjs approve {{project}} --gate look --version {{version}} --by {{login}}`.
- If the person asks for changes: list them as work for the owning stage and name the stage's formula.
