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

import {
  checkHermesHealth,
  getHermesConfig,
  sendSocialPost,
} from "@/lib/hermes";

// Opus 4.8 by default — brand copy is the last thing to cheap out on. Override
// per-deployment if the bill says otherwise.
// A drafting target, not a hard limit. This used to be the approval-link cap
// (the copy rode inside the URL); now the token carries only a variant id, so
// the number is purely about what reads well in a feed.
const TARGET_CHARS = 1200;

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
  | { ok: true; text: string; source: string }
  // Three distinct non-ok shapes the cron must tell apart:
  //   transient — Hermes is configured but unreachable right now; retry later.
  //   handoff   — the ask reached Hermes; the reply arrives async in the channel.
  //   (neither) — a genuine failure worth flagging.
  | { ok: false; error: string; transient?: boolean; handoff?: boolean };

// This lane is dark (see `draftBrief`'s note, D-20260730): Hermes is parked and
// the Anthropic path spends an API key we deliberately do not fund, so nothing
// below writes a word of production copy today. **The live doctrine is
// `content/docs/social/copy.mdx`** — the seven checks, the Arabic register
// ladder, and the wordlist — which `/draft` reads on the Max pool instead.
//
// Do not treat this constant as a second source of truth; it is already behind
// (no register ladder, no reject list, a stale 300-600 char target). If credits
// are ever bought and this lane relit, inline that document here first.
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
- Maximum ${TARGET_CHARS} characters. Aim for far shorter — 300-600 characters reads best.
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

  // Hermes runs on a personal machine and is expected to flap. Probe before
  // relying on it: a machine that's merely asleep must read as "skipped, retry
  // next run", not as a config error (which is permanent) or a hard failure
  // (which reads as something to fix). Without this, a laptop lid closing at
  // 06:00 UTC looks identical to a broken deployment.
  const health = await checkHermesHealth();
  if (!health.ok) {
    // Opt-in fallback, gated exactly like SOCIAL_DRAFT_SOURCE=anthropic: only
    // spend on the API when a human has accepted the cost via /decide. Off by
    // default, so a Hermes outage never silently starts billing.
    if (
      draftFallbackAnthropic() &&
      (process.env.ANTHROPIC_API_KEY ?? "").trim()
    ) {
      return draftViaAnthropic(req);
    }
    return {
      ok: false,
      transient: true,
      error: `Hermes is configured but unreachable right now (${health.error ?? "no response"}). Draft skipped — it'll retry next run. Set SOCIAL_DRAFT_FALLBACK=anthropic to draft server-side while it's down (accepts API spend).`,
    };
  }

  // Hermes answers asynchronously in its own channel — the relay call only
  // delivers the ask. The cron reports the hand-off; the reply comes back to the
  // humans watching that channel, who then paste it into /social.
  const res = await sendSocialPost({
    text: [
      `Draft request — ${req.product} / ${req.channel} (${req.locale}).`,
      `Reply with post copy only, under ${TARGET_CHARS} characters, house voice.`,
    ].join("\n"),
    channels: [reviewChannel()],
    title: `social draft request: ${req.product}`,
    metadata: { kind: "draft_request", ...req },
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Hermes relay failed." };
  // Not a failure — the ask landed. Flagged so the cron reports a hand-off
  // rather than counting it as a failed draft (which it did before, flipping
  // the whole run's `ok` to false on the expected happy path).
  return {
    ok: false,
    handoff: true,
    error:
      "Draft request handed to Hermes — reply lands in the review channel.",
  };
}

const BILINGUAL_TOOL: Anthropic.Tool = {
  name: "draft_bilingual",
  description:
    "Return one social post as an Arabic original and its English sibling.",
  input_schema: {
    type: "object",
    required: ["ar", "en"],
    properties: {
      ar: {
        type: "string",
        description:
          "The Arabic post body, crafted natively. No preamble, no surrounding quotes.",
      },
      en: {
        type: "string",
        description:
          "The English post body — a sibling of the Arabic, not a literal translation.",
      },
    },
  },
};

export interface BriefRequest {
  product: string;
  /** The contributor's ask, verbatim — topic, news, angle. */
  brief: string;
}

export type BriefResult =
  | { ok: true; ar: string; en: string; source: string }
  | { ok: false; error: string };

// The FUNDED lane for a contributor's brief — currently unused.
//
// The Hub's agent window does not call this: a live production test on
// 2026-07-30 found no API key with credits behind it (subscription-only
// billing, so there is nothing for one to spend — see
// .claude/memory/decisions/2026-07-30-in-app-draft-spend.md). Briefs are queued
// as SocialDraftRequest rows and answered by a Claude Code session on the Max
// pool instead. This function is kept, tested, and one funded key away: if
// credits are ever bought, wire requestSocialDraft to call it and the window
// drafts inline again. Always Anthropic by design — never SOCIAL_DRAFT_SOURCE,
// so the cron's no-spend default gains no side door.
export async function draftBrief(req: BriefRequest): Promise<BriefResult> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY not set." };
  }
  const model = (process.env.SOCIAL_DRAFT_MODEL ?? "").trim() || DEFAULT_MODEL;

  try {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
    const message = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [BILINGUAL_TOOL],
      tool_choice: { type: "tool", name: "draft_bilingual" },
      messages: [
        {
          role: "user",
          content: [
            `Write one social post for the "${req.product}" brand — the channel-agnostic core piece; channels get their variants later.`,
            `The contributor's brief:`,
            req.brief,
            ``,
            `Craft the Arabic natively first, then write the English as a mirror of it — a sibling, not a translation. Return both through the draft_bilingual tool.`,
          ].join("\n"),
        },
      ],
    });

    const block = message.content.find((b) => b.type === "tool_use");
    const input =
      block && block.type === "tool_use"
        ? (block.input as { ar?: unknown; en?: unknown })
        : undefined;
    const ar = typeof input?.ar === "string" ? input.ar.trim() : "";
    const en = typeof input?.en === "string" ? input.en.trim() : "";
    if (!ar || !en) {
      return { ok: false, error: "Model returned an incomplete draft." };
    }
    return { ok: true, ar, en, source: `anthropic:${model}` };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Anthropic drafting failed.",
    };
  }
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

// Whether a Hermes outage may fall back to server-side drafting. Opt-in, and
// deliberately separate from SOCIAL_DRAFT_SOURCE: the default source stays
// Hermes (free), and only an explicit flag lets a downtime spend API money.
export function draftFallbackAnthropic(): boolean {
  return (
    (process.env.SOCIAL_DRAFT_FALLBACK ?? "").trim().toLowerCase() ===
    "anthropic"
  );
}

export async function draftPost(req: DraftRequest): Promise<DraftResult> {
  return draftSource() === "anthropic"
    ? draftViaAnthropic(req)
    : draftViaHermes(req);
}
