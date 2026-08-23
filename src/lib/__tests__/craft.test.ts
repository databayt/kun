import { describe, expect, it } from "vitest";
import { checkCraft, craftFailures, formatCraft } from "@/lib/craft";
import { checkCraft as checkMjs } from "../../../scripts/lib/craft.mjs";

// The app renders craft findings live in the review editor; the drain and
// social-drafts.mjs gate on them before a draft is ever stored. Two
// implementations of one rule set is exactly the drift rotation.ts and
// brand-kit.ts were written to guard against, so this is that guard: same input,
// identical findings, or the build fails.
//
// Both read content/social/craft-rules.json, so only the ASSEMBLY can drift —
// and assembly is where an off-by-one on a ceiling or a dropped rule hides.

// A draft written to pass. The scene is the finance pillar's own — a ledger open
// beside a laptop and a total that refuses to agree with itself.
const GOOD_AR = `أسبوع المدير يذوب في الورق.

الدفتر مفتوح بجانب الحاسوب، والرقم نفسه مكتوب في الاثنين، والمجموع يرفض أن يتفق مع نفسه. يبدأ المحاسب من أول السطر مرة أخرى، والليل يطول حتى لا يبقى من المساء شيء.

الفاتورة تخرج من النظام لا من جدول. الرسوم والأقساط ومن دفع ماذا، في مكان واحد، بلمحة. والكشف جاهز قبل أن يطلبه أحد.

والطابور على المكتب يقصر، لأن الرقم صار في مكانه من أول مرة، ولأن الدفتر لم يعد الجهة التي تُسأل.

آخر الفصل ينتهي بهدوء.

جرب النظام على https://ed.databayt.org`;

const GOOD_EN = `The end-of-term reconciliation is done by hand, and the total never agrees.

Invoices come out of the system instead of a spreadsheet — fees, instalments, and who paid what in one view. The bursar stops starting over.

See it at https://ed.databayt.org`;

// The draft copy.mdx quotes as the failure that passed every gate the pipeline
// had on 2026-08-05: a table of contents, five bullets, and a trust line that
// was tenant scoping translated into Arabic.
const FAILURE_20260805_AR = `القبول في مدرستك… من أول سؤال ولي الأمر إلى أول يوم للطالب.

- استقبال الطلبات من الجوال
- متابعة كل طلب في لوحة واحدة
- المستندات في مكانها
- القرار يصل لولي الأمر
- الملف يفتح للطالب المقبول

نطاق المستأجر يضمن أن بيانات مدرستك لا تخرج منها.`;

describe("checkCraft parity", () => {
  const cases: { name: string; input: Parameters<typeof checkCraft>[0] }[] = [
    {
      name: "a clean draft",
      input: { ar: GOOD_AR, en: GOOD_EN, brand: "hogwarts" },
    },
    {
      name: "the 2026-08-05 failure",
      input: { ar: FAILURE_20260805_AR, brand: "hogwarts" },
    },
    { name: "empty", input: { ar: "" } },
    {
      name: "every hard rule at once",
      input: {
        ar: "هوجورتس تفخر بأن تعلن عن الحلول المتكاملة! يتم إرسال ٥ رسائل ومعها التحول الرقمي 🚀 و 🎉 عبر ed.databayt.org وأيضًا https://a.example.com/x وكذلك https://b.example.com/y؟ ولماذا؟",
        en: "We're excited to announce our seamless solutions that revolutionize workflows.",
        brand: "hogwarts",
        allowedFrom: "a brief with no numbers",
      },
    },
    {
      name: "letter-spaced arabic and a channel cap",
      input: {
        ar: "م ر ح ب ا بكم #وسم #ثان #ثالث #رابع",
        channel: "whatsapp",
        brand: "hogwarts",
      },
    },
    {
      name: "invented numbers against a brief",
      input: {
        ar: "الكشف جاهز في 3 خطوات وبنسبة 40% أقل من الوقت، والورق ينتهي بهدوء.",
        en: "Ready in 3 steps, 40% faster.",
        allowedFrom:
          "Feature highlight: the mark sheet in 3 steps. No invented numbers.",
        brand: "hogwarts",
      },
    },
    {
      name: "short-form floor on x",
      input: { ar: GOOD_AR.slice(0, 300), channel: "x", brand: "hogwarts" },
    },
    {
      // The digit fold lives in both files; this is the case that catches it
      // being applied to one of them only.
      name: "arabic-indic digits in the brief, latin in the copy",
      input: {
        ar: "الملف كان يمر على 3 مكاتب، والعملية تستغرق 14 يوماً.",
        en: "The file crossed 3 desks over 14 days.",
        allowedFrom: "الملف بيتنقل بين ٣ مكاتب، والعملية بتاخد ۱٤ يوم.",
        brand: "hogwarts",
      },
    },
  ];

  it.each(cases)("TS and .mjs agree on $name", ({ input }) => {
    expect(checkCraft(input)).toEqual(checkMjs(input));
  });
});

