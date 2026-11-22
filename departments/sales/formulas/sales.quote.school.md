---
{
  "id": "sales.quote.school",
  "label": {
    "en": "Quote a school",
    "ar": "عرض سعر لمدرسة"
  },
  "icon": "Receipt",
  "when": {
    "intent": "price a school from the approved pricing"
  },
  "route": "do",
  "gate": null,
  "slots": {
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
    "record_id": {
      "ask": "the CRM record id of the school, e.g. the id shown in Twenty"
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
  "drive": 1.0,
  "weight": 3,
  "role": "start",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "quote a school",
      "price a school",
      "school quote",
      "build a quote",
      "how much for a school"
    ],
    "ar": [
      "عرض سعر لمدرسة",
      "عرض سعر",
      "سعر المدرسة",
      "كم السعر لمدرسة",
      "جهز عرض سعر"
    ]
  }
}
---

## Task
Prepare a quote for one school: {{students}} students in {{market_name}}, priced from the approved pricing, ready for the owner to review. Draft only; send nothing.

## Context
- School: CRM record {{record_id}}. Read its name, contact and stage from the CRM; never copy them anywhere else.
- Brand: {{brand}} (the name the school sees) · repo {{repo}}
- Students: {{students}}
- Market: {{market_name}} · price {{price}} {{currency}} per student per year
- Total for the year: {{total}} {{currency}}
- Payment: {{signing}} {{currency}} at signing, then four instalments of {{instalment}} {{currency}} at months 3, 6, 9 and 12
- Terms: {{terms}}
- Today: {{today}}

## References
- Approved price and currency per market: {{markets_url}}
- Where the terms come from (the pricing decision, in code): {{rates_url}}
- The CRM and how to reach it: {{crm_doc_url}}

## Constraints
- Use only the price and terms above. Do not round, discount or add a clause the pricing source does not state; if the school asks for something else, write it as a question for the owner.
- Value before payment: open with one concrete result the school gets in its first month, then the price.
- Read the CRM through the lead or funnel agent; the key stays in the Keychain and is never printed.
- Log that a quote was drafted, with the total, on CRM record {{record_id}}. Do not log it as sent.

## Deliverable
- The quote in Arabic first, English mirrored: one result the school gets, the students and the per-student price, the total, the payment schedule and the free first month, and one line saying what the school does next.
- The same quote as a two-line message ready to send, marked DRAFT: not sent. It goes out only after the owner's explicit yes.
- One line stating the CRM note you wrote on record {{record_id}}.
