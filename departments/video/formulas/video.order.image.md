---
{
  "id": "video.order.image",
  "label": {
    "en": "Image for ChatGPT",
    "ar": "صورة عبر ChatGPT"
  },
  "icon": "Image",
  "when": {
    "intent": "hand one generated image of the film to the person who holds the ChatGPT seat",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or shot this image is for, e.g. the principal's desk at 7 am",
      "q": {
        "en": "Which scene or shot is this image for?",
        "ar": "لأي مشهد أو لقطة هذه الصورة؟"
      }
    },
    "to": {
      "ask": "the login of the person who holds the ChatGPT seat, e.g. sedon",
      "q": {
        "en": "Who is it for? (their login)",
        "ar": "لمن هذا الطلب؟ (اسم الدخول)"
      }
    },
    "style": {
      "choice": [
        "minimal",
        "cinematic"
      ],
      "default": "minimal",
      "q": {
        "en": "Which style?",
        "ar": "أي أسلوب؟"
      },
      "choice_ar": [
        "بسيط",
        "سينمائي"
      ]
    },
    "style_prompt": {
      "map": {
        "minimal": "Editorial minimalism. Generous negative space, one clear subject, flat even light, no gradients or drop shadows, a restrained warm-neutral palette, a calm horizon, and room at the bottom-start corner for a mark to be placed later.",
        "cinematic": "Documentary photography. Natural window light, shallow depth of field, a muted warm grade, a candid unposed moment, real classroom or office texture, no studio lighting rig, no lens flare."
      },
      "of": "style"
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
    "direction": {
      "brand": "{{brand}}",
      "field": "direction",
      "default": "as the brand kit says"
    },
    "logo": {
      "brand": "{{brand}}",
      "field": "logo"
    },
    "scene_slug": {
      "slug": "scene"
    }
  },
  "drive": 0.6,
  "weight": 4,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "image order",
      "give the image to",
      "chatgpt image",
      "image for chatgpt",
      "generate the image for"
    ],
    "ar": [
      "اطلب صورة",
      "اعط الصورة",
      "صورة عبر شات جي بي تي",
      "ولد الصورة"
    ]
  },
  "order": [
    "scene",
    "to",
    "style"
  ],
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Make one image for {{scene}} with the ChatGPT seat, from the prompt below, and save it as `{{scene_slug}}.png`.

## Context
- Work order: Generated image, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Renderer: the ChatGPT seat (chatgpt.com). It is human-in-the-loop: there is no API key, so a person pastes the prompt and saves the file.
- Format: vertical 9:16, generated at 1088×1920 (both edges divide by 16), cropped to 1080×1920 afterwards.

## References
- Shot list: {{shotlist_url}}
- Script: {{script_url}}
- Brand kit: {{brand_kit_url}}
- Logo to attach as a reference image: {{logo}}
- Look: {{direction}}

## Constraints
- Open chatgpt.com, attach the logo file as a reference image, paste the prompt below as one message, and ask for 1088×1920. Do not edit the prompt.
- The model never draws the logo or any type: both are placed afterwards. If the picture shows letters or a logo, regenerate.
- Characters and places are illustrative: no real student, parent or staff face, and no real school name.
- One accent colour per image. If the palette drifts, regenerate rather than fix it by hand.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- The prompt to paste:

```
Create a vertical image, 1088×1920, for a film about a school management product.
Scene: {{scene}}. Match the scene's shot in the attached shot list when one exists.
Style: {{style_prompt}}
Palette (use these hex values): {{palette}}. One accent only; no gradients, no glow, no neon.
No text, no letters, no logo anywhere in the image. Leave a clear area at the bottom-start corner for a logo to be placed later.
Use the attached image only as a reference for how much room the logo needs.
```

- `{{scene_slug}}.png`, cropped to 1080×1920. When the film takes it in, it is saved as `05-assets/images/{{scene_slug}}.png`.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, how many tries it took, anything they must know.
