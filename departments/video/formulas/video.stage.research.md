---
{
  "id": "video.stage.research",
  "label": {
    "en": "Research",
    "ar": "البحث"
  },
  "icon": "Search",
  "when": {
    "intent": "work the research stage",
    "project": "open",
    "stage": "research"
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
    "project_dir": {
      "context": "project.dir"
    },
    "product_domain": {
      "json": "content/media/brand-kit.json",
      "path": "brands.{{repo}}.domain"
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
      "research stage",
      "product research"
    ],
    "ar": [
      "مرحلة البحث",
      "بحث المنتج"
    ]
  }
}
---

## Task
Write the product research for the film: what the product really does, what the viewer already believes, and which claims are safe.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Audience: {{audience}} · goal: {{goal}}
- Stage: 02 research (shared by every variant)

## References
- Project folder: {{project_dir}} (read `01-brief/request.json` and any `02-research/reference/`)
- Product: {{product_domain}} and the product docs in the {{repo}} repo
- Real captures: ~/media/{{repo}}/
- Markets: {{markets_url}}
- Locked spec: `{{project_dir}}/00-plan/02-research.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- Product claims come only from real captures or the product docs; mark each claim with its source.
- Competitor and reference material is read, never copied.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/02-research/product-research.md`.
- Sections: the product in plain words · the viewer's problem · claims that are safe and their sources · claims to avoid · references worth following · open questions.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} research --file <02-research/product-research.md>`.
