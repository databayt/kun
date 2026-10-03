#!/usr/bin/env node
// ── Create the "Funding & Programs" object in the Twenty Databayt workspace ──
//
//   node scripts/crm-funding-object.mjs --dry-run   print payloads, write nothing
//   node scripts/crm-funding-object.mjs             create what is missing
//
// Abdout asked for this board separate from "Jobs & Opportunities"
// (2026-10-03): incubators, accelerators, grants, credits, competitions,
// fellowships and investors carry cohort dates, equity terms and a ticket
// size — none of which a job card has. Rows come from jobs/funding.seed.json
// via `pnpm jobs:funding`. The ladder rung is reference_fundraising_ladder:
// 1 credits · 2 grants · 3 zero-equity accelerators · 4 SAFE · 5 priced seed.

import { COUNTRY_OPTIONS } from "./lib/crm-markets.mjs";
import { ensureObject } from "./lib/twenty-object.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const OBJECT = {
  nameSingular: "fundingProgram",
  namePlural: "fundingPrograms",
  labelSingular: "Program",
  labelPlural: "Funding & Programs",
  icon: "IconRocket",
  isLabelSyncedWithName: false,
  description:
    "Incubators, accelerators, grants, cloud credits, competitions, fellowships and investors for Abdout and Databayt across Rwanda, Kenya, Nigeria, the Gulf and Sudan. Fed by `pnpm jobs:funding`; non-dilutive rungs first.",
};

const sel = (value, label, color, position) => ({
  value,
  label,
  color,
  position,
});

const FIELDS = [
  {
    name: "company",
    label: "Organisation",
    type: "RELATION",
    icon: "IconBuildingBank",
    description: "The fund, hub or program operator.",
    relation: {
      targetFieldLabel: "Funding",
      targetFieldIcon: "IconRocket",
      type: "MANY_TO_ONE",
    },
  },
  {
    name: "programType",
    label: "Type",
    type: "SELECT",
    icon: "IconCategory",
    options: [
      sel("CREDITS", "Cloud / vendor credits", "sky", 0),
      sel("GRANT", "Grant", "green", 1),
      sel("INCUBATOR", "Incubator", "turquoise", 2),
      sel("ACCELERATOR", "Accelerator", "blue", 3),
      sel("COMPETITION", "Competition / prize", "yellow", 4),
      sel("FELLOWSHIP", "Fellowship", "purple", 5),
      sel("ANGEL", "Angel / network", "orange", 6),
      sel("VC", "VC fund", "red", 7),
      sel("LOAN", "Loan / debt", "gray", 8),
    ],
  },
  {
    name: "status",
    label: "Status",
    type: "SELECT",
    icon: "IconProgressCheck",
    options: [
      sel("TO_REVIEW", "To review", "gray", 0),
      sel("ELIGIBLE", "Eligible", "blue", 1),
      sel("NOT_ELIGIBLE", "Not eligible", "gray", 2),
      sel("PREPARING", "Preparing", "yellow", 3),
      sel("SUBMITTED", "Submitted", "purple", 4),
      sel("INTERVIEW", "Interview / pitch", "orange", 5),
      sel("ACCEPTED", "Accepted", "green", 6),
      sel("REJECTED", "Rejected", "red", 7),
      sel("CLAIMED", "Claimed / received", "turquoise", 8),
    ],
  },
  {
    name: "country",
    label: "Country",
    type: "SELECT",
    icon: "IconFlag",
    options: COUNTRY_OPTIONS,
  },
  { name: "city", label: "City", type: "TEXT", icon: "IconBuildingCommunity" },
  {
    name: "beneficiary",
    label: "For",
    type: "SELECT",
    icon: "IconUser",
    description:
      "Who applies: Abdout himself, Databayt the company, or the Hogwarts product.",
    options: [
      sel("FOUNDER", "Founder — Abdout", "blue", 0),
      sel("DATABAYT", "Databayt", "purple", 1),
      sel("HOGWARTS", "Hogwarts (edtech)", "green", 2),
    ],
  },
  {
    name: "equity",
    label: "Equity",
    type: "SELECT",
    icon: "IconPercentage",
    options: [
      sel("NONE", "None — non-dilutive", "green", 0),
      sel("EQUITY", "Equity", "red", 1),
      sel("SAFE", "SAFE / convertible", "orange", 2),
      sel("REVENUE_SHARE", "Revenue share", "yellow", 3),
    ],
  },
  {
    name: "amountUsd",
    label: "Amount (USD)",
    type: "NUMBER",
    icon: "IconCurrencyDollar",
    description: "Cash or credit value, upper bound where a range is stated.",
  },
  {
    name: "ladderRung",
    label: "Ladder Rung",
    type: "NUMBER",
    icon: "IconStairs",
    description:
      "1 credits · 2 grants · 3 zero-equity accelerators · 4 SAFE · 5 priced seed.",
  },
  {
    name: "deadline",
    label: "Deadline",
    type: "DATE_TIME",
    icon: "IconCalendarDue",
    description: "Next application close; empty = rolling.",
  },
  {
    name: "cohortStart",
    label: "Cohort Start",
    type: "DATE_TIME",
    icon: "IconCalendarEvent",
  },
  {
    name: "eligibility",
    label: "Eligibility",
    type: "RICH_TEXT",
    icon: "IconChecklist",
    description:
      "Fit for a Sudanese national resident in Rwanda; registration, stage and sector rules.",
  },
  { name: "programUrl", label: "Program URL", type: "LINKS", icon: "IconLink" },
  { name: "applyUrl", label: "Apply URL", type: "TEXT", icon: "IconForms" },
  { name: "source", label: "Source", type: "TEXT", icon: "IconRoute" },
  {
    name: "fingerprint",
    label: "Fingerprint",
    type: "TEXT",
    icon: "IconFingerprint",
    description: "Dedup key: slug of operator + program.",
  },
];

await ensureObject(OBJECT, FIELDS, { dryRun: DRY_RUN });
