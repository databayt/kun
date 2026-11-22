---
{
  "id": "sales.leads.find",
  "label": {
    "en": "Find leads",
    "ar": "عملاء جدد"
  },
  "icon": "Search",
  "when": {
    "intent": "ten new schools worth contacting"
  },
  "route": "plan",
  "gate": null,
  "slots": {
    "market": {
      "choice": [
        "sa",
        "ae",
        "eg",
        "sd",
        "rw"
      ],
      "default": "sd"
    },
    "market_name": {
      "json": "content/media/markets.json",
      "path": "{{market}}.name.en"
    },
    "count": {
      "choice": [
        "10",
        "5",
        "20"
      ],
      "default": "10"
    },
    "repo": {
      "context": "repo",
      "default": "hogwarts"
    },
    "today": {
      "context": "today"
    },
    "scrape_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/scrape.mdx"
    },
    "crm_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/crm.mdx"
    }
  },
  "drive": 0.8,
  "weight": 2,
  "role": "start",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "find leads",
      "new leads",
      "new schools",
      "schools to contact",
      "prospect schools",
      "who should we contact"
    ],
    "ar": [
      "عملاء جدد",
      "عملاء محتملين",
      "مدارس جديدة",
      "اقترح مدارس",
      "مدارس نتواصل معها"
    ]
  }
}
---

## Task
Propose {{count}} new schools in {{market_name}} worth contacting this week, each with the reason it fits. Contact gap first, discovery last. Read only; change nothing.

## Context
- Today: {{today}} · repo {{repo}}
- The constraint is contactability, not discovery: measure the contact gap before looking for anything new.
- Order of sources: schools already in the CRM that we can reach and have never messaged (CONTACTABLE); then schools whose contact can be enriched cheaply (a Facebook page or a website, not yet read); raw discovery only if the first two cannot fill the list, and then say so.

## References
- Lead acquisition, the contact gap and the lanes: {{scrape_doc_url}}
- The CRM and how to reach it: {{crm_doc_url}}

## Constraints
- Start with the contact-gap numbers from the CRM (lane counts), stated in one line; do not quote numbers from memory.
- Exclude every school that already has a touch, a reply or a stage past COLD.
- A school fits when it is in the target market, has a way to reach it today, and shows a need the product answers; give that evidence, not a guess.
- Do not run discovery or enrichment that writes to the CRM; propose it with its measured yield and wait for the owner's yes.

## Deliverable
- One line: the contact gap now, and how many of the {{count}} come from each source.
- A table of {{count}} rows (fewer, if the sources run out, and say so): CRM record id · source lane · channel and whether it is verified · why it fits · the first touch to make.
- The one next action that would add the most reachable schools, with its expected yield.
