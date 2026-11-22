---
{
  "id": "video.order.review",
  "label": {
    "en": "Review of a version",
    "ar": "مراجعة نسخة"
  },
  "icon": "Eye",
  "when": {
    "intent": "hand a review piece of the film to one person",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or piece this order covers, e.g. the classroom scene"
    },
    "to": {
      "ask": "the login of the person this order is for, e.g. sedon"
    },
    "login": {
      "context": "login"
    },
    "project": {
      "context": "project.id"
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
    "script_url": {
      "ref": "03-script/script.md"
    },
    "shotlist_url": {
      "ref": "04-storyboard/shot-list.json"
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
    "scene_slug": {
      "slug": "scene"
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
    },
    "variant": {
      "context": "project.focus.0"
    }
  },
  "drive": 0.6,
  "weight": 2,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "review order",
      "give the review to",
      "review the version for someone"
    ],
    "ar": [
      "اطلب مراجعة",
      "اعط المراجعة",
      "راجع النسخة لشخص"
    ]
  }
}
---

## Task
Review {{scene}} of the film against the checklist and report what passes and what does not. You approve nothing.

## Context
- Work order: Review of a version, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Version under review: {{market_name}} · {{language}} · {{dialect}} dialect
- Price on screen must read: {{price}} {{currency}}

## References
- Script: {{script_url}}
- Shot list: {{shotlist_url}}
- Brand kit: {{brand_kit_url}}
- The version to watch: {{video_url}}
- Captions: {{captions_url}}

## Constraints
- Check: Arabic shaping and text direction, captions in sync, brand name and colours, safe areas, the price and currency, claims shown only from real captures, and that no real student or parent appears.
- Report every problem with its timecode; do not rewrite the film.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- `review-{{scene_slug}}.md`: a table of check · pass or fail · timecode · note, then your recommendation (ready for approval, or the stage to redo).
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, what is left, anything they must know.
