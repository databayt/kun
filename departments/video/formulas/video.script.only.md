---
{
  "id": "video.script.only",
  "label": {
    "en": "Video script",
    "ar": "سكربت فيديو"
  },
  "icon": "ScrollText",
  "when": {
    "intent": "only a short script, no production project"
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
    "audience": {
      "choice": [
        "school owners and principals",
        "teachers",
        "parents"
      ],
      "default": "school owners and principals"
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
    "format": {
      "choice": [
        "vertical 9:16, mobile",
        "square 1:1, mobile",
        "horizontal 16:9, desktop"
      ],
      "default": "vertical 9:16, mobile"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    },
    "product_domain": {
      "json": "content/media/brand-kit.json",
      "path": "brands.{{repo}}.domain"
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
  "drive": 0.5,
  "weight": 1,
  "role": "start",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "video script",
      "write a script",
      "script only",
      "script for a video",
      "voiceover script"
    ],
    "ar": [
      "سكربت فيديو",
      "اكتب سكربت",
      "سكربت فقط",
      "سكربت ٦٠ ثانية"
    ]
  }
}
---

## Task
Write a 60-second video script for one {{repo}} feature: the idea, the shots and the voiceover.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Audience: {{audience}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price, if the script mentions it: {{price}} {{currency}} per student per month
- Destination: {{platform}} · {{format}}

## References
- Brand kit: {{brand_kit_url}}
- Markets: {{markets_url}}
- Product: {{product_domain}} and the product docs in the {{repo}} repo; real captures in ~/media/{{repo}}/

## Constraints
- Pick one feature the product really has and say which doc or capture proves it.
- Write for the ear, in {{language}}, in the market's dialect.
- This is a script only: do not create a production project.

## Deliverable
- The idea in one line · a shot table (time · what is shown · real capture or illustrative) · the voiceover, line by line · the call to action.
