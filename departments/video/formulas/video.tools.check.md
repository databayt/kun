---
{
  "id": "video.tools.check",
  "label": {
    "en": "Tools check",
    "ar": "فحص الأدوات"
  },
  "icon": "Wrench",
  "when": {
    "intent": "is the video line ready on this computer"
  },
  "route": "quick",
  "gate": null,
  "slots": {
    "today": {
      "context": "today"
    }
  },
  "drive": 0.3,
  "weight": 1,
  "role": "start",
  "board": true,
  "record": "none",
  "health_boost": true,
  "health_only": true,
  "triggers": {
    "en": [
      "tools check",
      "check the tools",
      "is blender working",
      "readiness",
      "check the video line"
    ],
    "ar": [
      "فحص الأدوات",
      "افحص الأدوات",
      "هل الأدوات تعمل",
      "جاهزية الأدوات"
    ]
  },
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Check that the video line is ready on this computer, and say exactly what to fix. Do not produce the video.

## Context
- Computer readiness is one command: `produce readiness`, which tests ffmpeg, Blender, FilmCraft, the speech model, the recording browsers, disk space, power, the Kun app, the Blender and FilmCraft connections and the Gemini key.
- Today: {{today}}

## References
- Check: `node ~/.claude/skills/produce/scripts/produce.mjs readiness --json`
- Repair: the same command with `--fix` (up to 15 minutes)
- Proof folder: ~/media/_projects/_checks/{{today}}/

## Constraints
- Run readiness, then confirm that Blender, FilmCraft and Claude actually respond, not only that they are installed. Leave the proof in the proof folder.
- Do not run `--fix` unless the person says yes.

## Deliverable
- A ✓/✗ table per tool with the evidence, then what needs fixing and the exact command for each.
