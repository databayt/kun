// Draft sources for the auto-post cron.
//
// Doctrine (unchanged from /docs/social): the relays deliver, they never write.
// Drafting is Claude-side or Hermes-side, and a human approves before anything
// reaches a public brand page. This module is the *drafting* half; lib/hermes,
// lib/telegram, and lib/facebook remain delivery-only.
//
// Two sources, selected by SOCIAL_DRAFT_SOURCE:
//
//   "hermes" (default) — post the drafting REQUEST into the Hermes gateway and
//     let Claude answer it there, matching the /social skill's doctrine exactly.
//     Requires HERMES_API_URL to be reachable from the server. Hermes is
//     Mac-local today, so on Vercel this reports "not configured" rather than
//     silently doing something else.
//
//   "anthropic" — draft server-side via the Anthropic API. Deliberately opt-in:
//     the engine's billing posture is subscription-only (no API-key spend), so
//     a daily cron must never start spending by default. Set the env var
//     explicitly to accept the cost.
//
// Neither source publishes. Both return copy for a human to approve.

import Anthropic from "@anthropic-ai/sdk";

import { getHermesConfig, sendSocialPost } from "@/lib/hermes";
import { MAX_TOKEN_TEXT } from "@/lib/social-token";

// Opus 4.8 by default — brand copy is the last thing to cheap out on. Override
// per-deployment if the bill says otherwise.
const DEFAULT_MODEL = "claude-opus-4-8";
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 30_000;

export interface DraftRequest {
  product: string;
  channel: string;
  /** en | ar — Arabic-first is the house default; see the /social skill. */
  locale: "en" | "ar";
}

export type DraftResult =
  { ok: true; text: string; source: string } | { ok: false; error: string };

const SYSTEM_PROMPT = `You write social-media copy for databayt, a Sudanese open-source software house building SaaS products for the MENA region.

Products you may be asked to write for:
- hogwarts — school management SaaS (multi-tenant SIS/LMS: admission, attendance, timetable, exams, grades, finance). Audience: school owners, principals, and operators in MENA.
- mkan (مكان) — rental marketplace for property listings and bookings.
- databayt — the company itself: open source, the sharing-economy doctrine, engineering craft.
- sijillee (سِجلي) — records/documents product.
- moalimee (مُعلّمي) — teacher/tutor marketplace.

House voice: plain, concrete, confident without hype. No emoji walls, no growth-hack punctuation, no "🚀 Excited to announce". Lead with the thing that is true and useful. One idea per post. Arabic copy is written natively, not translated — idiomatic MENA Arabic, not MSA press-release register.

Hard rules:
- Return ONLY the post body. No preamble, no quotes around it, no markdown headings.
- Maximum ${MAX_TOKEN_TEXT} characters. Aim for far shorter — 300-600 characters reads best.
- Never invent a metric, a customer name, a price, a launch date, or a feature that was not given to you. If you have no news, write something evergreen and true about the product's purpose.
- At most 3 hashtags, and only where the channel expects them.
- Never include a link unless one was supplied.`;

const DRAFT_TOOL: Anthropic.Tool = {
  name: "draft_post",
  description: "Return one social post body for the given product and channel.",
  input_schema: {
    type: "object",
    required: ["text"],
    properties: {
      text: {
        type: "string",
        description:
          "The post body exactly as it should appear. No preamble, no surrounding quotes.",
      },
    },
  },
};

function userPrompt({ product, channel, locale }: DraftRequest): string {
  const language =
    locale === "ar" ? "Arabic (native, not translated)" : "English";
  return [
    `Write one ${channel} post for the "${product}" brand, in ${language}.`,
    `There is no specific news today — write something evergreen and true about what ${product} does and who it is for.`,
    `Return it through the draft_post tool.`,
  ].join("\n");
}

async function draftViaAnthropic(req: DraftRequest): Promise<DraftResult> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY not set." };
  }
  const model = (process.env.SOCIAL_DRAFT_MODEL ?? "").trim() || DEFAULT_MODEL;

  try {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
    // Forced tool use is how we get a bare string back without parsing prose —
    // same trick as lib/report/triage.ts.
    const message = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [DRAFT_TOOL],
      tool_choice: { type: "tool", name: "draft_post" },
      messages: [{ role: "user", content: userPrompt(req) }],
    });

    const block = message.content.find((b) => b.type === "tool_use");
    const text =
      block && block.type === "tool_use"
        ? (block.input as { text?: unknown }).text
        : undefined;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "Model returned no draft." };
    }
    return { ok: true, text: text.trim(), source: `anthropic:${model}` };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Anthropic drafting failed.",
    };
  }
}

async function draftViaHermes(req: DraftRequest): Promise<DraftResult> {
  const { url } = await getHermesConfig();
  if (!url) {
    return {
      ok: false,
      error:
        "HERMES_API_URL not set — Hermes is the default draft source and is not reachable from this deployment. Set SOCIAL_DRAFT_SOURCE=anthropic to draft server-side instead (accepts API spend).",
    };
  }
  // Hermes answers asynchronously in its own channel — the relay call only
  // delivers the ask. The cron reports the hand-off; the reply comes back to the
  // humans watching that channel, who then paste it into /social.
  const res = await sendSocialPost({
    text: [
      `Draft request — ${req.product} / ${req.channel} (${req.locale}).`,
      `Reply with post copy only, under ${MAX_TOKEN_TEXT} characters, house voice.`,
    ].join("\n"),
    channels: [reviewChannel()],
    title: `social draft request: ${req.product}`,
    metadata: { kind: "draft_request", ...req },
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Hermes relay failed." };
  return {
    ok: false,
    error:
      "Draft request handed to Hermes — reply lands in the review channel.",
  };
}

export function reviewChannel(): string {
  return (process.env.SOCIAL_REVIEW_CHANNEL ?? "").trim() || "slack";
}

export function draftSource(): "hermes" | "anthropic" {
  return (process.env.SOCIAL_DRAFT_SOURCE ?? "").trim().toLowerCase() ===
    "anthropic"
    ? "anthropic"
    : "hermes";
}

export async function draftPost(req: DraftRequest): Promise<DraftResult> {
  return draftSource() === "anthropic"
    ? draftViaAnthropic(req)
    : draftViaHermes(req);
}
