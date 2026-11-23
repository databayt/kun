---
{
  "id": "video.order.motion",
  "label": {
    "en": "Motion graphic",
    "ar": "رسم متحرك"
  },
  "icon": "Sparkles",
  "when": {
    "intent": "hand one motion-graphics piece (title card, counter, price card, end card) to one person or agent",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the card or piece this order covers, e.g. the price card or the end card",
      "q": {
        "en": "Which motion graphic is this order for?",
        "ar": "لأي رسم متحرك هذا الطلب؟"
      }
    },
    "to": {
      "ask": "the login of the person or agent this order is for, e.g. sedon",
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
    "shotlist_url": {
      "ref": "04-storyboard/shot-list.json"
    },
    "script_url": {
      "ref": "03-script/script.md"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    },
    "palette": {
      "brand": "{{brand}}",
      "field": "palette"
    },
    "fonts": {
      "brand": "{{brand}}",
      "field": "fonts"
    },
    "logo": {
      "brand": "{{brand}}",
      "field": "logo"
    },
    "direction": {
      "brand": "{{brand}}",
      "field": "direction",
      "default": "as the brand kit says"
    },
    "scene_slug": {
      "slug": "scene"
    }
  },
  "drive": 0.6,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "motion order",
      "give the motion graphic to",
      "motion graphic order",
      "title card order",
      "end card order"
    ],
    "ar": [
      "اطلب رسم متحرك",
      "اعط الرسم المتحرك",
      "بطاقة العنوان",
      "بطاقة النهاية"
    ]
  },
  "order": [
    "scene",
    "to"
  ],
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Build {{scene}} as a motion-graphics piece with HyperFrames and render it, on your own machine.

## Context
- Work order: Motion graphic, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}} (a title card, counter, price card or end card)
- Tool: HyperFrames, through `hf.sh` of the kun repo's edit skill (`.claude/skills/edit/scripts/hf.sh`: `check`, then `render`)
- Format: vertical 9:16, 1080×1920, 30 fps; transparent, or on the brand canvas when the shot list says so
- Look: {{direction}}
- Palette: {{palette}}
- Type: {{fonts}}
- Logo: {{logo}}

## References
- Script: {{script_url}} (the real copy of this piece comes from here, word for word)
- Shot list: {{shotlist_url}} (timing and place in the film)
- Brand kit: {{brand_kit_url}}

## Constraints
- Copy is the script's, never invented. Numbers, price and currency match the market in the script.
- Colour every element from the palette above, by hex; type follows the fonts above; never a licensed font that is not already in the kit.
- Arabic is shaped and checked right-to-left on every frame: connected letters, the right reading order, numerals as the script writes them.
- Run `hf.sh check` before `hf.sh render`, and look at frames of the render, not only the composition.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- The render and its project folder `{{scene_slug}}/` (composition, assets, `renders/`), saved by the film under the folder `graphics/{{scene_slug}}/` of its assets.
- A short note: duration, transparent or on canvas, fonts used, and the frames you checked for Arabic shaping.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, how many tries it took, anything they must know.
