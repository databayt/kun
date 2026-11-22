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
    "brand_ar": {
      "map": {
        "Balqalam": "بالقلم",
        "Hogwarts": "هوغورتس",
        "Mkan": "مكان",
        "Databayt": "داتابايت"
      },
      "of": "brand"
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
      "default": "sd",
      "q": {
        "en": "Which market?",
        "ar": "لأي سوق؟"
      }
    },
    "lang": {
      "choice": [
        "ar",
        "en"
      ],
      "default": "ar"
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
    },
    "source": {
      "ask": "the path of the source video, e.g. ~/Downloads/balqalam-promo-v2.mp4 (optional)",
      "default": "none",
      "q": {
        "en": "Which source video?",
        "ar": "أي فيديو مصدر؟"
      }
    },
    "identity": {
      "map": {
        "Balqalam": "balqalam",
        "Hogwarts": "hogwarts",
        "Mkan": "mkan",
        "Databayt": "databayt"
      },
      "of": "brand"
    },
    "projects": {
      "exec": "projects",
      "with": {
        "line": "{{line}}"
      },
      "default": "none open"
    },
    "why": {
      "context": "company.why",
      "default": "cash flow first: a film earns its place only if it moves a school toward paying"
    }
  },
  "drive": 1,
  "weight": 1,
  "role": "start",
  "board": true,
  "record": "film",
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
  },
  "order": [
    "audience",
    "market",
    "cut"
  ],
  "model": "opus",
  "effort": "high",
  "intro": {
    "en": "An intro film for {{brand}}, made from real app screens. Three quick questions to shape it.",
    "ar": "فيلم تعريفي ل{{brand_ar}} من شاشات حقيقية للتطبيق. ثلاثة أسئلة سريعة لنضبطه."
  }
}
---

## Task
Plan a new {{film_label}} for {{brand}} ({{repo}}) in two turns: first ask the questions that change the film, then, once the answers come back, write the plan. Plan only; change nothing.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Audience: {{audience}}
- Goal: {{goal}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per year
- Destination: {{platform}} · {{format}} · {{length}}
- Source video: {{source}}
- Open projects ({{line}} line): {{projects}}
- Why this film: {{why}}
- Today: {{today}}. If an open project above matches this film type, say so and propose continuing it instead.

## References
- Open projects: already listed in Context, so do not run `produce list`. For a match, run `node ~/.claude/skills/produce/scripts/produce.mjs status <ID> --json` and read its project folder (reference video, transcript, script, asset manifest).
- If a source video is given, it is the script and the voiceover; plan the picture over its timing.
- Brand kit (identity): {{brand_kit_url}}
- Markets (price, currency, dialect): {{markets_url}}
- Real captures: look in ~/media/{{repo}}/ before proposing any new capture.
- Reference film: the latest video the team approved in the WhatsApp group «المدرسة 2.0», raised to a cinematic level with 3D characters. A WhatsApp video is pulled with `wa-pull.py` and seeded with `produce from-reference <ID> <video>`; both are actions that need the person's yes first.

## Constraints
- Gather read-only first and say in one line what you read. Do not create a project, render, or call any tool that writes.
- List every action that needs the person's yes under "actions I need your OK for", each with its exact command.
- Reply in English; the film's version language applies only to the film's own words.
- Write the plan in your reply only; do not write a plan file.

## Deliverable
**Turn 1: questions only.** After the read-only gathering, write one line saying what you read and what you found (an existing project, the reference status), then end the turn with a `kun-questions` block (the protocol in CLAUDE.md): up to three questions that change the film, each option a real choice, the recommended option first with "(Recommended)" at the end of its label. No brief, no journey and no plan in this turn. Never write the questions as prose.

**Turn 2, after the answers:** if an answer opens a new question that changes the film, ask it the same way. Otherwise write the plan:
- The brief in one line: what · for whom · which version · the goal · the destination.
- The journey as a numbered list: stage → tool → lane → gate → what is reused. Stages run request, research, brief, script, storyboard, assets, visual, audio, edit, render, qa, approval, cdn, publish; gates are script · look · version · publish.
- The actions that need the person's yes, each with its exact command. If a source video is given (not `none`), the first step is `node ~/.claude/skills/produce/scripts/produce.mjs init --brand {{line}} --identity {{identity}} --category {{film_type}} --subject <slug> --lang {{lang}} --markets {{market}}`, then `node ~/.claude/skills/produce/scripts/produce.mjs from-reference <ID> {{source}} --voiceover`.
- The first step and what it produces, ending with the question "Shall I start with …?".
