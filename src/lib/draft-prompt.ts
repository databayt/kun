// The Gemini drafting prompt, single-sourced.
//
// MIRROR of scripts/lib/draft-prompt.mjs — this side serves the server action,
// the .mjs serves scripts (a .mjs cannot import TS and a handful of template
// literals does not justify a build step). Keep the two byte-identical in
// behaviour: src/lib/__tests__/draft-prompt.test.ts runs the same inputs
// through both and diffs the strings, the craft.mjs/craft.ts idiom.
//
// Before this pair existed the prompt lived in three unversioned places — the
// server action's template literal, a second copy in social-drafts.mjs, and
// each drifting from the other (one asked for 300-600 Arabic characters while
// the craft gate's floor is 400, so the prompt steered drafts INTO the
// refusal band). Edit here and in the .mjs mirror, never at a call site.
//
// Section ORDER is load-bearing: Gemini's implicit caching (free tier,
// measured ~65% token reuse — D-20260807 0.f) keys on an identical prefix, so
// static content — role, brand, scenes, house rules — comes first and the
// per-ask dynamics — brief, instruction, direction, lessons, violations —
// come last. Reordering a section is a cache invalidation, not a style edit.

import scenesData from "../../content/social/scenes.json";

/**
 * The one Gemini model the inline lane calls — chosen by measurement, not
 * vibes. D-20260807 timed four models against the craft gate:
 * gemini-3.6-flash hits p50 10.9s with 4/6 first-pass clean on a measured 20
 * requests/day free tier; gemini-2.5-flash runs ~24s and loses the ~10s
 * target the lane exists for.
 */
export const GEMINI_DRAFT_MODEL = "gemini-3.6-flash";

/**
 * Marks a pending row the inline lane REFUSED after a craft-tripping attempt
 * plus one corrective retry. Written into `SocialDraftRequest.note` (unused
 * on pending rows; `answer`/`fail` overwrite it, so the marker self-cleans).
 * drain-google skips marked rows — a poisoned brief would otherwise burn the
 * day's quota at two calls per 60s tick — and `list` surfaces them as
 * `craftRefused` so the Mac claude lane writes fresh copy avoiding the named
 * rules.
 */
export const CRAFT_REFUSED_PREFIX = "craft-refused:";

export const BRAND_CONTEXTS: Record<string, string> = {
  hogwarts:
    "hogwarts — school management SaaS (multi-tenant SIS/LMS: admission, attendance, timetable, exams, grades, finance). Audience: school owners, principals, and operators in MENA.",
  mkan: "mkan (مكان) — rental marketplace for property listings and bookings.",
  databayt:
    "databayt — the company itself: open source, the sharing-economy doctrine, engineering craft.",
  sijillee: "sijillee (سِجلي) — records/documents product.",
  moalimee: "moalimee (مُعلّمي) — teacher/tutor marketplace.",
};

interface SceneSeason {
  id: string;
  /** Calendar months (1-12) this window covers — Sudan-slice school year. */
  months: number[];
  label: string;
  scenes: string[];
}

interface BrandScenes {
  evergreen: string[];
  seasons: SceneSeason[];
}

/**
 * The scene bank for one brand, rendered for the prompt: the current season's
 * moments first, evergreen after, capped so the section stays a nudge rather
 * than a second brief. Returns undefined for a brand with no bank (only the
 * slice brand carries one today) — the prompt section is then omitted
 * entirely, copy.mdx's "an ask with no direction looks like one" rule.
 */
export function scenesFor(
  brand: string,
  now: Date = new Date(),
): string | undefined {
  const bank = (scenesData as unknown as Record<string, BrandScenes>)[brand];
  if (!bank) return undefined;
  const month = now.getMonth() + 1;
  const season = bank.seasons.find((s) => s.months.includes(month));
  const lines = [...(season ? season.scenes : []), ...bank.evergreen].slice(
    0,
    8,
  );
  if (lines.length === 0) return undefined;
  return lines.map((s) => `- ${s}`).join("\n");
}

export interface DraftPromptInput {
  brand: string;
  brief: string;
  /** A refinement turn's "what to change", separate from the root brief. */
  instruction?: string;
  angle?: string;
  register?: number;
  /** Concrete reader-week moments (scene bank) — static per brand+season. */
  scenes?: string;
  /** Aggregated dismiss reasons, e.g. "hook 3×, two-posts 1×". */
  lessons?: string;
  /** Named craft failures from the attempt this retry corrects. */
  violations?: string;
}

/**
 * Build the drafting prompt for one ask. Absent sections are omitted entirely
 * rather than rendered empty, so an ask with no direction LOOKS like an ask
 * with no direction.
 */
export function buildDraftPrompt(input: DraftPromptInput): string {
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
    '- Never open with the brand name, نحن, or "We\'re excited to announce" — the first line names a pain the reader has felt or a promise they want, in 12 words or fewer.',
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
