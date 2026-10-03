#!/usr/bin/env node
// ── Create the "Website Leads" object in the Twenty Databayt workspace ───────
//
//   node scripts/crm-website-lead-object.mjs --dry-run   print, write nothing
//   node scripts/crm-website-lead-object.mjs             create what is missing
//
// Databayt's outbound lane (Abdout, 2026-10-03): businesses in Kigali, Nairobi
// and Lagos — and the Gulf/Sudan — whose website is missing, old, slow or not
// mobile-ready, offered a new site, a rebrand, QR ordering or a school system.
// Separate from "Jobs & Opportunities" (posted work) and from Opportunities
// (deals): a lead is a business we found, audited and may contact. Rows come
// from `pnpm sales:leads` (discover → audit → push); stages move by hand or by
// the funnel. Fingerprint `osm:<type>/<id>` is the dedup key.

import { COUNTRY_OPTIONS } from "./lib/crm-markets.mjs";
import { ensureObject } from "./lib/twenty-object.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const OBJECT = {
  nameSingular: "websiteLead",
  namePlural: "websiteLeads",
  labelSingular: "Website Lead",
  labelPlural: "Website Leads",
  icon: "IconWorldSearch",
  isLabelSyncedWithName: false,
  description:
    "Outbound leads for Databayt's software house: businesses whose website is missing, outdated, slow or not mobile-ready. Found and audited by `pnpm sales:leads`; worked through the stage pipeline.",
};

const sel = (value, label, color, position) => ({ value, label, color, position });

const FIELDS = [
  {
    name: "company",
    label: "Company",
    type: "RELATION",
    icon: "IconBuildingStore",
    relation: { targetFieldLabel: "Website Leads", targetFieldIcon: "IconWorldSearch", type: "MANY_TO_ONE" },
  },
  {
    name: "stage",
    label: "Stage",
    type: "SELECT",
    icon: "IconProgressCheck",
    description: "Discovered → Audited → Qualified → Contacted → Replied → Call → Proposal → Won / Lost; Dormant after 4 silent touches.",
    options: [
      sel("DISCOVERED", "Discovered", "gray", 0),
      sel("AUDITED", "Audited", "sky", 1),
      sel("QUALIFIED", "Qualified", "blue", 2),
      sel("CONTACTED", "Contacted", "purple", 3),
      sel("REPLIED", "Replied", "turquoise", 4),
      sel("CALL", "Call / meeting", "yellow", 5),
      sel("PROPOSAL", "Proposal sent", "orange", 6),
      sel("WON", "Won", "green", 7),
      sel("LOST", "Lost", "red", 8),
      sel("DORMANT", "Dormant (90 days)", "gray", 9),
    ],
  },
  {
    name: "sector",
    label: "Sector",
    type: "SELECT",
    icon: "IconCategory",
    options: [
      sel("HOSPITALITY", "Hotel / guesthouse", "blue", 0),
      sel("FOOD", "Restaurant / café", "orange", 1),
      sel("EDUCATION", "School / college", "green", 2),
      sel("HEALTH", "Clinic / pharmacy", "red", 3),
      sel("NGO", "NGO / association", "turquoise", 4),
      sel("RETAIL", "Shop / retail", "purple", 5),
      sel("PROFESSIONAL", "Office / company", "sky", 6),
      sel("TOURISM", "Tour / travel", "yellow", 7),
      sel("OTHER", "Other", "gray", 8),
    ],
  },
  { name: "country", label: "Country", type: "SELECT", icon: "IconFlag", options: COUNTRY_OPTIONS },
  { name: "city", label: "City", type: "TEXT", icon: "IconBuildingCommunity" },
  { name: "website", label: "Website", type: "LINKS", icon: "IconWorld" },
  {
    name: "auditFinding",
    label: "Finding",
    type: "SELECT",
    icon: "IconStethoscope",
    description: "The worst thing the audit found — the opening line of the pitch.",
    options: [
      sel("NO_WEBSITE", "No website", "red", 0),
      sel("BROKEN", "Site down / broken", "red", 1),
      sel("NO_HTTPS", "No HTTPS", "orange", 2),
      sel("NOT_MOBILE", "Not mobile-ready", "orange", 3),
      sel("OUTDATED", "Outdated (old stack / stale)", "yellow", 4),
      sel("SLOW", "Slow", "yellow", 5),
      sel("SOCIAL_ONLY", "Facebook / Instagram only", "purple", 6),
      sel("OK", "Modern — low priority", "green", 7),
    ],
  },
  { name: "auditScore", label: "Need Score", type: "NUMBER", icon: "IconGauge", description: "0-100, higher = needs us more. Deterministic, from audit signals." },
  { name: "auditNotes", label: "Audit", type: "RICH_TEXT", icon: "IconFileSearch", description: "Every signal the audit read: status, HTTPS, viewport, generator, copyright year, load time, page weight." },
  {
    name: "offer",
    label: "Offer",
    type: "SELECT",
    icon: "IconGift",
    options: [
      sel("NEW_WEBSITE", "Website in a week", "blue", 0),
      sel("REBRAND", "Rebrand / rebuild", "purple", 1),
      sel("QR_ORDERING", "QR menu & ordering", "orange", 2),
      sel("BOOKING", "Booking site", "turquoise", 3),
      sel("SCHOOL_SYSTEM", "School system (Hogwarts)", "green", 4),
      sel("MOBILE_APP", "Mobile app", "pink", 5),
    ],
  },
  {
    name: "tier",
    label: "Tier",
    type: "SELECT",
    icon: "IconTrophy",
    options: [sel("A", "A — contact first", "green", 0), sel("B", "B", "yellow", 1), sel("C", "C", "gray", 2)],
  },
  { name: "phone", label: "Phone", type: "TEXT", icon: "IconPhone" },
  { name: "email", label: "Email", type: "TEXT", icon: "IconMail" },
  { name: "streetAddress", label: "Address", type: "TEXT", icon: "IconMapPin" }, // "address" is reserved in Twenty
  { name: "touchNumber", label: "Touch #", type: "NUMBER", icon: "IconHash" },
  { name: "lastTouchAt", label: "Last Touch", type: "DATE_TIME", icon: "IconCalendarTime" },
  { name: "source", label: "Source", type: "TEXT", icon: "IconRoute" },
  { name: "fingerprint", label: "Fingerprint", type: "TEXT", icon: "IconFingerprint", description: "osm:<type>/<id> — the dedup key." },
];

await ensureObject(OBJECT, FIELDS, { dryRun: DRY_RUN });
