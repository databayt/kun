---
{
  "id": "video.stage.cdn",
  "label": {
    "en": "Ship to the CDN",
    "ar": "رفع إلى CDN"
  },
  "icon": "CloudUpload",
  "when": {
    "intent": "work the cdn stage",
    "project": "open",
    "stage": "cdn"
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
    "poster_url": {
      "argv": [
        "node",
        "~/.claude/skills/produce/scripts/produce.mjs",
        "url",
        "{{project}}",
        "--variant",
        "{{variant}}"
      ],
      "regex": "poster\\s+(https?://\\S+)"
    },
    "captions_url": {
      "argv": [
        "node",
        "~/.claude/skills/produce/scripts/produce.mjs",
        "url",
        "{{project}}",
        "--variant",
        "{{variant}}"
      ],
      "regex": "captions\\s+(https?://\\S+)"
    },
    "archive_url": {
      "argv": [
        "node",
        "~/.claude/skills/produce/scripts/produce.mjs",
        "url",
        "{{project}}",
        "--variant",
        "{{variant}}"
      ],
      "regex": "archive\\s+(https?://\\S+)"
    }
  },
  "drive": 0.8,
  "weight": 2,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "cdn stage",
      "ship to the cdn",
      "upload the master"
    ],
    "ar": [
      "مرحلة الرفع",
      "ارفع إلى السي دي ان"
    ]
  },
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Ship the approved version of one variant to the CDN and verify the public address.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Stage: 13 cdn (per variant)

## References
- Public address after shipping: {{video_url}}
- Poster: {{poster_url}} · captions: {{captions_url}}

## Constraints
- Only after the version gate is approved for this exact version; `produce status {{project}}` shows it. If it is not, stop.
- Run `produce ship {{project}} --variant {{variant}} --dry-run` first, then without the flag.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Open the public address and confirm the file plays, the poster loads and the captions load; report the three links and the archive link ({{archive_url}}).
- `ship` records the stage; do not call `advance` by hand.
