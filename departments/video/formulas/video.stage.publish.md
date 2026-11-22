---
{
  "id": "video.stage.publish",
  "label": {
    "en": "Publish package",
    "ar": "حزمة النشر"
  },
  "icon": "Send",
  "when": {
    "intent": "work the publish stage",
    "project": "open",
    "stage": "publish"
  },
  "route": "do",
  "gate": "publish",
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
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    },
    "project_dir": {
      "context": "project.dir"
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
      "publish stage",
      "prepare the publishing package"
    ],
    "ar": [
      "مرحلة النشر",
      "جهّز حزمة النشر"
    ]
  }
}
---

## Task
Prepare the publishing package of one variant for the destination and stop at the publish gate. Do not post.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per month
- Destination: {{platform}} · {{format}}
- Stage: 14 publish (per variant). Gate: publish

## References
- Public video: {{video_url}}
- Poster: {{poster_url}} · captions: {{captions_url}}
- Brand kit: {{brand_kit_url}}

## Constraints
- Nothing is posted without a recorded publish approval naming the destination.
- Caption, hashtags and link follow the brand kit; the price and currency match the market.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Deliverable file: `{{project_dir}}/10-publishing/publishing-record.md`.
- The caption in the version's language, the hashtags, the link and the schedule suggestion.
- Stop at the publish gate: give the exact command the person would run: `produce approve {{project}} --gate publish --version {{version}} --destination {{platform}} --by <login>`. Never run it, and never post.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} publish --file <10-publishing/publishing-record.md> --variant {{variant}}`.
