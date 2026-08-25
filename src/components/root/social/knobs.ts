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
 * `role` is that order said out loud, so a picker does not have to imply it by
 * position: `model` in engine.json is the default, `fallback_models` is the
 * rest, in the order written there.
 *
 * These ids reach `claude -p --model` on a contributor's machine via the drain,
 * so they are execution parameters rather than labels — which is why the action
 * validates against this list instead of accepting any string. Before the
 * `model` column existed the Hub's select changed nothing at all; the code said
 * so, and this is the list that made it real.
 */
export const DRAFT_MODELS = [
  {
    id: "google-free",
    label: "Google Free (Gemini 3.6 Flash)",
    role: "House default",
    roleAr: "الافتراضي",
  },
  {
    id: "claude-fable-5",
    label: "Fable 5",
    role: "First fallback",
    roleAr: "البديل الأول",
  },
  {
    id: "claude-opus-4-8",
    label: "Opus 4.8",
    role: "Second fallback",
    roleAr: "البديل الثاني",
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    role: "Third fallback",
    roleAr: "البديل الثالث",
  },
] as const;

export type DraftModelId = (typeof DRAFT_MODELS)[number]["id"];

export const DRAFT_MODEL_IDS = DRAFT_MODELS.map((m) => m.id) as [
  DraftModelId,
  ...DraftModelId[],
];

/** The house default — Google Free (Gemini 3.6 Flash), the model D-20260807 measured. */
export const DEFAULT_DRAFT_MODEL: DraftModelId = "google-free";

/**
 * copy.mdx's three angles. The skill already names three and picks the survivor;
 * setting one here means the ASKER made that call, which is the difference
 * between "write me something" and direction.
 *
 * Unset is a first-class answer, not a missing value: it means the writer still
 * runs the three-angle discipline itself.
 *
 * The hints are copy.mdx's own one-line definitions, verbatim. An angle picked
 * from its name alone is a guess — "the proof" and "the pain" are only
 * distinguishable once you know one is a cost and the other is a fact.
 */
export const DRAFT_ANGLES = [
  {
    id: "pain",
    label: "The pain",
    labelAr: "الوجع",
    hint: "What the reader's week costs them.",
    hintAr: "ما يكلّفه أسبوع القارئ.",
  },
  {
    id: "moment",
    label: "The moment",
    labelAr: "اللحظة",
    hint: "A scene they recognize.",
    hintAr: "مشهد يعرفه القارئ.",
  },
  {
    id: "proof",
    label: "The proof",
    labelAr: "البرهان",
    hint: "The one true fact from the brief.",
    hintAr: "الحقيقة الواحدة في الموجز.",
  },
] as const;

export type DraftAngleId = (typeof DRAFT_ANGLES)[number]["id"];

/**
 * Rungs on copy.mdx's Arabic register ladder that a contributor may ask for.
 *
 * Rung 1 (فصحى الصحافة) is absent on purpose — the ladder calls it the failure
 * mode and says it never ships, so offering it as a choice would make the UI
 * contradict the doctrine. The column still stores 1..4 so the stored value
 * means "a rung on the ladder" rather than "a rung the Hub happens to offer".
 *
 * `markers` is what the rung SOUNDS like — the words copy.mdx points at when it
 * defines each one, verbatim and in Arabic in both locales, because the ladder
 * is a fact about Arabic and an English gloss of `خليك` would describe the rung
 * without letting anyone hear it. Rung 4's is a dialect name rather than a word
 * list on purpose: the ladder names no pan-dialect markers, it names a dialect
 * per brand.
 */
export const DRAFT_REGISTERS = [
  {
    id: 2,
    label: "Rung 2 — simplified MSA",
    labelAr: "الدرجة ٢ — فصحى معاصرة مبسّطة",
    hint: "The house default. Active verbs, one clause a sentence, nouns the reader touches.",
    hintAr:
      "الوضع الافتراضي. أفعال مبنية للمعلوم، جملة واحدة، ومفردات يلمسها القارئ.",
    markers: "الورق · الدفتر · الكشف · الفاتورة",
  },
  {
    id: 3,
    label: "Rung 3 — pan-Arab colloquial",
    labelAr: "الدرجة ٣ — عامية بيضاء",
    hint: "MSA skeleton, spoken vocabulary, no country markers. Consumer and short-form only.",
    hintAr:
      "هيكل فصيح بمفردات محكية دون سمات قُطرية. للمحتوى الاستهلاكي والقصير فقط.",
    markers: "تعرف · جرّب · خليك · طيب · ببساطة",
  },
  {
    id: 4,
    label: "Rung 4 — local dialect",
    labelAr: "الدرجة ٤ — لهجة محلية",
    hint: "Only where a brand doc names one — Sudanese for sijillee, and only on its channels.",
    hintAr: "فقط حيث تنصّ صفحة العلامة — السودانية لسجلي، وعلى قنواتها وحدها.",
    markers: "سوداني",
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
