---
{
  "id": "video.order.still",
  "label": {
    "en": "Still, Nano Banana",
    "ar": "صورة عبر نانو بنانا"
  },
  "icon": "Image",
  "when": {
    "intent": "hand one generated still of the film to an agent or teammate who runs the Nano Banana pack in the Gemini app seat",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or shot this still is for, e.g. the principal's desk at 7 am",
      "q": {
        "en": "Which scene or shot is this still for?",
        "ar": "لأي مشهد أو لقطة هذه الصورة؟"
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
      "still order",
      "give the still to",
      "generate the still",
      "nano banana still",
      "hero still"
    ],
    "ar": [
      "اطلب لقطة ثابتة",
      "اعط اللقطة الثابتة",
      "ولد اللقطة الثابتة",
      "صورة نانو بنانا"
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
Make one still for {{scene}} with Nano Banana in the Gemini app seat, from the prompt below, and save it as `{{scene_slug}}.png`.

## Context
- Work order: Generated still, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Renderer: Nano Banana in the Gemini app seat, run automatically: `node scripts/gemini-web.mjs <pack dir>` in the kun repo (about 9 images per window, $0). The worker is an agent or a teammate running the pack; nobody pastes by hand.
- Format: vertical 9:16, generated at 1088×1920 (both edges divide by 16), then cropped to 1080×1920.

## References
- Shot list: {{shotlist_url}} (when the scene carries a `shot` object, take its size, lens, move, light, mood, beats and refs from there)
- Script: {{script_url}}
- Brand kit: {{brand_kit_url}}
- Logo, to size the empty corner only: {{logo}}
- Look: {{direction}}

## Constraints
- The prompt follows the shot formula, in this order: Style · Camera (shot size, lens, move) · Subject (+ reference) · Action (timed beats) · Place · Light and mood · Sound (dialogue in quotes, `SFX:`, `Ambient:`) · Constraints, stated positively.
- Result first: say the subject, what the picture is used for, and the composition before any detail. Then visible details, then the people and what they do.
- State every constraint positively (what the picture holds), never as a list of what to avoid. When fixing a result, write "change only X, keep everything else the same" and name X.
- The picture holds no text, no letters and no logo: they are placed afterwards. If the result shows any, regenerate with the corner left empty.
- Characters and places are illustrative: no real student, parent or staff face, and no real school name.
- One accent colour per image, from the palette. If the palette drifts, regenerate rather than fix it by hand.
- The order is one piece. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- The prompt to run (one pack entry):

```
Result: a vertical still, 1088×1920, for a film about a school management product, used as a keyframe of the scene "{{scene}}". Composition: one clear subject with room at the bottom-start corner.
Style: {{style_prompt}}
Camera: <shot size>, <lens in mm>, <move or locked-off>; take them from the shot list.
Subject: <who or what is in frame, with the reference image attached when the shot list names one>.
Action: <the moment held in the frame, as one or two beats>.
Place: <the room or street, with the visible details that make it real>.
Light and mood: <the light and the feeling, in the palette's warm neutrals>. Palette (use these hex values): {{palette}}. One accent only.
Sound: none (a still).
The picture holds only the scene: clean surfaces, an empty bottom-start corner, no writing of any kind.
```

- `{{scene_slug}}.png`, cropped to 1080×1920. When the film takes it in, it is saved as `05-assets/images/{{scene_slug}}.png`.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, how many tries it took, anything they must know.
