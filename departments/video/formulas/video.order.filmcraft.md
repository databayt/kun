---
{
  "id": "video.order.filmcraft",
  "label": {
    "en": "Assemble in FilmCraft",
    "ar": "تجميع في فيلم كرافت"
  },
  "icon": "Clapperboard",
  "when": {
    "intent": "hand the assembly of the film over its source voiceover to one person",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the part of the film to assemble, e.g. the whole film or scenes 1 to 4",
      "q": {
        "en": "Which part is this order for?",
        "ar": "أي جزء يشمله هذا الطلب؟"
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
    "variant": {
      "context": "project.focus.0"
    },
    "script_url": {
      "ref": "03-script/script.md"
    },
    "shotlist_url": {
      "ref": "04-storyboard/shot-list.json"
    },
    "assets_url": {
      "ref": "05-assets/asset-manifest.json"
    },
    "voice_url": {
      "ref": "07-audio/voiceover/{{variant}}.wav"
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
    "voice": {
      "brand": "{{brand}}",
      "field": "voice"
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
      "filmcraft order",
      "assemble the film",
      "give the assembly to",
      "assemble in filmcraft",
      "filmcraft assembly"
    ],
    "ar": [
      "اطلب تجميع",
      "تجميع الفيلم",
      "اعط التجميع",
      "جمع الفيلم في فيلم كرافت"
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
Assemble {{scene}} in FilmCraft from the shot list, over the source voiceover, and render a preview, on your own machine.

## Context
- Work order: FilmCraft assembly, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}} · version {{variant}}
- Format: vertical 9:16, 1080×1920, 30 fps
- Voice: {{voice}}
- Palette: {{palette}}
- Type: {{fonts}}
- Logo: {{logo}}

## References
- Voiceover (the timing master): {{voice_url}}
- Shot list: {{shotlist_url}}
- Assets list: {{assets_url}}
- Script: {{script_url}}
- Brand kit: {{brand_kit_url}}

## Constraints
- Drive FilmCraft through the `filmcraft` MCP: `command_list` for the ids, `command_run` or `command_batch` for every edit, `render_preview` to check. Never edit the project file by hand.
- The voiceover is the timing master: lay it on audio track 1 first and never stretch or cut it. Every shot starts and ends on the shot list's times against that audio.
- Use only assets named in the assets list. A shot whose asset is missing stays a labelled placeholder; say which on the issue.
- Captions and end card use the fonts and palette above; no other font or colour.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- The FilmCraft project `{{scene_slug}}-filmcraft.zip` (project file plus media references) and a preview render `{{scene_slug}}-preview.mp4`.
- A short note: the track layout, the shots that are still placeholders, and the total duration against the voiceover's.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, what is left, anything they must know.
