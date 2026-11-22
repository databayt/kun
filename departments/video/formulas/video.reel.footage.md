---
{
  "id": "video.reel.footage",
  "label": {
    "en": "Reel from a video",
    "ar": "ريلز من فيديو"
  },
  "icon": "Scissors",
  "when": {
    "intent": "cut a short reel from footage that already exists"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "reel_length": {
      "choice": [
        "30 seconds",
        "45 seconds",
        "60 seconds"
      ],
      "default": "45 seconds",
      "q": {
        "en": "How long should the reel be?",
        "ar": "ما مدة المقطع؟"
      },
      "choice_ar": [
        "30 ثانية",
        "45 ثانية",
        "60 ثانية"
      ]
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
    "latest_video": {
      "context": "media.latest_video"
    },
    "platform": {
      "choice": [
        "Facebook",
        "Instagram",
        "WhatsApp"
      ],
      "default": "Facebook",
      "q": {
        "en": "Where will it be posted?",
        "ar": "أين سيُنشر؟"
      },
      "choice_ar": [
        "فيسبوك",
        "إنستغرام",
        "واتساب"
      ]
    },
    "format": {
      "choice": [
        "vertical 9:16, mobile",
        "square 1:1, mobile",
        "horizontal 16:9, desktop"
      ],
      "default": "vertical 9:16, mobile",
      "q": {
        "en": "Which screen shape?",
        "ar": "ما شكل الشاشة؟"
      },
      "choice_ar": [
        "عمودي 9:16 للجوال",
        "مربع 1:1 للجوال",
        "أفقي 16:9 للحاسوب"
      ]
    },
    "today": {
      "context": "today"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    }
  },
  "drive": 0.4,
  "weight": 2,
  "role": "start",
  "board": true,
  "record": "none",
  "needs": [
    "tools"
  ],
  "triggers": {
    "en": [
      "reel",
      "cut a reel",
      "short clip",
      "cut the video",
      "captions on a video"
    ],
    "ar": [
      "ريلز",
      "قص الفيديو",
      "اقطع فيديو",
      "مقطع قصير",
      "ترجمة الفيديو"
    ]
  },
  "order": [
    "reel_length",
    "platform",
    "format"
  ]
}
---

## Task
Cut a reel of about {{reel_length}} from the latest video in the work folder, with Arabic captions.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Source: the latest video in the work folder, `{{latest_video}}`
- Output: {{platform}} · {{format}} · {{reel_length}}
- Today: {{today}}

## References
- Source video: `{{latest_video}}`
- Brand kit: {{brand_kit_url}}
- Tools: the `edit` skill (FilmCraft, `media.sh`, whisper for the transcript)

## Constraints
- Transcribe first and choose the cut from the transcript: the strongest self-contained moment, silences removed.
- Arabic captions, RTL shaping checked; burn them in only at export.
- No real student or parent faces or names; blur or skip the shot.

## Deliverable
- The reel under ~/media/ next to the source, named `<source>-reel-ar.mp4`, overwriting any earlier reel of the same source.
- A short note: the time range cut, why that moment, and what was checked.
