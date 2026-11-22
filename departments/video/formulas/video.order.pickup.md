---
{
  "id": "video.order.pickup",
  "label": {
    "en": "Start my work order",
    "ar": "ابدأ طلب العمل"
  },
  "icon": "Inbox",
  "when": {
    "intent": "a work order is assigned to me",
    "assigned": true
  },
  "route": "do",
  "gate": null,
  "slots": {
    "login": {
      "context": "login"
    },
    "issue_url": {
      "ask": "the link of the work order issue"
    },
    "today": {
      "context": "today"
    },
    "brand_kit_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/brand-kit.json"
    }
  },
  "drive": 0.8,
  "weight": 1,
  "role": "waiting",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "my work order",
      "start the order",
      "pick up the order",
      "my task"
    ],
    "ar": [
      "طلب العمل",
      "ابدأ الطلب",
      "مهمتي"
    ]
  },
  "model": "sonnet",
  "effort": "medium"
}
---

## Task
Do the work order assigned to {{login}}: read it, claim it, build the piece, submit it and reply on the issue.

## Context
- Assignee: {{login}}
- Order: {{issue_url}}
- Today: {{today}}

## References
- The order, in full: {{issue_url}}
- Brand kit: {{brand_kit_url}}

## Constraints
- The issue is the specification. Read every link in it before you start; ask on the issue if one does not open.
- Do only what the order asks; if a decision is needed, ask on the issue and wait.
- If this computer lacks a tool the order names (the order's kun block lists them), say so first instead of improvising.

## Deliverable
- The files the order names, submitted through the Kun app's Submit, and a one-line reply on the issue for the next person.
