// The Gemini drafting prompt, single-sourced.
//
// MIRROR of src/lib/draft-prompt.ts — the TS side serves the server action,
// this side serves scripts (a .mjs cannot import TS and a handful of template
// literals does not justify a build step). Keep the two byte-identical in
// behaviour: src/lib/__tests__/draft-prompt.test.ts runs the same inputs
// through both and diffs the strings, the craft.mjs/craft.ts idiom.
//
// Before this pair existed the prompt lived in three unversioned places — the
// server action's template literal, a second copy in social-drafts.mjs, and
// each drifting from the other (one asked for 300-600 Arabic characters while
// the craft gate's floor is 400, so the prompt steered drafts INTO the
// refusal band). Edit here and in the TS mirror, never at a call site.
//
// Section ORDER is load-bearing: Gemini's implicit caching (free tier,
// measured ~65% token reuse — D-20260807 0.f) keys on an identical prefix, so
// static content — role, brand, scenes, house rules — comes first and the
// per-ask dynamics — brief, instruction, direction, lessons, violations —
// come last. Reordering a section is a cache invalidation, not a style edit.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The model D-20260807 measured and chose. See src/lib/draft-prompt.ts. */
export const GEMINI_DRAFT_MODEL = "gemini-3.6-flash";

const scenesData = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "content",
      "social",
      "scenes.json",
    ),
    "utf8",
  ),
);

/**
 * The scene bank for one brand, rendered for the prompt: the current season's
 * moments first, evergreen after, capped so the section stays a nudge rather
 * than a second brief. Returns undefined for a brand with no bank — the
 * prompt section is then omitted entirely.
 */
export function scenesFor(brand, now = new Date()) {
  const bank = scenesData[brand];
  if (!bank || !Array.isArray(bank.seasons)) return undefined;
  const month = now.getMonth() + 1;
  const season = bank.seasons.find((s) => s.months.includes(month));
  const lines = [
    ...(season ? season.scenes : []),
    ...(bank.evergreen ?? []),
  ].slice(0, 8);
  if (lines.length === 0) return undefined;
  return lines.map((s) => `- ${s}`).join("\n");
}

/** Marker on a pending row's note after the Gemini lane's craft refusal. */
export const CRAFT_REFUSED_PREFIX = "craft-refused:";

export const BRAND_CONTEXTS = {
  hogwarts:
    "hogwarts — school management SaaS (multi-tenant SIS/LMS: admission, attendance, timetable, exams, grades, finance). Audience: school owners, principals, and operators in MENA.",
  mkan: "mkan (مكان) — rental marketplace for property listings and bookings.",
  databayt:
    "databayt — the company itself: open source, the sharing-economy doctrine, engineering craft.",
  sijillee: "sijillee (سِجلي) — records/documents product.",
  moalimee: "moalimee (مُعلّمي) — teacher/tutor marketplace.",
};

/**
 * Build the drafting prompt for one ask.
 *
 * input: { brand, brief, instruction?, angle?, register?, scenes?, lessons?,
 * violations? } — all strings except register (number). Absent sections are
 * omitted entirely rather than rendered empty, so an ask with no direction
 * LOOKS like an ask with no direction.
 */
export function buildDraftPrompt(input) {
  const brandContext =
    BRAND_CONTEXTS[input.brand] ?? `${input.brand} — SaaS product by Databayt.`;

  const lines = [
    "You are Databayt's lead social media writer for MENA.",
    `Product: ${brandContext}`,
  ];

  if (input.scenes) {
    lines.push(
      "",
      "Scenes from the reader's own week — ground the post in one it can honestly claim (docs contain no Thursdays; these do):",
      input.scenes,
    );
  }

  lines.push(
    "",
    "House Rules:",
    '- Return ONLY valid JSON with keys "ar" and "en".',
    '- Arabic copy ("ar"): native, engaging Arabic — 400-900 characters. Use Latin digits (1, 2, 3), never Arabic-Indic (١, ٢, ٣). No emoji in the first line and at most one anywhere. No exclamation marks.',
    '- English copy ("en"): a sibling of the Arabic, not a translation — it may differ in length, in what it leads with, and in which detail it keeps. Plain, concrete, confident.',
    "- Never open with the brand name, نحن, or \"We're excited to announce\" — the first line names a pain the reader has felt or a promise they want, in 12 words or fewer.",
    "- One idea per post. A bulleted feature list is two posts, not one.",
    "- Never invent a number, name, price, or date that is not in the brief.",
    '- Format: {"ar": "...", "en": "..."}',
    "",
    `User Brief: ${input.brief}`,
  );

  if (input.instruction) {
    lines.push(`Refinement Instruction: ${input.instruction}`);
  }

  lines.push(
    `Angle directive: ${input.angle ?? "Choose the best angle (pain, moment, or proof)"}`,
    `Arabic Register directive: Rung ${input.register ?? 2} (2=simplified MSA, 3=pan-Arab colloquial, 4=local dialect)`,
  );

  if (input.lessons) {
    lines.push(
      `Reviewers recently dismissed drafts for: ${input.lessons} — these are habits to break, not suggestions.`,
    );
  }

  if (input.violations) {
    lines.push(
      "",
      "Your previous attempt failed these craft rules — fix every one of them without breaking the others:",
      input.violations,
    );
  }

  return lines.join("\n");
}
