---
{
  "id": "video.stage.assets",
  "label": {
    "en": "Assets",
    "ar": "الأصول"
  },
  "icon": "Images",
  "when": {
    "intent": "work the assets stage",
    "project": "open",
    "stage": "assets"
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
    "project_dir": {
      "context": "project.dir"
    },
    "product_domain": {
      "json": "content/media/brand-kit.json",
      "path": "brands.{{repo}}.domain"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    }
  },
  "drive": 0.8,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "assets stage",
      "gather the assets"
    ],
    "ar": [
      "مرحلة الأصول",
      "جهّز الأصول"
    ]
  },
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Gather every asset the shot list needs: real captures, graphics, stills and sounds, each with its source and licence.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Stage: 06 assets

## References
- Shot list: `{{project_dir}}/04-storyboard/shot-list.json`
- Existing captures: ~/media/{{repo}}/ (reuse before you capture)
- Product: {{product_domain}}
- Brand kit: {{brand_kit_url}}
- Locked spec: `{{project_dir}}/00-plan/06-assets.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- Real captures use the `shoot` and `record` skills with demo data only: fake devices, camera permission denied, no real student or parent data.
- Licensed fonts and assets are never committed or rehosted.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/05-assets/asset-manifest.json`.
- Every asset is listed with its path, source, licence and the scene that uses it. Anything missing is listed as a request, with the order formula that would cover it (capture, Blender, voice).
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} assets --file <05-assets/asset-manifest.json>`.
