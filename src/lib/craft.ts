// The craft bar, executed.
//
// `content/docs/social/copy.mdx` is the doctrine and stays the doctrine. It was
// also, until now, entirely advisory: the pipeline could stop a *false* post and
// could not stop a *boring* one. On 2026-08-05 the unattended drain shipped a
// table of contents ("القبول في مدرستك… من أول سؤال ولي الأمر إلى أول يوم للطالب")
// and it passed every gate the pipeline had.
//
// This module executes the part of that page a machine can. It reads
// content/social/craft-rules.json, which is copy.mdx's tables as data, and it is
// a MIRROR of scripts/lib/craft.mjs — a plain .mjs cannot import TS, the same
// constraint that produced rotation.ts and brand-kit.ts. Both read the same
// JSON, so the DATA cannot drift; only the assembly can, and craft.test.ts pins
// the two together by running the same input through both.
//
// Nothing server-only is imported on purpose: the review editor renders findings
// live in the browser, and the drain runs them in node.
//
// Why a linter and not an LLM judge: copy.mdx already priced the judge and put
// it behind /decide — a second model call per draft on a subscription pool that
// already hits session limits, when a human gate exists and takes twenty
// seconds. A regex costs nothing and never gets tired.
//
// What is deliberately NOT here, because a regex cannot see it:
//   check 1's "is this a pain or a promise" — a description passes every
//     mechanical test a hook passes. The word count is a floor, not the check.
//   check 2's "cut it at any sentence boundary" — the ≥4-bullet rule is the
//     common case, not the rule.
//   check 4 "Scene" — not a text property at all. It needs evidence, which is
//     content/social/evidence.json's job.

import rules from "../../content/social/craft-rules.json";

/** The five reviewer-facing reasons in components/root/social/knobs.ts. */
export type CraftReason =
  "hook" | "two-posts" | "untrue" | "register" | "cta" | "length" | "other";

export interface CraftFinding {
  /** The specific mechanical rule, for the message a writer reads. */
  rule: string;
  /** The reviewer-facing bucket, so machine and human rejections aggregate as one vocabulary. */
  reason: CraftReason;
  /** Which of copy.mdx's seven checks this serves, when it maps to one. */
  check: number | null;
  /** `fail` is copy.mdx's reject list — "auto-fail, no discussion". `warn` is judgment. */
  severity: "fail" | "warn";
  message: string;
}

export interface CraftInput {
  ar: string;
  en?: string;
  /**
   * Every text a number is allowed to come from — the brief, plus a refinement
   * turn's instruction and the parent draft it is refining. copy.mdx's reject
   * list says "a number, name, price, or date not present in the brief", and on
   * turn three the brief alone would fail a figure the reviewer themselves
   * asked for.
   */
  allowedFrom?: string;
  /** Channel id, for the hashtag cap and the short-form length floor. */
  channel?: string;
  /** Registry brand id — check 1 bans a brand opening with its OWN name. */
  brand?: string;
}

// Reused verbatim from social-utm.ts so the link count here agrees with what
// applyUtm will actually tag at delivery. A second, subtly different pattern is
// how a draft passes the linter and ships untagged anyway.
const ABSOLUTE_URL = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;

// A link a human reads as a link and `new URL()` refuses. applyUtm's tag() returns
// the raw string on a parse failure, silently, so this is the shape that ships
// without a UTM and looks fine doing it.
const SCHEMELESS_URL =
  /(?:^|[\s(])((?:[a-z0-9-]+\.)+(?:org|com|net|io|app|dev|co|sa|sd|ae)(?:\/[^\s]*)?)/gi;

// Two copies on purpose. A /g regex carries lastIndex across .test() calls, so a
// single global instance answers differently the second time it is asked — the
// kind of bug that makes a linter intermittent.
const EMOJI = /\p{Extended_Pictographic}/gu;
const HAS_EMOJI = /\p{Extended_Pictographic}/u;
const BULLET_LINE = /^\s*(?:[-*•–—]|\d+[.)])\s+/;
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/;
const ARABIC_LETTER = /^[ء-ي]$/;
const LATIN_WORD = /^[A-Za-z][A-Za-z0-9'’-]*$/;
const NUMBER_TOKEN = /\d+(?:[.,]\d+)?%?/g;

function firstLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) return line.trim();
  }
  return "";
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function stripAbsolute(text: string): string {
  return text.replace(ABSOLUTE_URL, " ");
}