describe("the 2026-08-05 failure", () => {
  const findings = checkCraft({ ar: FAILURE_20260805_AR, brand: "hogwarts" });
  const rules = findings.map((f) => f.rule);

  it("fails check 2 on the five-bullet signature", () => {
    expect(rules).toContain("bullets");
    const bullets = findings.find((f) => f.rule === "bullets")!;
    expect(bullets.check).toBe(2);
    expect(bullets.severity).toBe("fail");
  });

  it("fails on engineering vocabulary carried into Arabic", () => {
    // "نطاق المستأجر" — copy.mdx names this exact phrase in its reject list.
    expect(rules).toContain("engineering-ar");
  });

  it("does NOT claim to catch its check-1 failure — and that is the point", () => {
    // The hook is exactly 12 words, which is the ceiling, not over it. copy.mdx
    // is explicit that what makes this line fail is that it is a DESCRIPTION —
    // "naming the product, the feature, or the category is a description, and a
    // description is not a hook" — and no regex can see that. The word count is
    // a floor under check 1, never the check. If this test ever starts failing
    // because someone taught the linter to catch it, read copy.mdx first: the
    // likely cause is a rule that also rejects good hooks.
    expect(rules).not.toContain("hook-length");
    expect(rules).not.toContain("hook-opener");
  });
});

describe("a draft written to the doctrine", () => {
  const findings = checkCraft({
    ar: GOOD_AR,
    en: GOOD_EN,
    brand: "hogwarts",
    allowedFrom: "the finance brief, no numbers",
  });

  it("has no hard failures", () => {
    expect(
      craftFailures(findings).map((f) => `${f.rule}: ${f.message}`),
    ).toEqual([]);
  });

  it("lands inside the 400–900 character band", () => {
    expect(GOOD_AR.trim().length).toBeGreaterThanOrEqual(400);
    expect(GOOD_AR.trim().length).toBeLessThanOrEqual(900);
  });

  it("does not trip the sibling proxy — the two texts diverge in shape", () => {
    expect(findings.map((f) => f.rule)).not.toContain("sibling");
  });

  it("does not trip specificity — it names things a reader can see", () => {
    expect(findings.map((f) => f.rule)).not.toContain("specificity");
  });
});

describe("check 1 — the hook", () => {
  const body = GOOD_AR.split("\n").slice(1).join("\n");

  it("fails a first line over twelve words", () => {
    const long =
      "هذه جملة طويلة جدا تتجاوز الحد المسموح به من الكلمات في السطر الأول تماما";
    const rules = checkCraft({ ar: `${long}\n${body}`, brand: "hogwarts" }).map(
      (f) => f.rule,
    );
    expect(rules).toContain("hook-length");
  });

  it("fails a brand-name opener for that brand", () => {
    const rules = checkCraft({
      ar: `هوجورتس يذوب في الورق.\n${body}`,
      brand: "hogwarts",
    }).map((f) => f.rule);
    expect(rules).toContain("hook-opener");
  });

  it("does not flag another brand's name — مكان واحد is preferred vocabulary", () => {
    // The whole reason brandOpenerNames is keyed by brand: `في مكان واحد` is in
    // craft-rules.json's own preferredAr list, so a global ban on every brand
    // name would fail the copy the doctrine recommends.
    const rules = checkCraft({
      ar: `مكان واحد يجمع الكشف والفاتورة.\n${body}`,
      brand: "hogwarts",
    }).map((f) => f.rule);
    expect(rules).not.toContain("hook-opener");
  });
});

describe("check 6 — the CTA", () => {
  it("fails a link with no scheme, because applyUtm would not tag it", () => {
    const findings = checkCraft({
      ar: `الكشف والورق.\n\nجرب النظام على ed.databayt.org`,
    });
    expect(findings.map((f) => f.rule)).toContain("cta-not-absolute");
  });

  it("fails two destinations", () => {
    const findings = checkCraft({
      ar: `الورق.\n\nhttps://ed.databayt.org و https://demo.databayt.org`,
    });
    expect(findings.map((f) => f.rule)).toContain("cta-two-asks");
  });

  it("accepts one absolute link in the closing fifth", () => {
    const findings = checkCraft({ ar: GOOD_AR, brand: "hogwarts" });
    const cta = findings.filter((f) => f.reason === "cta");
    expect(cta).toEqual([]);
  });
});

