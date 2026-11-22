---
{
  "id": "video.order.script",
  "label": {
    "en": "Script writing",
    "ar": "كتابة سكربت"
  },
  "icon": "ScrollText",
  "when": {
    "intent": "hand a script piece of the film to one person",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or piece this order covers, e.g. the classroom scene"
    },
    "language": {
      "map": {
        "ar": "Arabic",
        "en": "English"
      },
      "of": "lang"
    },
    "market_name": {
      "json": "content/media/markets.json",
      "path": "{{market}}.name.en"
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
    "brief_url": {
      "ref": "01-brief/creative-brief.md"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    },
    "scene_slug": {
      "slug": "scene"
    },
    "lang": {
      "choice": [
        "ar",
        "en"
      ],
      "default": "ar"
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
    }
  },
  "drive": 0.6,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "script order",
      "give the script to",
      "write the script for someone"
    ],
    "ar": [
      "اطلب سكربت",
      "اعط السكربت",
      "اكتب السكربت لشخص"
    ]
  }
}
---

## Task
Write the script for {{scene}} of the film, in {{language}} in the {{market_name}} dialect, and return it for review.

## Context
- Work order: Script writing, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price, if spoken: {{price}} {{currency}} per student per month

## References
- Script: {{script_url}}
- Shot list: {{shotlist_url}}
- Brand kit: {{brand_kit_url}}
- Brief: {{brief_url}}
- Markets: {{markets_url}}

## Constraints
- Follow the brief and the shot list; keep to the time the shot list gives this piece.
- Write for the ear: short sentences, numbers and currency as the viewer says them.
- State for every line whether its picture is a real capture or illustrative.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- `{{scene_slug}}-script.md`: a table of time · picture · voiceover, then the call to action.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, what is left, anything they must know.
