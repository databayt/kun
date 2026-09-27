// ── The send gate: the only thing between a drafted letter and an inbox ──────
//
// Abdout chose auto-send with a daily cap (2026-09-27), so no human reads a
// letter before it leaves. This gate is that human's job, done mechanically.
// A HARD failure puts the card on HOLD; a NEED means the posting asks for
// something only Abdout can supply (a salary figure, certified copies), which
// is also a HOLD — but the reason tells him exactly what to bring.
//
// Pure: the caller fetches the posting, reads the board and the PDF, and hands
// the facts in. Nothing here touches the network or the disk.

export interface GateInput {
  /// email: a letter to an address; ats: a cover letter for a hosted form.
  channel?: "email" | "ats";
  letter: { to: string; subject: string; body: string };
  company: string;
  role: string;
  /** Plain text of the posting page, or null when it could not be fetched. */
  postingText: string | null;
  /** YYYY-MM-DD, or null/"rolling" for open-ended. */
  deadline?: string | null;
  today: string;
  /** Anything sent to this company or address in the last 30 days. */
  recentlyContacted: boolean;
  /** Every number the CVs can back: years, voltages, counts. */
  allowedNumbers: string[];
  attachment: { exists: boolean; pages: number };
}

export interface GateVerdict {
  pass: boolean;
  hard: string[];
  needs: string[];
}

const PLACEHOLDER =
  /[[\]{}]|\bTODO\b|\bTBD\b|\bFILL\b|\bXXX\b|lorem ipsum|<[a-z]+>/i;

/// What a posting can demand that a letter plus CV cannot supply.
const EXTRA_DOCUMENTS: [RegExp, string][] = [
  [/certified cop(y|ies)|notari[sz]ed/i, "certified copies of certificates"],
  [
    /salary expectation|expected salary|salary requirement/i,
    "a salary expectation",
  ],
  [
    /application form|fill (in|out) (the|this) form/i,
    "the employer's application form",
  ],
  [/police clearance|criminal record/i, "a police clearance"],
  [
    /reference letter|recommendation letter|letters? of recommendation/i,
    "reference letters",
  ],
  [/academic transcripts?/i, "academic transcripts"],
  [
    /(copy of|copies of) (your )?(passport|national id|id card)/i,
    "an ID/passport copy",
  ],
];

const words = (s: string): string[] => s.split(/\s+/).filter(Boolean);

const normNumber = (n: string): string =>
  n.replace(/[,\s]/g, "").replace(/\.$/, "");

/// Numbers the letter asserts. Dates are split so "2013" and "33/13.8" are
/// checked as the parts a reader would believe.
export function numbersIn(text: string): string[] {
  const raw = text.match(/\d[\d,.]*(?:\/\d[\d,.]*)*/g) ?? [];
  return raw
    .flatMap((r) => r.split("/"))
    .map(normNumber)
    .filter((n) => n.length > 0);
}

function arabicRatio(s: string): number {
  const letters = s.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  return (s.match(/\p{Script=Arabic}/gu) ?? []).length / letters.length;
}

function mentions(body: string, phrase: string): boolean {
  const b = body.toLowerCase();
  const significant = phrase
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[^\p{L}\p{N}&]+/u)
    .filter(
      (w) =>
        w.length >= 4 &&
        !["ltd", "limited", "company", "group", "holding"].includes(w),
    );
  if (significant.length === 0) return b.includes(phrase.toLowerCase());
  const hits = significant.filter((w) => b.includes(w)).length;
  return hits / significant.length >= 0.5;
}

export function evaluateSendGate(input: GateInput): GateVerdict {
  const hard: string[] = [];
  const needs: string[] = [];
  const { letter, postingText } = input;

  // ── the posting ────────────────────────────────────────────────────────────
  if (postingText === null) hard.push("posting unreachable");
  const deadline =
    input.deadline && /^\d{4}-\d{2}-\d{2}$/.test(input.deadline)
      ? input.deadline
      : null;
  if (deadline && deadline < input.today)
    hard.push(`deadline passed (${deadline})`);
  const ats = input.channel === "ats";
  if (
    !ats &&
    postingText !== null &&
    !postingText.toLowerCase().includes(letter.to.toLowerCase())
  ) {
    hard.push(`recipient ${letter.to} is not on the posting`);
  }
  if (input.recentlyContacted)
    hard.push("already contacted this company in the last 30 days");

  // ── the letter ─────────────────────────────────────────────────────────────
  // A hosted form has no recipient or subject line to get wrong.
  if (!ats && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(letter.to))
    hard.push(`bad address "${letter.to}"`);
  if (!ats && !letter.subject.trim()) hard.push("empty subject");
  if (/\w\+\w|%[0-9a-f]{2}/i.test(letter.subject)) hard.push(`malformed subject "${letter.subject}"`);
  if (PLACEHOLDER.test(letter.body) || PLACEHOLDER.test(letter.subject))
    hard.push("placeholder text left in");
  const count = words(letter.body).length;
  if (count < 120 || count > 350)
    hard.push(`length ${count} words (want 120-350)`);
  if (!mentions(letter.body, input.company))
    hard.push(`does not name ${input.company}`);
  if (!mentions(`${letter.subject} ${letter.body}`, input.role))
    hard.push(`does not name the role "${input.role}"`);

  // Every number must be backed by the CVs, or be quoted from the posting
  // itself (a vacancy reference, a deadline) — nothing invented.
  const allowed = new Set(input.allowedNumbers.map(normNumber));
  const fromPosting = new Set(
    numbersIn(`${postingText ?? ""} ${input.company} ${input.role}`),
  );
  const phone = /250\s?780\s?984\s?777/;
  const bodyNoPhone = letter.body.replace(phone, "");
  const unbacked = [...new Set(numbersIn(bodyNoPhone))].filter(
    (n) => !allowed.has(n) && !fromPosting.has(n),
  );
  if (unbacked.length) hard.push(`unbacked numbers: ${unbacked.join(", ")}`);

  if (
    postingText &&
    arabicRatio(postingText) > 0.5 &&
    arabicRatio(letter.body) < 0.5
  ) {
    hard.push("posting is Arabic, letter is not");
  }

  // ── the attachment ─────────────────────────────────────────────────────────
  if (!input.attachment.exists) hard.push("CV attachment missing");
  else if (input.attachment.pages < 1 || input.attachment.pages > 2)
    hard.push(`CV is ${input.attachment.pages} pages`);

  // ── what only Abdout can supply ───────────────────────────────────────────
  for (const [re, what] of EXTRA_DOCUMENTS)
    if (postingText && re.test(postingText)) needs.push(what);

  return { pass: hard.length === 0 && needs.length === 0, hard, needs };
}

/// One line for the board's holdReason field.
export function holdReasonFor(v: GateVerdict): string {
  return [...v.hard, ...v.needs.map((n) => `needs ${n}`)].join("; ");
}