describe("the invented-number guard", () => {
  it("passes a number the brief carries", () => {
    const findings = checkCraft({
      ar: "الكشف في 3 خطوات، والورق ينتهي.",
      allowedFrom: "the mark sheet in 3 steps",
    });
    expect(findings.map((f) => f.rule)).not.toContain("invented-number");
  });

  it("fails a number the brief does not", () => {
    const findings = checkCraft({
      ar: "الكشف في 3 خطوات وبنسبة 40% أقل، والورق ينتهي.",
      allowedFrom: "the mark sheet in 3 steps",
    });
    const invented = findings.filter((f) => f.rule === "invented-number");
    expect(invented).toHaveLength(1);
    expect(invented[0].message).toContain("40");
    expect(invented[0].reason).toBe("untrue");
  });

  it("ignores digits inside a URL — a link is not a claim", () => {
    const findings = checkCraft({
      ar: "الورق ينتهي على https://ed.databayt.org/v2/page7",
      allowedFrom: "no numbers here",
    });
    expect(findings.map((f) => f.rule)).not.toContain("invented-number");
  });

  it("stays silent when no brief was supplied", () => {
    // undefined means "nothing to diff against", which must not read as
    // "every number is invented".
    const findings = checkCraft({ ar: "الكشف في 3 خطوات، والورق ينتهي." });
    expect(findings.map((f) => f.rule)).not.toContain("invented-number");
  });

  // Briefs are written Arabic-first, so a figure in one arrives as ٣, while
  // copy.mdx mandates Latin digits in the copy itself. Before the digit fold
  // that pairing was unsatisfiable — "3" read as invented because the brief's
  // own ٣ never tokenized, and "٣" tripped arabic-indic-digits instead. Every
  // Arabic brief carrying a number was unanswerable without --craft-override.
  it("accepts a Latin digit citing an Arabic-Indic figure from the brief", () => {
    const findings = checkCraft({
      ar: "الملف كان يمر على 3 مكاتب، والآن خطوة واحدة.",
      allowedFrom: "الملف بيتنقل بين ٣ مكاتب قبل الموافقة.",
    });
    expect(findings.map((f) => f.rule)).not.toContain("invented-number");
  });

  it("accepts Persian digits in the brief too", () => {
    const findings = checkCraft({
      ar: "العملية كانت تستغرق 14 يوماً.",
      allowedFrom: "العملية بتاخد ۱۴ يوم.",
    });
    expect(findings.map((f) => f.rule)).not.toContain("invented-number");
  });

  it("still catches an invented figure when the brief is Arabic-Indic", () => {
    // The fold must not turn the guard off — it only aligns the alphabets.
    const findings = checkCraft({
      ar: "الملف كان يمر على 9 مكاتب.",
      allowedFrom: "الملف بيتنقل بين ٣ مكاتب قبل الموافقة.",
    });
    const invented = findings.filter((f) => f.rule === "invented-number");
    expect(invented).toHaveLength(1);
    expect(invented[0].message).toContain("9");
  });

  it("leaves arabic-indic-digits free to fail copy that ships ٣", () => {
    // The fold is scoped to the invented-number guard. Latin digits in the copy
    // are still house style, and that rule must keep seeing the raw text.
    const findings = checkCraft({
      ar: "الملف كان يمر على ٣ مكاتب.",
      allowedFrom: "الملف بيتنقل بين ٣ مكاتب قبل الموافقة.",
    });
    const rules = findings.map((f) => f.rule);
    expect(rules).toContain("arabic-indic-digits");
    expect(rules).not.toContain("invented-number");
  });
});

describe("emoji rules are not stateful", () => {
  it("gives the same answer twice — a /g regex in .test() would not", () => {
    // Two emoji, one of them in the first line, so both the first-line rule
    // (HAS_EMOJI, non-global) and the count rule (EMOJI, global, via .match)
    // fire on the same input. A single shared /g instance would answer
    // differently on the second call.
    const input = { ar: "الورق 🚀 يذوب\n\nوالكشف جاهز 🎉." };
    const once = checkCraft(input).map((f) => f.rule);
    const twice = checkCraft(input).map((f) => f.rule);
    expect(once).toEqual(twice);
    expect(once).toContain("emoji-first-line");
    expect(once).toContain("emoji-count");
  });
});

describe("channel caps", () => {
  it("takes no hashtags at all on whatsapp", () => {
    const findings = checkCraft({
      ar: "الورق يذوب. #وسم",
      channel: "whatsapp",
    });
    const tags = findings.find((f) => f.rule === "hashtags")!;
    expect(tags.message).toContain("takes none");
  });

  it("allows three elsewhere", () => {
    const findings = checkCraft({
      ar: "الورق يذوب. #أ #ب #ج",
      channel: "facebook",
    });
    expect(findings.map((f) => f.rule)).not.toContain("hashtags");
  });
});

describe("formatCraft", () => {
  it("says clean when there is nothing to say", () => {
    expect(formatCraft([])).toBe("craft: clean");
  });

  it("names the check when a finding maps to one", () => {
    const findings = checkCraft({ ar: FAILURE_20260805_AR, brand: "hogwarts" });
    expect(formatCraft(findings)).toContain("check 2 · bullets");
  });
});
