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
    "brand_ar": {
      "map": {
        "Balqalam": "بالقلم",
        "Hogwarts": "هوغورتس",
        "Mkan": "مكان",
        "Databayt": "داتابايت"
      },
      "of": "brand"
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
        "WhatsApp",
        "YouTube"
      ],
      "default": "Facebook",
      "q": {
        "en": "Where will it be posted?",
        "ar": "أين سيُنشر؟"
      },
      "choice_ar": [
        "فيسبوك",
        "إنستغرام",
        "واتساب",
        "يوتيوب"
      ]
    },
    "settings": { "value": "as in the film request" },
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
    },
    "cut": {
      "options": [
        {
          "value": "film-2min-facebook",
          "label": {
            "en": "2-minute film · Facebook · 9:16",
            "ar": "فيلم دقيقتين · فيسبوك · 9:16"
          },
          "sets": {
            "platform": "Facebook",
            "format": "vertical 9:16, mobile",
            "length": "about 2:00"
          }
        },
        {
          "value": "reel-1min-instagram",
          "label": {
            "en": "1-minute reel · Instagram/Facebook · 9:16",
            "ar": "مقطع دقيقة · إنستغرام/فيسبوك · 9:16"
          },
          "sets": {
            "platform": "Instagram",
            "format": "vertical 9:16, mobile",
            "length": "about 1:00"
          }
        },
        {
          "value": "ad-30s-facebook",
          "label": {
            "en": "30-second ad · Facebook · 9:16",
            "ar": "إعلان نصف دقيقة · فيسبوك · 9:16"
          },
          "sets": {
            "platform": "Facebook",
            "format": "vertical 9:16, mobile",
            "length": "about 0:30"
          }
        },
        {
          "value": "film-2min-youtube",
          "label": {
            "en": "2-minute film · YouTube · 16:9",
            "ar": "فيلم دقيقتين · يوتيوب · 16:9"
          },
          "sets": {
            "platform": "YouTube",
            "format": "horizontal 16:9, desktop",
            "length": "about 2:00"
          }
        }
      ],
      "q": {
        "en": "What kind of cut?",
        "ar": "ما نوع النسخة؟"
      }
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
    "cut"
  ],
  "intro": {
    "en": "The creative brief for the {{brand}} film: one message, one call to action. Three quick questions to shape it.",
    "ar": "الملخص الإبداعي لفيلم {{brand_ar}}: رسالة واحدة ودعوة واحدة. ثلاثة أسئلة سريعة لنضبطه."
  }
}
---

## Task
Write the creative brief that the script and every later stage will follow.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Audience: {{audience}} · goal: {{goal}}
- Destination: {{platform}} · {{format}} · {{length}}
- Video settings: {{settings}}
- Stage: 03 brief (shared by every variant)

## References
- Research: `{{project_dir}}/02-research/product-research.md`
- Brand kit: {{brand_kit_url}}
- Markets: {{markets_url}}
- Locked spec: `{{project_dir}}/00-plan/03-brief.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- One message, one call to action. Anything that does not serve the goal is cut.
- Tone from the brand kit; the viewer sees the brand name exactly as written there.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/01-brief/creative-brief.md`.
- Sections: the one message · the viewer and what they do after · structure (for example problem → proof → call to action) · tone and visual language · must-show and must-not-show · length and destination · the versions (markets and languages) with price and currency.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} brief --file <01-brief/creative-brief.md>`.
