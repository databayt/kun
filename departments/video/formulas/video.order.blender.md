---
{
  "id": "video.order.blender",
  "label": {
    "en": "Blender scene",
    "ar": "مشهد بلندر"
  },
  "icon": "Box",
  "when": {
    "intent": "hand a blender piece of the film to one person",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or piece this order covers, e.g. the classroom scene",
      "q": {
        "en": "Which scene or piece is this order for?",
        "ar": "لأي مشهد أو جزء هذا الطلب؟"
      }
    },
    "to": {
      "ask": "the login of the person this order is for, e.g. sedon",
      "q": {
        "en": "Who is it for? (their login)",
        "ar": "لمن هذا الطلب؟ (اسم الدخول)"
      }
    },
    "login": {
      "context": "login"
    },
    "project": {
      "context": "project.id"
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
    "script_url": {
      "ref": "03-script/script.md"
    },
    "shotlist_url": {
      "ref": "04-storyboard/shot-list.json"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    },
    "product_domain": {
      "json": "content/media/brand-kit.json",
      "path": "brands.{{repo}}.domain"
    },
    "scene_slug": {
      "slug": "scene"
    }
  },
  "drive": 0.6,
  "weight": 5,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "blender order",
      "give the scene to",
      "build the scene in blender",
      "blender scene"
    ],
    "ar": [
      "اطلب بلندر",
      "مشهد بلندر",
      "اعط المشهد",
      "ابني المشهد في بلندر"
    ]
  },
  "order": [
    "scene",
    "to"
  ]
}
---

## Task
Build {{scene}} in Blender from the shot list and render a preview, on your own machine.

## Context
- Work order: Blender scene, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Format: vertical 9:16, 1080×1920, 30 fps

## References
- Script: {{script_url}}
- Shot list: {{shotlist_url}}
- Brand kit: {{brand_kit_url}}
- Product look to match: {{product_domain}}

## Constraints
- Match the shot list for this scene: camera, timing, props and characters; phone and laptop screens show real captures only, supplied on the issue.
- Characters and places are illustrative: mark them so in the file's notes.
- Use the brand colours and type from the brand kit; never a licensed font that is not already in the kit.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- The .blend file `{{scene_slug}}.blend` (packed textures, no absolute paths) and a preview render `{{scene_slug}}-preview.mp4`.
- Note in the reply the Blender version and any add-on you used.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, what is left, anything they must know.
