# Website Leads: first-touch templates

These are used by `pnpm sales:leads` (the lane is documented in `/scrape`, under "databayt"). A person approves every first touch before it goes out. Rules from `/funnel`:

- Send WhatsApp only to mobile numbers.
- Write in Arabic first for Sudan, and in English for Kigali, Nairobi and Lagos.
- Each touch carries one concrete thing, never a generic pitch.

`{name}` is the business name, `{finding}` is the audit's plain-language finding, and `{proof}` is one live site from the list below that matches the offer.

## Findings in plain words

| Finding     | Say                                                                              |
| ----------- | -------------------------------------------------------------------------------- |
| NO_WEBSITE  | "I couldn't find a website for {name}."                                          |
| SOCIAL_ONLY | "{name} is only on Facebook/Instagram, so Google searches don't find you."       |
| NOT_MOBILE  | "Your site doesn't fit a phone screen, and most of your visitors are on phones." |
| NO_HTTPS    | "Browsers mark your site 'Not secure'."                                          |
| OUTDATED    | "Your site was built a few years ago and is showing its age."                    |
| SLOW        | "Your site takes a few seconds to open on mobile data."                          |
| BROKEN      | "Your website isn't loading right now."                                          |

## Proof by offer

| Offer                | Proof                                     |
| -------------------- | ----------------------------------------- |
| QR_ORDERING          | bu.databayt.org (Charles Burgers, Kigali) |
| BOOKING              | mkan.sd                                   |
| SCHOOL_SYSTEM        | balqalam.com                              |
| NEW_WEBSITE, REBRAND | abdoutgroup.com · mr.databayt.org         |

## Touch 1: English (WhatsApp or email)

> Hello {name} team, I'm Osman from Databayt, a software studio in Kigali. {finding} We build fast, mobile-first websites and ordering/booking systems. Here's one we made: {proof}. Would you like a free 1-page review of your site with 3 concrete fixes? No obligation.

## Touch 1: Arabic

> السلام عليكم فريق {name}، معك عثمان من داتابايت، استوديو برمجيات. {finding_ar} نحن نصمم مواقع سريعة تعمل على الجوال وأنظمة طلب وحجز إلكتروني، ومن أعمالنا: {proof}. هل تودون مراجعة مجانية لموقعكم من صفحة واحدة فيها ٣ تحسينات عملية؟ بدون أي التزام.

## Touch 2 (day 4): the asset

> Here's the quick review I mentioned for {name}: [1-page audit, made from the card's Audit notes]. Happy to show what a new version would look like. A 15-minute call this week?

## Touch 3 (day 10): the offer

> We can deliver a new {offer} for {name} in about a week, at a fixed price, with hosting included for the first year. Shall I send a short proposal?

## Touch 4 (day 21): the close

> Last note from me. If timing isn't right, no problem. I'll keep {name}'s review on file. Good luck!

After touch 4 with no reply, set the stage to DORMANT. A lead can be contacted again after 90 days.
