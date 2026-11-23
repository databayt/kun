---
{
  "id": "video.order.clip",
  "label": {
    "en": "Clip for Veo",
    "ar": "مقطع عبر Veo"
  },
  "icon": "Clapperboard",
  "when": {
    "intent": "hand one generated clip of the film to the person who holds the Gemini app seat (Veo)",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or shot this clip is for, e.g. the principal opens the dashboard",
      "q": {
        "en": "Which scene or shot is this clip for?",
        "ar": "لأي مشهد أو لقطة هذا المقطع؟"
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
    "direction": {
      "brand": "{{brand}}",
      "field": "direction",
      "default": "as the brand kit says"
    },
    "scene_slug": {
      "slug": "scene"
    },
    "still_url": {
      "ref": "05-assets/images/{{scene_slug}}.png"
    }
  },
  "drive": 0.6,
  "weight": 4,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "clip order",
      "give the clip to",
      "generate the clip",
      "veo clip",
      "generated clip"
    ],
    "ar": [
      "اطلب مقطع",
      "اعط المقطع",
      "ولد المقطع",
      "مقطع فيو"
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
Make one generated clip for {{scene}} in the Gemini app seat (Veo), from the prompt below, and save it as `{{scene_slug}}.mp4`.

## Context
- Work order: Generated clip, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Renderer: the Gemini app seat (Veo), human-in-the-loop: a person pastes the prompt and saves the file. The paid routes (Veo by API, fal) are each person's own choice: use one only when `video-tools.mjs status <tool>` says ready; otherwise stay on the seat and never ask anyone to pay.
- Format: vertical 9:16, 8 seconds at most.
- First frame: the approved hero still of this scene, {{still_url}}, attached to the prompt.

## References
- Hero still (first frame): {{still_url}}
- Shot list: {{shotlist_url}} (when the scene carries a `shot` object, take its size, lens, move, light, mood, beats, audio and refs from there)
- Script: {{script_url}}
- Brand kit: {{brand_kit_url}}
- Look: {{direction}}

## Constraints
- Open the Gemini app, attach the hero still as the first frame, paste the prompt below as one message, and ask for 9:16 and 8 seconds. Do not edit the prompt.
- The prompt follows the shot formula, in this order: Style · Camera (shot size, lens, move) · Subject (+ reference) · Action (timed beats) · Place · Light and mood · Sound (dialogue in quotes, `SFX:`, `Ambient:`) · Constraints, stated positively.
- Action is timed in beats (`0–3s: …`), each beat one visible action. Sound is labelled: dialogue in quotes, `SFX:` for effects, `Ambient:` for the room.
- State every constraint positively. The clip holds no text, no letters and no logo: they are placed afterwards. If the clip shows any, regenerate.
- The clip is illustrative: no real student, parent or staff face, no real school name, and no product claim. Mark it illustrative in the reply.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- The prompt to paste:

```
Style: {{direction}}, matching the attached first frame.
Camera: <shot size>, <lens in mm>, <move>; 9:16, 8 seconds at most.
Subject: <who or what, as in the attached first frame>.
Action: 0–3s: <beat>. 3–6s: <beat>. 6–8s: <beat>.
Place: <the room or street, as in the first frame>.
Light and mood: <light and feeling>, in the palette {{palette}}.
Sound: "<the spoken line, if any>" SFX: <effects>. Ambient: <the room's sound>.
The frame holds only the scene: steady faces and hands, clean surfaces, no writing of any kind.
```

- `{{scene_slug}}.mp4`, 9:16, 8 seconds at most. When the film takes it in, it is saved as `05-assets/generated-video/{{scene_slug}}.mp4`, marked illustrative.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, how many tries it took, anything they must know.
