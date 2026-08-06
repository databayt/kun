// The craft bar, executed — the .mjs half.
//
// A deliberate MIRROR of src/lib/craft.ts: a plain .mjs cannot import TS, the
// same constraint that produced rotation.ts and brand-kit.mjs. Both read
// content/social/craft-rules.json, so the DATA cannot drift; only the assembly
// can, and src/lib/__tests__/craft.test.ts pins the two together by running the
// same inputs through both and demanding identical findings.
//
// This is the copy the drain and social-drafts.mjs use, which makes it the one
// that actually gates a draft before a human ever sees it.
//
// Keep the two in lockstep line by line. Every divergence here is a draft that
// passes on one side and fails on the other.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(here, "..", "..", "content", "social", "craft-rules.json");
const rules = JSON.parse(readFileSync(rulesPath, "utf8"));

const ABSOLUTE_URL = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
const SCHEMELESS_URL =
  /(?:^|[\s(])((?:[a-z0-9-]+\.)+(?:org|com|net|io|app|dev|co|sa|sd|ae)(?:\/[^\s]*)?)/gi;
const EMOJI = /\p{Extended_Pictographic}/gu;
const HAS_EMOJI = /\p{Extended_Pictographic}/u;
const BULLET_LINE = /^\s*(?:[-*•–—]|\d+[.)])\s+/;
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/;
const ARABIC_LETTER = /^[ء-ي]$/;
const LATIN_WORD = /^[A-Za-z][A-Za-z0-9'’-]*$/;
const NUMBER_TOKEN = /\d+(?:[.,]\d+)?%?/g;

function firstLine(text) {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) return line.trim();
  }
  return "";
}

function countMatches(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

function stripAbsolute(text) {
  return text.replace(ABSOLUTE_URL, " ");
}

function stripLinks(text) {
  return stripAbsolute(text).replace(SCHEMELESS_URL, " ");
}

function sentences(text) {
  return text
    .split(/[.!?؟]+\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function lengthRanks(parts) {
  return parts
    .map((s, i) => ({ i, n: s.length }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .map((x) => x.i);
}

export function checkCraft(input) {
  const ar = (input.ar ?? "").trim();
  const en = (input.en ?? "").trim();
  const out = [];
  const add = (rule, reason, check, severity, message) =>
    out.push({ rule, reason, check, severity, message });

  const L = rules.limits;

  // ── Length ──────────────────────────────────────────────────────
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
  const brandNames = input.brand
    ? (rules.brandOpenerNames[input.brand] ?? [])
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
  const caps = rules.channelHashtagCaps;
  const cap =
    input.channel && input.channel in caps ? caps[input.channel] : L.maxHashtags;
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
  ]) {
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
  if (input.allowedFrom !== undefined) {
    const allowed = new Set(
      stripLinks(input.allowedFrom).match(NUMBER_TOKEN) ?? [],
    );
    const seen = new Set();
    for (const text of [ar, en]) {
      for (const n of stripLinks(text).match(NUMBER_TOKEN) ?? []) {
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

export function craftFailures(findings) {
  return findings.filter((f) => f.severity === "fail");
}

export function formatCraft(findings) {
  if (!findings.length) return "craft: clean";
  return findings
    .map((f) => {
      const where = f.check === null ? f.rule : `check ${f.check} · ${f.rule}`;
      return `${f.severity === "fail" ? "FAIL" : "warn"}  ${where} — ${f.message}`;
    })
    .join("\n");
}