function stripLinks(text: string): string {
  return stripAbsolute(text).replace(SCHEMELESS_URL, " ");
}

/**
 * Arabic-Indic (٠-٩) and Persian (۰-۹) digits folded to Latin — for the
 * invented-number guard, and nowhere else.
 *
 * That guard is a set difference over NUMBER_TOKEN, which is `\d`: Latin only.
 * Briefs are written Arabic-first and naturally carry ٣, while copy.mdx mandates
 * Latin digits in the copy — a pairing that was unsatisfiable until this fold.
 * Cite the brief's ٣ as "3" and invented-number fired, because the brief's own
 * digits were never tokenized and the allowed-set came back empty; cite it as
 * "٣" and arabic-indic-digits fired instead. Every Arabic brief carrying a
 * figure was therefore unanswerable without --craft-override.
 *
 * Deliberately NOT applied to the arabic-indic-digits check, which must keep
 * seeing raw text — catching ٣ in shipped copy is that rule's whole job.
 */
function latinizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?؟]+\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Rank order of sentence lengths — the shape of a paragraph, ignoring its language. */
function lengthRanks(parts: string[]): number[] {
  return parts
    .map((s, i) => ({ i, n: s.length }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .map((x) => x.i);
}

export function checkCraft(input: CraftInput): CraftFinding[] {
  const ar = (input.ar ?? "").trim();
  const en = (input.en ?? "").trim();
  const out: CraftFinding[] = [];
  const add = (
    rule: string,
    reason: CraftReason,
    check: number | null,
    severity: "fail" | "warn",
    message: string,
  ) => out.push({ rule, reason, check, severity, message });

  const L = rules.limits;

  // ── Length ──────────────────────────────────────────────────────
  // copy.mdx: "Over 900 means check 2 already failed and you have not noticed."
  const min = input.channel === "x" ? L.arMinCharsShortForm : L.arMinChars;
  if (ar.length < min) {
    add(
      "length-short",
      "length",
      null,
      "fail",
      `Arabic is ${ar.length} chars; the floor is ${min}.`,
    );
  } else if (ar.length > L.arMaxChars) {
    add(
      "length-long",
      "length",
      2,
      "fail",
      `Arabic is ${ar.length} chars; the ceiling is ${L.arMaxChars} — over it means check 2 already failed.`,
    );
  }

  // ── Check 1: the hook ───────────────────────────────────────────
  const head = firstLine(ar);
  const headWords = head.split(/\s+/).filter(Boolean).length;
  if (headWords > L.hookMaxWords) {
    add(
      "hook-length",
      "hook",
      1,
      "fail",
      `First line is ${headWords} words; the ceiling is ${L.hookMaxWords}.`,
    );
  }
  const headEn = firstLine(en);
  // Only the brand being written is checked. Checking all five would flag
  // `مكان واحد` on a hogwarts post, and `في مكان واحد` is in this file's own
  // preferred-vocabulary list — a linter that fails good copy stops being read.
  const brandNames = input.brand
    ? (rules.brandOpenerNames[
        input.brand as keyof typeof rules.brandOpenerNames
      ] ?? [])
    : [];
  for (const bad of [...rules.openerBans.ar, ...brandNames]) {
    if (head.startsWith(bad)) {
      add(
        "hook-opener",
        "hook",
        1,
        "fail",
        `Arabic opens with "${bad}" — never the brand name or نحن.`,
      );
    }
  }
  for (const bad of [...rules.openerBans.en, ...brandNames]) {
    if (headEn.toLowerCase().startsWith(bad.toLowerCase())) {
      add("hook-opener", "hook", 1, "fail", `English opens with "${bad}".`);
    }
  }

  // ── Check 2: one idea — the bulleted-list failure signature ─────
  const bullets = ar.split(/\r?\n/).filter((l) => BULLET_LINE.test(l)).length;
  if (bullets > L.maxBullets) {
    add(
      "bullets",
      "two-posts",
      2,
      "fail",
      `${bullets} bullet lines; ${L.maxBullets} is the ceiling and only when each is a step in one process.`,
    );
  }

  // ── Check 7: portability — hashtags, emoji, punctuation ─────────
  const caps = rules.channelHashtagCaps as Record<string, number>;
  const cap =
    input.channel && input.channel in caps
      ? caps[input.channel]
      : L.maxHashtags;
  const tags = countMatches(ar, /#\S+/g) + countMatches(en, /#\S+/g);
  if (tags > cap) {
    add(
      "hashtags",
      "other",
      7,
      "fail",
      cap === 0
        ? `${tags} hashtags, and ${input.channel} takes none.`
        : `${tags} hashtags; the ceiling is ${cap}.`,
    );
  }

  for (const [label, text] of [
    ["Arabic", ar],
    ["English", en],
  ] as const) {
    if (!text) continue;
    if (HAS_EMOJI.test(firstLine(text))) {
      add(
        "emoji-first-line",
        "other",
        7,
        "fail",
        `Emoji in the first line of the ${label}.`,
      );
    }
    const emoji = countMatches(text, EMOJI);
    if (emoji > L.maxEmoji) {
      add(
        "emoji-count",
        "other",
        7,
        "fail",
        `${emoji} emoji in the ${label}; ${L.maxEmoji} is the ceiling.`,
      );
    }
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t && HAS_EMOJI.test(t.slice(0, 2)) && t.length > 2) {
        add(
          "emoji-bullet",
          "other",
          7,
          "fail",
          `A line starts with an emoji — never a bullet marker.`,
        );
        break;
      }
    }
    if (/[!！]/.test(text)) {
      add(
        "exclamation",
        "register",
        null,
        "fail",
        `An exclamation mark in the ${label}.`,
      );
    }
    const q = countMatches(text, /[?؟]/g);
    if (q > L.maxQuestionMarks) {
      add(
        "question-marks",
        "register",
        null,
        "fail",
        `${q} question marks in the ${label}; ${L.maxQuestionMarks} is the ceiling.`,
      );
    }
  }

  // ── The wordlist ───────────────────────────────────────────────
  for (const { term, use } of rules.wordlist.ar) {
    if (ar.includes(term)) {
      add("wordlist-ar", "register", null, "fail", `"${term}" → ${use}`);
    }
  }
  const enLower = en.toLowerCase();
  for (const { term, use } of rules.wordlist.en) {
    if (enLower.includes(term.toLowerCase())) {
      add("wordlist-en", "register", null, "fail", `"${term}" → ${use}`);
    }
  }
  for (const { term, use } of rules.wordlist.enConditional) {
    if (enLower.includes(term.toLowerCase())) {
      add(
        "wordlist-en-conditional",
        "register",
        null,
        "warn",
        `"${term}" → ${use}`,
      );
    }
  }
  for (const term of rules.engineeringAr.terms) {
    if (ar.includes(term)) {
      add(
        "engineering-ar",
        "register",
        null,
        "fail",
        `Engineering vocabulary in Arabic: "${term}".`,
      );
    }
  }

  // ── The register ladder ────────────────────────────────────────
  // copy.mdx is explicit that passive is RIGHT when the object is the topic
  // (الدرجة تُرصد مرة واحدة is called good), so only the outright-banned
  // `يتم + مصدر` fails; the rest of rung 1 warns.
  for (const term of rules.passiveAr.fail) {
    if (ar.includes(term)) {
      add(
        "passive-ar",
        "register",
        null,
        "fail",
        `"${term.trim()} + مصدر" → the active verb (يرسل النظام).`,
      );
    }
  }
  for (const term of rules.passiveAr.warn) {
    if (ar.includes(term)) {
      add("rung1-ar", "register", null, "warn", `Rung-1 marker: "${term}".`);
    }
  }

  // ── Script and typography ──────────────────────────────────────
  if (ARABIC_INDIC_DIGIT.test(ar)) {
    add(
      "arabic-indic-digits",
      "other",
      null,
      "fail",
      "Arabic-Indic digits — copy.mdx sets Latin digits (1, 2, 3).",
    );
  }
  const tokens = stripLinks(ar).split(/\s+/).filter(Boolean);
  let run = 0;
  for (const t of tokens) {
    run = ARABIC_LETTER.test(t) ? run + 1 : 0;
    if (run >= 3) {
      add(
        "arabic-letter-spacing",
        "other",
        null,
        "fail",
        "Letter-spaced Arabic — it is a connected script.",
      );
      break;
    }
  }
  const latin = tokens.filter(
    (t) =>
      !t.startsWith("@") &&
      !t.startsWith("#") &&
      LATIN_WORD.test(t) &&
      t.length > 1,
  );
  if (latin.length) {
    add(
      "latin-token-in-arabic",
      "other",
      null,
      "warn",
      `Latin token(s) in Arabic prose: ${latin.slice(0, 3).join(", ")} — transliterate the brand name (في هوجورتس); keep Latin for handles, links, hashtags.`,
    );
  }

  // ── Check 6: the CTA ───────────────────────────────────────────
  const links = ar.match(ABSOLUTE_URL) ?? [];
  if (links.length > L.maxLinks) {
    add(
      "cta-two-asks",
      "cta",
      6,
      "fail",
      `${links.length} links — one verb, one destination.`,
    );
  }
  // stripAbsolute, not stripLinks: stripLinks removes schemeless URLs too, so
  // scanning its output for them would never match anything.
  const scheme = new RegExp(SCHEMELESS_URL.source, "gi");
  for (const m of stripAbsolute(ar).matchAll(scheme)) {
    add(
      "cta-not-absolute",
      "cta",
      6,
      "fail",
      `"${m[1]}" has no scheme — applyUtm only tags absolute URLs, so it would ship untagged.`,
    );
  }
  if (links.length === 1 && ar.length > 0) {
    const at = ar.lastIndexOf(links[0]);
    if (at < ar.length * (1 - L.ctaLastFraction)) {
      add(
        "cta-position",
        "cta",
        6,
        "warn",
        "The link is not in the closing fifth — one verb, one destination, last.",
      );
    }
  }

  // ── The invented-number guard ──────────────────────────────────
  // copy.mdx's reject list: "A number, name, price, or date not present in the
  // brief." That is a set difference, which is why it is the most valuable rule
  // here — an invented figure is the one failure a reader cannot detect and a
  // school owner absolutely can.
  if (input.allowedFrom !== undefined) {
    const allowed = new Set(
      latinizeDigits(stripLinks(input.allowedFrom)).match(NUMBER_TOKEN) ?? [],
    );
    const seen = new Set<string>();
    for (const text of [ar, en]) {
      for (const n of latinizeDigits(stripLinks(text)).match(NUMBER_TOKEN) ??
        []) {
        if (!allowed.has(n) && !seen.has(n)) {
          seen.add(n);
          add(
            "invented-number",
            "untrue",
            null,
            "fail",
            `"${n}" is not in the brief.`,
          );
        }
      }
    }
  }

  // ── Check 3: specificity ───────────────────────────────────────
  if (ar && !rules.preferredAr.terms.some((t) => ar.includes(t))) {
    add(
      "specificity",
      "other",
      3,
      "warn",
      "No object a reader can see — copy.mdx's register vocabulary (الورق, الدفتر, الكشف, الفاتورة, الطابور) is absent.",
    );
  }

  // ── Check 5: sibling ───────────────────────────────────────────
  // A proxy, and an honest one: identical sentence count AND identical
  // length-rank order means one text was laid over the other. Divergence in two
  // places is the doctrine's floor; this catches zero.
  if (ar && en) {
    const a = sentences(ar);
    const e = sentences(en);
    if (a.length > 1 && a.length === e.length) {
      const ra = lengthRanks(a).join(",");
      const re = lengthRanks(e).join(",");
      if (ra === re) {
        add(
          "sibling",
          "other",
          5,
          "warn",
          `Arabic and English have the same ${a.length} sentences in the same length order — one reads as a translation of the other.`,
        );
      }
    }
  }

  return out;
}

export function craftFailures(findings: CraftFinding[]): CraftFinding[] {
  return findings.filter((f) => f.severity === "fail");
}

/** One line per finding, for a CLI, a log, or a refusal message. */
export function formatCraft(findings: CraftFinding[]): string {
  if (!findings.length) return "craft: clean";
  return findings
    .map((f) => {
      const where = f.check === null ? f.rule : `check ${f.check} · ${f.rule}`;
      return `${f.severity === "fail" ? "FAIL" : "warn"}  ${where} — ${f.message}`;
    })
    .join("\n");
}
