---
{
  "id": "sales.proposal.write",
  "label": {
    "en": "Write a proposal",
    "ar": "اكتب عرضاً"
  },
  "icon": "FileText",
  "when": {
    "intent": "write a client proposal for a school"
  },
  "route": "do",
  "gate": null,
  "slots": {
    "record_id": {
      "ask": "the CRM record id of the school"
    },
    "students": {
      "ask": "the number of students the school has, e.g. 250"
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
    "total": {
      "mul": [
        "price",
        "students"
      ]
    },
    "signing": {
      "mul": [
        "total",
        "0.5"
      ]
    },
    "instalment": {
      "mul": [
        "total",
        "0.125"
      ]
    },
    "lang": {
      "choice": [
        "ar",
        "en"
      ],
      "default": "ar"
    },
    "language": {
      "map": {
        "ar": "Arabic first, English mirrored",
        "en": "English first, Arabic mirrored"
      },
      "of": "lang"
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
    "repo": {
      "context": "repo",
      "default": "hogwarts"
    },
    "today": {
      "context": "today"
    },
    "terms": {
      "value": "a free first month, then the price per student per year; 50% at signing and four instalments of 12.5% at months 3, 6, 9 and 12; quoted all-in with no VAT added; no discount"
    },
    "markets_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/media/markets.json"
    },
    "rates_url": {
      "value": "https://github.com/databayt/hogwarts/blob/main/src/components/saas-marketing/pricing/rates.ts"
    },
    "crm_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/crm.mdx"
    }
  },
  "drive": 0.85,
  "weight": 4,
  "role": "start",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "write a proposal",
      "client proposal",
      "draft the offer",
      "school proposal",
      "proposal for a school"
    ],
    "ar": [
      "اكتب عرضا",
      "عرض تجاري",
      "عرض لمدرسة",
      "صياغة العرض",
      "جهز عرضا"
    ]
  }
}
---

## Task
Write the proposal for one school ({{students}} students, {{market_name}}): the challenge, the solution, the price, the timeline and why databayt. Draft for the owner's review; send nothing.

## Context
- School: CRM record {{record_id}}. Read its name, contact, stage and any notes from the CRM; never copy them elsewhere.
- Brand: {{brand}} (the name the school sees) · repo {{repo}}
- Language: {{language}}
- Price: {{price}} {{currency}} per student per year · total {{total}} {{currency}} for {{students}} students
- Payment: {{signing}} {{currency}} at signing, then four instalments of {{instalment}} {{currency}} at months 3, 6, 9 and 12
- Terms: {{terms}}
- Today: {{today}}

## References
- Approved price and currency per market: {{markets_url}}
- Where the terms come from: {{rates_url}}
- The CRM and how to reach it: {{crm_doc_url}}

## Constraints
- The price and terms above are the only commercial content. Never invent a discount, a clause or a feature the product does not have.
- The challenge section uses only what the CRM record or the school itself has said; mark any inference as one.
- Value before payment: the solution section shows one small real result before the price.
- Log the proposal as drafted, not sent, on CRM record {{record_id}}.

## Deliverable
- The proposal in Markdown, ready for PDF or Notion: the school's challenge · the solution and the features it uses · the price and payment schedule · the timeline from the free first month to go-live · why databayt.
- The two-line message that would carry it, marked DRAFT: not sent.
- One line stating the CRM note written, and the question "Shall I send it?". It goes only after the owner's explicit yes.
