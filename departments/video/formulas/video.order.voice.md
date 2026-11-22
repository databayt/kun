---
{
  "id": "video.order.voice",
  "label": {
    "en": "Voiceover",
    "ar": "تعليق صوتي"
  },
  "icon": "Mic",
  "when": {
    "intent": "hand a voice piece of the film to one person",
    "project": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "scene": {
      "ask": "the scene or piece this order covers, e.g. the classroom scene"
    },
    "language": {
      "map": {
        "ar": "Arabic",
        "en": "English"
      },
      "of": "lang"
    },
    "dialect": {
      "json": "content/media/markets.json",
      "path": "{{market}}.voice.{{lang}}.dialect"
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
    "market_name": {
      "json": "content/media/markets.json",
      "path": "{{market}}.name.en"
    },
    "voice_style": {
      "json": "content/media/markets.json",
      "path": "{{market}}.voice.{{lang}}.style"
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
    "scene_slug": {
      "slug": "scene"
    },
    "lang": {
      "choice": [
        "ar",
        "en"
      ],
      "default": "ar"
    },
    "market": {
      "choice": [
        "sd",
        "sa",
        "ae",
        "eg",
        "rw"
      ],
      "default": "sd"
    }
  },
  "drive": 0.6,
  "weight": 2,
  "role": "next",
  "board": false,
  "record": "issue",
  "triggers": {
    "en": [
      "voice order",
      "give the voiceover to",
      "record the narration"
    ],
    "ar": [
      "اطلب تعليق صوتي",
      "سجل التعليق",
      "اعط التعليق الصوتي"
    ]
  }
}
---

## Task
Record the narration for {{scene}} in {{language}} with a {{dialect}} dialect, from the approved script.

## Context
- Work order: Voiceover, for {{to}} · ordered by {{login}}
- Film: {{project}} · {{repo}} / {{brand}} (the name the viewer sees)
- Piece: {{scene}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Voice: {{voice_style}}

## References
- Script: {{script_url}}
- Shot list: {{shotlist_url}}
- Brand kit: {{brand_kit_url}}
- Voice style: {{voice_style}}

## Constraints
- Read the approved script exactly; ask on the issue before changing a word.
- Clean room, no background noise, same distance from the microphone for the whole take.
- Never a voice that imitates a real, identifiable person.
- The order is one piece for one person. If something blocks you, say so on the issue instead of widening the work.

## Deliverable
- `{{scene_slug}}-voice-{{lang}}.wav` (48 kHz, mono, no processing) and the timing of each line in a short note.
- Submit through the Kun app: open this order and press Submit with the files attached. The app uploads them to `work/{{project}}/<issue number>/<file>` on the CDN and posts the receipt on this issue.
- Reply on the issue with one line for the next person: what you did, what is left, anything they must know.
