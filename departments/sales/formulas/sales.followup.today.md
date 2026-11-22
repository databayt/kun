---
{
  "id": "sales.followup.today",
  "label": {
    "en": "Who to follow up",
    "ar": "من أتابع اليوم؟"
  },
  "icon": "PhoneCall",
  "when": {
    "intent": "decide who to follow up today"
  },
  "route": "plan",
  "gate": null,
  "slots": {
    "login": {
      "context": "login"
    },
    "today": {
      "context": "today"
    },
    "repo": {
      "context": "repo",
      "default": "hogwarts"
    },
    "limit": {
      "choice": [
        "10",
        "5",
        "20"
      ],
      "default": "10"
    },
    "crm_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/crm.mdx"
    },
    "funnel_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/funnel.mdx"
    }
  },
  "drive": 1.0,
  "weight": 2,
  "role": "next",
  "board": true,
  "record": "none",
  "due": {
    "weekdays": [
      0,
      1,
      2,
      3,
      4
    ]
  },
  "triggers": {
    "en": [
      "who to follow up",
      "follow up today",
      "who should i follow up",
      "stalled leads",
      "who replied",
      "follow up"
    ],
    "ar": [
      "من أتابع اليوم",
      "من اتابع اليوم",
      "العملاء الذين يجب أن أتابعهم",
      "متابعة اليوم",
      "من ينتظر ردي",
      "العملاء المتأخرين"
    ]
  }
}
---

## Task
Tell {{login}} who to follow up today: at most {{limit}} leads, ranked, each with what to say. Read only; send nothing.

## Context
- Today: {{today}} · repo {{repo}}
- A reply beats a cold lead; a reply left unanswered for more than two days is the first thing on the list.
- The CRM is Twenty (crm-api.databayt.org). Read it through the funnel agent: gate state, the last touch and its date, the next-follow-up date.

## References
- The funnel: gates, the stall clock and the follow-up drain: {{funnel_doc_url}}
- The CRM and how to reach it: {{crm_doc_url}}

## Constraints
- Order: leads that replied and stalled first (longest wait first), then leads whose next-follow-up date has come, then the rest by gate, closest to payment first.
- Never propose a second touch to a lead that has not replied inside the cadence; a lead past four touches is DORMANT, not a follow-up.
- A WhatsApp touch only to a verified mobile number. Prefer the channel the lead last answered on.
- Do not send, schedule or edit anything. The list is the deliverable.

## Deliverable
- A numbered table of at most {{limit}} rows: CRM record id · gate · days since the last touch · why it is on the list · the channel · one line of what to say (Arabic first).
- Under the table: the biggest stall in the funnel, in one line, and the single move that unsticks it.
- End with the question "Shall I draft these for your approval?". Drafts wait for the owner's yes.
