---
{
  "id": "sales.order.pickup",
  "label": {
    "en": "Start my sales order",
    "ar": "ابدأ طلب المبيعات"
  },
  "icon": "Inbox",
  "when": {
    "intent": "a sales work order is assigned to me",
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
    "crm_doc_url": {
      "value": "https://github.com/databayt/kun/blob/main/content/docs/crm.mdx"
    }
  },
  "drive": 0.9,
  "weight": 1,
  "role": "waiting",
  "board": true,
  "record": "none",
  "triggers": {
    "en": [
      "my sales order",
      "start the sales order",
      "my call order",
      "my task"
    ],
    "ar": [
      "طلب المبيعات",
      "ابدأ طلب المبيعات",
      "مهمة المبيعات",
      "مهمتي"
    ]
  }
}
---

## Task
Do the sales work order assigned to {{login}}: read it, claim it, do the call or visit, log the result in the CRM and reply on the issue.

## Context
- Assignee: {{login}}
- Order: {{issue_url}}
- Today: {{today}}

## References
- The order, in full: {{issue_url}}
- The CRM and how to reach it: {{crm_doc_url}}

## Constraints
- Do only what the order says; if it is blocked, say so on the issue.
- No contact details or agreed figures on the issue; they live in the CRM record.

## Deliverable
- The result logged on the CRM record named in the order.
- Reply on this issue with one line for the next person: what you did, the gate now, what is left.
