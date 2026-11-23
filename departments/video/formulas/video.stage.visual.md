---
{
  "id": "video.stage.visual",
  "label": {
    "en": "Visuals",
    "ar": "المرئيات"
  },
  "icon": "Box",
  "when": {
    "intent": "work the visual stage",
    "project": "open",
    "stage": "visual"
  },
  "route": "do",
  "gate": "look",
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
    "platform": {
      "choice": [
        "Facebook",
        "Instagram",
        "WhatsApp"
      ],
      "default": "Facebook"
    },
    "settings": { "value": "as in the film request" },
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
    "project_dir": {
      "context": "project.dir"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    }
  },
  "drive": 0.8,
  "weight": 5,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "visual stage",
      "build the visuals",
      "blender scenes"
    ],
    "ar": [
      "مرحلة المرئيات",
      "ابني المرئيات",
      "مشاهد بلندر"
    ]
  }
}
---

## Task
Produce the look of the film: cast, sets, camera moves and the keyframes or animatic, ready for the look review.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Destination: {{platform}} · {{format}} · {{length}}
- Video settings: {{settings}}
- Stage: 07 visual. Gate: look
- This is an expensive stage: the script must be signed first.

## References
- Shot list: `{{project_dir}}/04-storyboard/shot-list.json`
- Asset manifest: `{{project_dir}}/05-assets/asset-manifest.json`
- Brand kit: {{brand_kit_url}}
- Locked spec: `{{project_dir}}/00-plan/07-visual.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- Confirm the script is signed with `produce status {{project}}`; if not, stop.
- Blender work runs through `blender.sh` and the `blender` or `blender-lab` MCP; HyperFrames for motion type. Hand independent scenes to a sub-agent or a work order with a written brief.
- A cheap still before costly motion: the look gate is signed on hero stills (keyframes) of each key scene before any clip is generated or any full 3D render runs. Motion and renders follow only after the look is approved.
- Phone screens show real captures only.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/06-production/visual-manifest.json`.
- Keyframes or an animatic with temporary voice under `{{project_dir}}/06-production/`, and the manifest listing every piece.
- Stop at the look gate: show the frames by path and ask the person for a clear yes. The person records it with `produce approve {{project}} --gate look --version {{version}} --by <login>`; never run it yourself.
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} visual --file <06-production/visual-manifest.json>`.
