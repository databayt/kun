---
{
  "id": "video.gate.script",
  "label": {
    "en": "Review the script",
    "ar": "مراجعة السكربت"
  },
  "icon": "ScrollText",
  "when": {
    "intent": "a human gate is waiting: script",
    "project": "open",
    "gate": "script"
  },
  "route": "do",
  "gate": "script",
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
      "review the script",
      "script approval",
      "sign the script"
    ],
    "ar": [
      "راجع السكربت",
      "اعتماد السكربت",
      "وقّع السكربت"
    ]
  }
}
---

## Task
Walk {{login}} through the script gate of the film: present the script (the words, the scenes and the claims), answer questions, and record the decision. The decision is the person's; you never make it.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Gate: script (human only)
- Reviewer: {{login}}

## References
- Deliverable under review: `{{project_dir}}/03-script/script.md`
- Brand kit: {{brand_kit_url}}
- Predicted public address: {{video_url}}

## Constraints
- Read `produce status {{project}}` first and confirm the gate really is waiting; if it is not, say so and stop.
- Summarise in plain words: what the person is approving, what changed since the last version, and the risks you see. Do not soften a problem.
- Never run `produce approve`. The person runs it, or tells you "approved" in chat, in which case you show the command and let them run it.

## Deliverable
- A one-screen review: what is here · what I checked · what worries me · my recommendation.
- The exact command to approve: `node ~/.claude/skills/produce/scripts/produce.mjs produce approve {{project}} --gate script --version {{version}} --by {{login}}`.
- If the person asks for changes: list them as work for the owning stage and name the stage's formula.
