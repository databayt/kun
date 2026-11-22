---
{
  "id": "sales.reply.log",
  "label": {
    "en": "Log a reply",
    "ar": "سجّل رداً"
  },
  "icon": "MessageSquareReply",
  "when": {
    "intent": "record a reply from a school in the CRM"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "record_id": {
      "ask": "the CRM record id of the school that replied"
    },
    "channel": {
      "choice": [
        "WhatsApp",
        "email",
        "phone",
        "Facebook",
        "visit"
      ],
      "default": "WhatsApp"
    },
    "reply": {
      "ask": "what the school said, in your own words; no phone numbers or personal details"
    },
    "login": {
      "context": "login"
    },
    "today": {
      "context": "today"
    },
    "funnel_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/funnel.mdx"
    },
    "crm_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/crm.mdx"
    }
  },
  "drive": 0.9,
  "weight": 1,
  "role": "next",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "log a reply",
      "school replied",
      "they replied",
      "record the reply",
      "log the answer"
    ],
    "ar": [
      "سجل رد",
      "ردت المدرسة",
      "ردوا علينا",
      "سجل الرد",
      "رد العميل"
    ]
  }
}
---

## Task
Record the reply from the school on CRM record {{record_id}} and set its next step, so nothing about it lives only in this chat.

## Context
- School: CRM record {{record_id}}, replied on {{channel}} · logged by {{login}} on {{today}}
- What they said: {{reply}}
- The gate ladder is COLD, PROSPECT, SHORTLISTED, CONTACTED, WARM, DISCOVERY, DEMO, TRIAL, PILOT, PAID, plus DORMANT and LOST. A reply moves a lead to WARM at least.

## References
- The funnel: gates, what each gate asks, the stall clock: {{funnel_doc_url}}
- The CRM and how to reach it: {{crm_doc_url}}

## Constraints
- Write through the funnel agent, dry run first and then apply. Use only stage options that already exist; never add a new one.
- Advance the gate only when the reply supports it; otherwise keep the gate and say why. A reply freezes the touch cadence.
- Record what was said as a short note and the date and channel; no contact details or personal data in the note.
- Do not answer the school. A reply message is drafted for the owner and waits for his yes.

## Deliverable
- The CRM record updated: gate (old to new), last-reply date and channel, a note, and the next step with its date (a reply is never left more than two days).
- A one-line summary: the gate now, the next step and who owns it.
- A drafted answer in the school's language, marked DRAFT: not sent.
