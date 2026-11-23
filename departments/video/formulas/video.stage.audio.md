---
{
  "id": "video.stage.audio",
  "label": {
    "en": "Audio",
    "ar": "الصوت"
  },
  "icon": "Mic",
  "when": {
    "intent": "work the audio stage",
    "project": "open",
    "stage": "audio"
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
    "market_name": {
      "json": "content/media/markets.json",
      "path": "{{market}}.name.en"
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
    "price": {
      "json": "content/media/markets.json",
      "path": "{{market}}.price"
    },
    "currency": {
      "json": "content/media/markets.json",
      "path": "{{market}}.currency"
    },
    "voice_style": {
      "json": "content/media/markets.json",
      "path": "{{market}}.voice.{{lang}}.style"
    },
    "project_dir": {
      "context": "project.dir"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
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
    },
    "lang": {
      "choice": [
        "ar",
        "en"
      ],
      "default": "ar"
    }
  },
  "drive": 0.8,
  "weight": 3,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "audio stage",
      "voice and music"
    ],
    "ar": [
      "مرحلة الصوت",
      "الصوت والموسيقى"
    ]
  }
}
---

## Task
Produce the audio package for one version: narration in the market's dialect, the music bed and the effects.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}} · version {{version}} · variant: {{variant}}
- Version: {{market_name}} · {{language}} · {{dialect}} dialect
- Price: {{price}} {{currency}} per student per year
- Voice: {{voice_style}}
- Stage: 08 audio (per variant)

## References
- Script: `{{project_dir}}/03-script/script.md`
- Markets: {{markets_url}}
- Locked spec: `{{project_dir}}/00-plan/08-audio.spec.md` (the decisions for this stage; the whole plan is `{{project_dir}}/00-plan/plan.md`)

## Constraints
- Narration through `voice.mjs --dialect {{dialect}}`; never a voice that imitates a real person.
- Music and effects only from sources whose licence is recorded in the manifest.
- Work this one stage only, then stop. Append anything that slowed you down to `09-quality/friction.md` in the project.
- Follow the locked spec. If the file is missing, stop and say so: the line is locked by accepting the plan, or with `produce lock {{project}} --all`.

## Deliverable
- Deliverable file: `{{project_dir}}/07-audio/audio-package.json`.
- Voiceover in `07-audio/voiceover/`, music in `07-audio/music/`, effects in `07-audio/sound-effects/`, and the package JSON describing the timing.
- Advance with the variant flag (below).
- When the deliverable exists, record it: `node ~/.claude/skills/produce/scripts/produce.mjs advance {{project}} audio --file <07-audio/audio-package.json> --variant {{variant}}`.
