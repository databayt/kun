#!/usr/bin/env tsx
// ── Build jobs/facts.json — the only claims a letter may make ────────────────
//
//   pnpm jobs:facts
//
// The send gate rejects any number a letter asserts that is not in here (or in
// the posting itself). Sources: the CV HTML (what Abdout already signs his
// name to) and cv-evidence.ts (the extracted, dated claims). Re-run after any
// CV edit; the wave step does it automatically.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import { CV_EVIDENCE_FACTS } from "@/lib/jobs/cv-evidence";
import { numbersIn } from "@/lib/jobs/send-gate";

const text = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const cvs = readdirSync("jobs/cv")
  .filter((f) => f.endsWith(".html"))
  .map((f) => ({ file: f, text: text(readFileSync(`jobs/cv/${f}`, "utf-8")) }));

// Facts Abdout supplies himself (a salary figure, a registration number)
// that no CV carries. Each is dated and attributed in the file.
const extra: { numbers?: string[]; claims?: string[] } = existsSync("jobs/facts.extra.json")
  ? JSON.parse(readFileSync("jobs/facts.extra.json", "utf-8"))
  : {};

const claims = [
  ...(extra.claims ?? []),
  ...cvs.map((c) => `CV ${c.file}: ${c.text}`),
  ...CV_EVIDENCE_FACTS.map((f) => `${f.claim} (${f.rawProof})`),
];

const numbers = [...new Set([...claims.flatMap(numbersIn), ...(extra.numbers ?? [])])].sort();

writeFileSync(
  "jobs/facts.json",
  JSON.stringify(
    { generatedAt: new Date().toISOString(), numbers, claims },
    null,
    2,
  ) + "\n",
);
console.log(
  `jobs/facts.json <- ${numbers.length} numbers, ${claims.length} claims from ${cvs.length} CVs + ${CV_EVIDENCE_FACTS.length} evidence facts`,
);
