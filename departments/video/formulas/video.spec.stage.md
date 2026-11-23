---
{
  "id": "video.spec.stage",
  "label": {
    "en": "Discuss a stage",
    "ar": "نقاش مرحلة"
  },
  "icon": "MessageSquare",
  "when": {
    "intent": "discuss or revise the spec of one stage of the film, read-only",
    "project": "open"
  },
  "route": "plan",
  "gate": null,
  "slots": {
    "stage": {
      "choice": [
        "request",
        "research",
        "brief",
        "script",
        "storyboard",
        "assets",
        "visual",
        "audio",
        "edit",
        "render",
        "qa",
        "approval",
        "cdn",
        "publish"
      ],
      "default": "script",
      "q": {
        "en": "Which stage?",
        "ar": "أي مرحلة؟"
      }
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
    "project": {
      "context": "project.id"
    },
    "project_dir": {
      "context": "project.dir"
    }
  },
  "drive": 0.5,
  "weight": 1,
  "role": "next",
  "board": false,
  "record": "none",
  "triggers": {
    "en": [
      "discuss the stage",
      "revise the stage spec",
      "change the stage spec",
      "stage spec"
    ],
    "ar": [
      "ناقش المرحلة",
      "عدل مواصفات المرحلة"
    ]
  },
  "order": [
    "stage"
  ],
  "model": "opus",
  "effort": "medium"
}
---

## Task
Discuss or revise the spec of ONE stage ({{stage}}) of the {{repo}} film {{project}}, changing nothing.

## Context
- Repo / brand: {{repo}} / {{brand}} (the name the viewer sees)
- Project: {{project}}
- Stage: {{stage}}
- The spec is the stage's decisions written down; the person locks it in the app.

## References
- The stage view (read-only: its locked decisions, standard choices and tool): `node ~/kun/.claude/scripts/station.mjs stage {{stage}} --dept video --project {{project}} --json`
- The spec files: `{{project_dir}}/00-plan/` (this stage's `<NN>-{{stage}}.spec.md`, and `plan.md` for the whole line)
- The tool ladder: `~/kun/departments/video/stages.json`
- The stage's inputs, as the spec names them.

## Constraints
- Read-only: write no file, run no command that writes.
- Ask with a `kun-questions` block only when an answer would change the spec: one to three questions, and never what the spec already states.
- Pick tools only from this stage's ladder in `stages.json`. Free tools are the default. A paid tool is used only when the person has set it up on this machine (`node ~/kun/.claude/scripts/video-tools.mjs status <tool>` says ready); otherwise take the next free rung and never ask anyone to pay.
- Keep the reply short.

## Deliverable
- Two to six lines: what changes in the spec and why.
- Then the turn ENDS with one fenced block with the info string `kun-spec`, JSON only, the last thing in the turn:

```kun-spec
{ "stage": "{{stage}}", "decisions": { "<choice key>": "<value>" }, "tool": "<tool id>", "notes": "<one or two lines the worker must know>" }
```

- Say that the person presses Lock to record it; never write the spec file yourself.
