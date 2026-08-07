// The direction a contributor can give a draft without writing prose about it —
// single source of truth for the Hub's controls, the server action's Zod gate,
// and the drain's prompt.
//
// None of this vocabulary is new. `content/docs/social/copy.mdx` defines the
// three angles and the four-rung register ladder, and `content/social/pillars.json`
// has been writing both INTO its brief strings since the seed lane shipped —
// with a $comment explaining that a separate JSON field would be "written and
// read by nobody". These are that convention given a home the UI can reach and
// the queue can store.
//
// This module imports nothing, deliberately: the Zod schema in actions and the
// client component both pull from it, and either import closing a cycle would
// be worse than the duplication it prevents.

/**
 * The engine's model chain (`.claude/engine.json`), in preference order.
 *
 * These ids reach `claude -p --model` on a contributor's machine via the drain,
 * so they are execution parameters rather than labels — which is why the action
 * validates against this list instead of accepting any string. Before the
 * `model` column existed the Hub's select changed nothing at all; the code said
 * so, and this is the list that made it real.
 */
export const DRAFT_MODELS = [
  { id: "google-free", label: "Google Free (Gemini 2.5 Pro)" },
  { id: "claude-fable-5", label: "Fable 5" },
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-sonnet-5", label: "Sonnet 5" },
] as const;

export type DraftModelId = (typeof DRAFT_MODELS)[number]["id"];

export const DRAFT_MODEL_IDS = DRAFT_MODELS.map((m) => m.id) as [
  DraftModelId,
  ...DraftModelId[],
];

/** The house default — Google Free (Gemini 2.5 Pro) with high reasoning effort. */
export const DEFAULT_DRAFT_MODEL: DraftModelId = "google-free";

/**
 * copy.mdx's three angles. The skill already names three and picks the survivor;
 * setting one here means the ASKER made that call, which is the difference
 * between "write me something" and direction.
 *
 * Unset is a first-class answer, not a missing value: it means the writer still
 * runs the three-angle discipline itself.
 */
export const DRAFT_ANGLES = [
  { id: "pain", label: "The pain", labelAr: "الوجع" },
  { id: "moment", label: "The moment", labelAr: "اللحظة" },
  { id: "proof", label: "The proof", labelAr: "البرهان" },
] as const;

export type DraftAngleId = (typeof DRAFT_ANGLES)[number]["id"];

/**
 * Rungs on copy.mdx's Arabic register ladder that a contributor may ask for.
 *
 * Rung 1 (فصحى الصحافة) is absent on purpose — the ladder calls it the failure
 * mode and says it never ships, so offering it as a choice would make the UI
 * contradict the doctrine. The column still stores 1..4 so the stored value
 * means "a rung on the ladder" rather than "a rung the Hub happens to offer".
 */
export const DRAFT_REGISTERS = [
  {
    id: 2,
    label: "Rung 2 — simplified MSA",
    labelAr: "الدرجة ٢ — فصحى معاصرة مبسّطة",
    hint: "The house default. Active verbs, one clause a sentence, nouns the reader touches.",
    hintAr:
      "الوضع الافتراضي. أفعال مبنية للمعلوم، جملة واحدة، ومفردات يلمسها القارئ.",
  },
  {
    id: 3,
    label: "Rung 3 — pan-Arab colloquial",
    labelAr: "الدرجة ٣ — عامية بيضاء",
    hint: "MSA skeleton, spoken vocabulary, no country markers. Consumer and short-form only.",
    hintAr:
      "هيكل فصيح بمفردات محكية دون سمات قُطرية. للمحتوى الاستهلاكي والقصير فقط.",
  },
  {
    id: 4,
    label: "Rung 4 — local dialect",
    labelAr: "الدرجة ٤ — لهجة محلية",
    hint: "Only where a brand doc names one — Sudanese for sijillee, and only on its channels.",
    hintAr: "فقط حيث تنصّ صفحة العلامة — السودانية لسجلي، وعلى قنواتها وحدها.",
  },
] as const;

export type DraftRegisterId = (typeof DRAFT_REGISTERS)[number]["id"];

/**
 * The craft checks a reviewer dismisses against, stored structurally so the
 * writing side can read them back.
 *
 * The ids are the aggregation key `social-drafts.mjs lessons` groups by, so they
 * are stable strings rather than the reviewer-facing label — which is free to be
 * reworded or translated without orphaning a month of history.
 *
 * `src/lib/craft.ts` maps every mechanical rule onto one of these, so a linter
 * refusal and a human dismissal name the same thing. `cta` and `length` were
 * added when the linter shipped (2026-08-06): both are checks copy.mdx already
 * names, and a reviewer dismissing "the link is buried" or "this is three
 * paragraphs too long" had nowhere to put it but `other`.
 */
export const DISMISS_REASONS = [
  { id: "hook", check: 1 },
  { id: "two-posts", check: 2 },
  { id: "untrue", check: null },
  { id: "register", check: null },
  { id: "cta", check: 6 },
  { id: "length", check: null },
  { id: "other", check: null },
] as const;

export type DismissReasonId = (typeof DISMISS_REASONS)[number]["id"];

export const DISMISS_REASON_IDS = DISMISS_REASONS.map((r) => r.id) as [
  DismissReasonId,
  ...DismissReasonId[],
];
