import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * The one Gemini model the inline lane calls — chosen by measurement, not vibes.
 *
 * D-20260807 (.claude/memory/decisions/2026-08-07-gemini-inline-draft.md) timed
 * four models against the craft gate: gemini-3.6-flash hits p50 10.9s with 4/6
 * first-pass clean on a measured 20 requests/day free tier. gemini-2.5-flash —
 * what this file called before the reconcile — runs ~24s and loses the ~10s
 * target the lane exists for. `scripts/social-drafts.mjs` mirrors this value
 * (a .mjs cannot import TS); `src/lib/__tests__/google-draft.test.ts` pins the
 * two together.
 */
export const GEMINI_DRAFT_MODEL = "gemini-3.6-flash";

/**
 * The bilingual pair every draft lane returns. generateObject validates the
 * model's output against this at the SDK layer — a malformed or truncated
 * response throws instead of leaking `{ar: undefined}` downstream.
 */
const draftObjectSchema = z.object({
  ar: z.string().min(1),
  en: z.string().min(1),
});

/**
 * Marks a pending row the inline lane REFUSED after a craft-tripping attempt
 * plus one corrective retry. Written into `SocialDraftRequest.note` (verified
 * unused on pending rows; `answer`/`fail` overwrite it, so the marker
 * self-cleans). Three readers key on it:
 *
 *   - `drain-google` skips marked rows, or a poisoned brief would burn the
 *     20-requests/day free tier at two calls per 60s tick;
 *   - `list` surfaces it as `craftRefused`, so the Mac claude lane writes
 *     fresh copy avoiding the named rules;
 *   - nothing else — the row stays an ordinary `pending` ask.
 *
 * Mirrored as CRAFT_REFUSED in scripts/social-drafts.mjs; pinned together by
 * src/lib/__tests__/google-draft.test.ts.
 */
export const CRAFT_REFUSED_PREFIX = "craft-refused:";

/**
 * The one-variable revert D-20260807 names: `SOCIAL_DRAFT_INLINE=off` returns
 * the lane to queue-only behaviour — every ask lands `pending` and the Mac
 * drain answers it, exactly the pre-inline world. Anything else (including
 * unset) means ON: the lane exists because a contributor asked for ~10
 * seconds, so the default is the fast path and the env var is the brake.
 */
export function inlineDraftEnabled(): boolean {
  return (process.env.SOCIAL_DRAFT_INLINE ?? "").trim().toLowerCase() !== "off";
}

export interface GoogleDraftParams {
  product: string;
  brief: string;
  angle?: string;
  register?: number;
  /**
   * Named craft-rule failures from a previous attempt, e.g.
   * "invented-number: 40% is not in the brief". Present only on the one
   * corrective retry the lane allows.
   */
  violations?: string;
}

export interface GoogleDraftResult {
  ok: boolean;
  ar?: string;
  en?: string;
  error?: string;
}

const BRAND_CONTEXTS: Record<string, string> = {
  hogwarts:
    "hogwarts — school management SaaS (multi-tenant SIS/LMS: admission, attendance, timetable, exams, grades, finance). Audience: school owners, principals, and operators in MENA.",
  mkan: "mkan (مكان) — rental marketplace for property listings and bookings.",
  databayt:
    "databayt — the company itself: open source, the sharing-economy doctrine, engineering craft.",
  sijillee: "sijillee (سِجلي) — records/documents product.",
  moalimee: "moalimee (مُعلّمي) — teacher/tutor marketplace.",
};

export async function draftWithGeminiFree(
  params: GoogleDraftParams,
): Promise<GoogleDraftResult> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not configured." };
  }

  const brandContext =
    BRAND_CONTEXTS[params.product] ??
    `${params.product} — SaaS product by Databayt.`;

  const prompt = `You are Databayt's lead social media writer for MENA.
Write a social media post for product: ${params.product}.
Product description: ${brandContext}
User Brief: ${params.brief}
Angle directive: ${params.angle ?? "Choose the best angle (pain, moment, or proof)"}
Arabic Register directive: Rung ${params.register ?? 2} (2=simplified MSA, 3=pan-Arab, 4=Sudanese dialect)

House Rules:
- Return ONLY valid JSON with keys "ar" and "en".
- Arabic copy ("ar"): Write native, engaging Arabic (300-600 characters). Use Latin digits (1, 2, 3) rather than Arabic-Indic digits (١, ٢, ٣). No "🚀" or clickbait.
- English copy ("en"): Parallel English post (300-600 characters). Plain, concrete, confident.
- Format: {"ar": "...", "en": "..."}${
    params.violations
      ? `

Your previous attempt failed these craft rules — fix every one of them without breaking the others:
${params.violations}`
      : ""
  }`;

  try {
    // AI SDK generateObject replaces the hand-rolled fetch + JSON.parse: the
    // provider drives Gemini's native responseSchema (honoured on free tier —
    // D-20260807 0.c) and validates the result against the zod schema, so the
    // tolerant-parser problem never comes back. Provider swap is one line:
    // when the anthropic lane is ever funded, this becomes
    // `createAnthropic({...})` + a model id and nothing else moves.
    const google = createGoogle({ apiKey });
    const { object } = await generateObject({
      model: google(GEMINI_DRAFT_MODEL),
      schema: draftObjectSchema,
      prompt,
      temperature: 0.7,
      // Thinking tokens count against the output budget; at 2000 the JSON
      // truncated and parsed as garbage. 8000 is the measured working floor
      // (D-20260807 0.c).
      maxOutputTokens: 8000,
      // Fresh per call — the craft-gate retry gets its own 20s, not the
      // remainder of the first attempt's.
      abortSignal: AbortSignal.timeout(20_000),
    });

    return {
      ok: true,
      ar: object.ar.trim(),
      en: object.en.trim(),
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to draft with Gemini.",
    };
  }
}
