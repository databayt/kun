---
{
  "id": "video.stage.brief",
  "label": {
    "en": "Creative brief",
    "ar": "الملخص الإبداعي"
  },
  "icon": "FileText",
  "when": {
    "intent": "work the brief stage",
    "project": "open",
    "stage": "brief"
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
    "audience": {
      "choice": [
        "school owners and principals",
        "teachers",
        "parents"
      ],
      "default": "school owners and principals",
      "q": {
        "en": "Who is it for?",
        "ar": "لمن هذا الفيلم؟"
      },
      "choice_ar": [
        "ملاك المدارس ومديروها",
        "المعلمون",
        "أولياء الأمور"
      ]
    },
    "goal": {
      "choice": [
        "the viewer books the free first month",
        "the viewer asks for a demo",
        "the viewer understands one feature"
      ],
      "default": "the viewer books the free first month",
      "q": {
        "en": "What should the viewer do after watching?",
        "ar": "ماذا نريد من المشاهد بعد المشاهدة؟"
      },
      "choice_ar": [
        "يحجز الشهر الأول المجاني",
        "يطلب عرضًا تجريبيًا",
        "يفهم ميزة واحدة"
      ]
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
    "length": {
      "choice": [
        "about 2:00",
        "about 1:00",
        "about 0:30"
      ],
      "default": "about 2:00",
      "q": {
        "en": "How long should it be?",
        "ar": "ما مدة الفيلم؟"
      },
      "choice_ar": [
        "نحو دقيقتين",
        "نحو دقيقة",
        "نحو نصف دقيقة"
      ]
    },
    "project_dir": {
      "context": "project.dir"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    }
  },
  "drive": 0.8,
  "weight": 2,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "brief stage",
      "creative brief"
    ],
    "ar": [
      "مرحلة الملخص",
      "الملخص الإبداعي"
    ]
  },
  "order": [
    "audience",
    "goal",
    "platform",
    "format",
    "length"
  ]
}
---

## Task
Write the creative brief that the script and every later stage will follow.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Audience: {{audience}} · goal: {{goal}}
- Destination: {{platform}} · {{format}} · {{length}}
- Stage: 03 brief (shared by every variant)

## References
- Research: `{{project_dir}}/02-research/product-research.md`
- Brand kit: {{brand_kit_url}}
- Markets: {{markets_url}}

## Constraints
- One message, one call to action. Anything that does not serve the goal is cut.
- Tone from the brand kit; the viewer sees the brand name exactly as written there.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.

## Deliverable
- Deliverable file: `{{project_dir}}/01-brief/creative-brief.md`.
- Sections: the one message · the viewer and what they do after · structure (for example problem → proof → call to action) · tone and visual language · must-show and must-not-show · length and destination · the versions (markets and languages) with price and currency.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} brief --file <01-brief/creative-brief.md>`.
