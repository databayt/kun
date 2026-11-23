---
{
  "id": "video.stage.request",
  "label": {
    "en": "Open the project",
    "ar": "فتح المشروع"
  },
  "icon": "FilePlus",
  "when": {
    "intent": "work the request stage",
    "project": "open",
    "stage": "request"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "project_dir": {
      "context": "project.dir"
    },
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
    "subject": {
      "choice": [
        "introduction",
        "onboarding",
        "timetable",
        "attendance",
        "exams",
        "fees"
      ],
      "default": "introduction"
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
    "markets": {
      "choice": [
        "sa,ae,eg,sd,rw",
        "sd",
        "sa,ae"
      ],
      "default": "sa,ae,eg,sd,rw"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    }
  },
  "drive": 0.8,
  "weight": 1,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "request stage",
      "open the project",
      "create the project"
    ],
    "ar": [
      "مرحلة الطلب",
      "افتح المشروع",
      "انشئ المشروع"
    ]
  }
}
---

## Task
Open the production project for the {{film_label}} of {{brand}}: create it with `produce init` so the 14-stage ledger exists before any work starts.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Production line: {{line}} · category: {{film_type}} · subject: {{subject}}
- Audience: {{audience}}
- Goal: {{goal}}
- Markets: {{markets}} · languages: ar, en
- Stage: 01 request, the first of 14

## References
- Ledger: `~/.claude/skills/produce/scripts/produce.mjs` (its header lists every command)
- Markets: {{markets_url}}
- Brand kit: {{brand_kit_url}}
- Locked spec: `{{project_dir}}/00-plan/01-request.spec.md` (once the line is locked; the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- Run `produce list --json --repo {{line}}` first. If an open project already covers this category and subject, stop and report it; never create a second one.
- One project per film. Market versions are variants inside it, not separate projects.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- The locked spec exists only once the line is locked (accepting the plan, or `produce lock <ID> --all`); when it is there, follow it. Do not stop for its absence.

## Deliverable
- Run `node ~/.claude/skills/produce/scripts/produce.mjs init --brand {{line}} --category {{film_type}} --subject {{subject}} --lang ar,en --markets {{markets}} --audience "{{audience}}" --objective "{{goal}}"`.
- Deliverable: `01-brief/request.json` in the new project folder under ~/media/_projects/; `init` marks the stage done.
- Report the project ID and the predicted CDN URLs (`produce url <ID>`). No gate on this stage.
