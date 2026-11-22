---
{
  "id": "sales.order.call",
  "label": {
    "en": "Call or visit order",
    "ar": "طلب اتصال أو زيارة"
  },
  "icon": "Phone",
  "when": {
    "intent": "hand a call or a visit to one person",
    "lead": "open"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "to": {
      "ask": "the login of the person this order is for, e.g. ali"
    },
    "login": {
      "context": "login"
    },
    "record_id": {
      "ask": "the CRM record id of the school to call or visit"
    },
    "action": {
      "choice": [
        "call",
        "visit",
        "WhatsApp call"
      ],
      "default": "call"
    },
    "purpose": {
      "choice": [
        "follow up a reply",
        "first conversation",
        "demo",
        "pricing conversation",
        "close the contract"
      ],
      "default": "follow up a reply"
    },
    "by": {
      "choice": [
        "within two days",
        "today",
        "this week"
      ],
      "default": "within two days"
    },
    "market": {
      "choice": [
        "sa",
        "ae",
        "eg",
        "sd",
        "rw"
      ],
      "default": "sa"
    },
    "market_name": {
      "json": "content/media/markets.json",
      "path": "{{market}}.name.en"
    },
    "currency": {
      "json": "content/media/markets.json",
      "path": "{{market}}.currency"
    },
    "price": {
      "json": "content/media/markets.json",
      "path": "{{market}}.price"
    },
    "today": {
      "context": "today"
    },
    "repo": {
      "context": "repo",
      "default": "hogwarts"
    },
    "crm_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/crm.mdx"
    },
    "funnel_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/funnel.mdx"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    }
  },
  "drive": 0.9,
  "weight": 2,
  "role": "next",
  "board": false,
  "record": "issue",
  "submit": "comment",
  "triggers": {
    "en": [
      "call order",
      "visit order",
      "give the call to",
      "ask someone to call",
      "send someone to visit"
    ],
    "ar": [
      "اطلب اتصال",
      "اطلب زيارة",
      "اعط المكالمة",
      "كلف احدا بالاتصال",
      "زيارة مدرسة"
    ]
  }
}
---

## Task
Make a {{action}} to one school to {{purpose}}, {{by}}, and log the result in the CRM.

## Context
- Work order: {{action}} to the school, for {{to}} · ordered by {{login}}
- School: CRM record {{record_id}}. Read the name, the contact and the history there; they are deliberately not on this issue.
- Purpose: {{purpose}} · market {{market_name}} · repo {{repo}}
- Ordered on {{today}}; do it {{by}}.
- If prices come up, the only price is {{price}} {{currency}} per student per year, with a free first month. Do not promise anything else.

## References
- The CRM and how to reach it: {{crm_doc_url}}
- The funnel, gates and what each asks: {{funnel_doc_url}}
- Approved prices: {{markets_url}}

## Constraints
- Ask for nothing the CRM record already has. Open with value, not a price.
- Offer no discount, no extra month and no feature that is not already in the product; say "I will check and come back" and put it on the issue.
- Do not copy a phone number, a name or an agreed figure onto this issue; the CRM record is the only place for them.
- Send nothing in the company's name that the owner has not approved; the call itself is the work.

## Deliverable
- Log the result on CRM record {{record_id}}: the date, the channel, what was agreed and the next step with its date.
- Ask these and note the answers: who decides and when; how many students; what they use today; what would make them start this month; what stops them.
- Reply on this issue with one line for the next person: what you did, the gate you moved the lead to, what is left. Do not put contact details or figures in the reply.
- Reply on this issue within the time given; if you are blocked, say so there instead of widening the work.
