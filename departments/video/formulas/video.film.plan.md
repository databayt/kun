---
{
  "id": "video.film.plan",
  "label": {
    "en": "Intro film",
    "ar": "فيلم تعريفي"
  },
  "icon": "Film",
  "when": {
    "intent": "a new film, nothing started yet for this category",
    "project": "any"
  },
  "route": "plan",
  "gate": null,
  "slots": {
    "film_label": {
      "map": {
        "intro": "intro film",
        "promo": "promo film",
        "explainer": "explainer",
        "tutorial": "tutorial",
        "feature": "feature film"
      },
      "of": "film_type"
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
    "repo": {
      "context": "repo",
      "default": "hogwarts"
    },
    "audience": {
      "choice": [
        "school owners and principals",
        "teachers",
        "parents"
      ],
      "default": "school owners and principals"
    },
    "goal": {
      "choice": [
        "the viewer books the free first month",
        "the viewer asks for a demo",
        "the viewer understands one feature"
      ],
      "default": "the viewer books the free first month"
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
    "length": {
      "choice": [
        "about 2:00",
        "about 1:00",
        "about 0:30"
      ],
      "default": "about 2:00"
    },
    "today": {
      "context": "today"
    },
    "line": {
      "choice": [
        "hogwarts",
        "mkan",
        "databayt"
      ],
      "default_by_repo": {
        "hogwarts": "hogwarts",
        "mkan": "mkan",
        "kun": "databayt"
      },
      "default": "hogwarts"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    },
    "film_type": {
      "choice": [
        "intro",
        "promo",
        "explainer",
        "tutorial",
        "feature"
      ],
      "default": "intro"
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
  "drive": 1,
  "weight": 1,
  "role": "start",
  "board": true,
  "record": "none",
  "redirects": {
    "to": "video.stage.{stage}",
    "if": "open_project_same_type"
  },
  "triggers": {
    "en": [
      "intro film",
      "new film",
      "new video",
      "make a video",
      "promo video",
      "explainer video",
      "plan a film",
      "plan a video"
    ],
    "ar": [
      "فيديو تعريفي",
      "فيلم تعريفي",
      "فيديو جديد",
      "فيلم جديد",
      "فيديو ترويجي",
      "انتاج فيديو",
      "فيديو شرح",
      "خطط فيديو"
    ]
  }
}
---

## Task
Plan a new {{film_label}} for {{brand}} ({{repo}}): the brief in one line, the questions that change the film, the journey and the first step. Plan only; change nothing.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Audience: {{audience}}
- Goal: {{goal}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per year
- Destination: {{platform}} · {{format}} · {{length}}
- Today: {{today}}. Project: none yet for this film type, unless `produce list` below shows one; if it does, say so and propose continuing it instead.

## References
- Open projects: run `node ~/.claude/skills/produce/scripts/produce.mjs list --json --repo {{line}}`, then `status <ID>` for any match. Read the project folder (reference video, transcript, script, asset manifest).
- Brand kit (identity): {{brand_kit_url}}
- Markets (price, currency, dialect): {{markets_url}}
- Real captures: look in ~/media/{{repo}}/ before proposing any new capture.
- Reference film: the latest video the team approved in the WhatsApp group «المدرسة 2.0», raised to a cinematic level with 3D characters. A WhatsApp video is pulled with `wa-pull.py` and seeded with `produce from-reference <ID> <video>`; both are actions that need the person's yes first.

## Constraints
- Gather read-only first and say in one line what you read. Do not create a project, render, or call any tool that writes.
- List every action that needs the person's yes under "actions I need your OK for", each with its exact command.
- Answer the person in their own language; this prompt stays English.

## Deliverable
- The brief in one line: what · for whom · which version · the goal · the destination.
- Three questions that change the film, each with a recommended answer the person can accept with "yes".
- The journey as a numbered list: stage → tool → lane → gate → what is reused. Stages run request, research, brief, script, storyboard, assets, visual, audio, edit, render, qa, approval, cdn, publish; gates are script · look · version · publish.
- The first step and what it produces, ending with the question "Shall I start with …?".
