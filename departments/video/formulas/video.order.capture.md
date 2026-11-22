---
{
  "id": "video.order.capture",
  "label": {
    "en": "Product capture",
    "ar": "تصوير المنتج"
  },
  "icon": "Camera",
  "when": {
    "intent": "hand a capture piece of the film to one person",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "flow": {
      "ask": "the product flow to capture, e.g. take attendance"
    },
    "to": {
      "ask": "the login of the person this order is for, e.g. sedon"
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
    "scene": {
      "ask": "the scene or piece this order covers, e.g. the classroom scene"
    },
    "flow_slug": {
      "slug": "flow"
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
    "assets_url": {
      "ref": "05-assets/asset-manifest.json"
    }
  },
  "drive": 0.6,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "capture order",
      "give the capture to",
      "record the flow",
      "screen capture order"
    ],
    "ar": [
      "اطلب تصوير",
      "تصوير الشاشة",
      "سجل التدفق",
      "اعط التصوير"
    ]
  }
}
---

## Task
Capture the product flow "{{flow}}" as real screen footage for the film.

## Context
- Work order: Product capture, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Flow: {{flow}} (file name `{{flow_slug}}`)
- Format: vertical 9:16 phone frame, Arabic interface, 60 fps if you can

## References
- Script: {{script_url}}
- Shot list: {{shotlist_url}}
- Brand kit: {{brand_kit_url}}
- Product to capture: {{product_domain}}
- Assets list: {{assets_url}}

## Constraints
- Use a demo school and demo data only: no real student, parent or staff name, photo or phone number appears on any frame.
- Never the real camera: fake devices, camera and microphone permissions denied.
- Walk the flow once cleanly with no cursor jitter, then once slowly for editing.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- `{{flow_slug}}-ar.mp4` and, if the flow has a result screen, a still `{{flow_slug}}-ar.png`.
- A two-line note listing the steps in order.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, what is left, anything they must know.
