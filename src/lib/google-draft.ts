import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  buildDraftPrompt,
  GEMINI_DRAFT_MODEL,
  scenesFor,
} from "@/lib/draft-prompt";

// The model id, the refusal marker, and the prompt live in the mirror pair
// src/lib/draft-prompt.ts ⇄ scripts/lib/draft-prompt.mjs (parity-pinned by
// draft-prompt.test.ts). Re-exported here because this module is the lane's
// public face — callers reason about "the google draft lane", not about
// where its prompt happens to live.
export { CRAFT_REFUSED_PREFIX, GEMINI_DRAFT_MODEL } from "@/lib/draft-prompt";

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
  /** A refinement turn's "what to change" — travels beside the root brief. */
  instruction?: string;
  angle?: string;
  register?: number;
  /** Aggregated dismiss reasons for this brand, e.g. "hook 3×, two-posts 1×". */
  lessons?: string;
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

export async function draftWithGeminiFree(
  params: GoogleDraftParams,
): Promise<GoogleDraftResult> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not configured." };
  }

  const prompt = buildDraftPrompt({
    brand: params.product,
    brief: params.brief,
    instruction: params.instruction,
    angle: params.angle,
    register: params.register,
    // Scenes are a property of brand + season, not of the ask — computed
    // here so every caller gets check 4's raw material for free.
    scenes: scenesFor(params.product),
    lessons: params.lessons,
    violations: params.violations,
  });

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
