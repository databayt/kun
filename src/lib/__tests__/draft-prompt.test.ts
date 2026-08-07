import { describe, expect, it } from "vitest";
// eslint-disable-next-line -- the .mjs mirror is imported as itself on purpose
import * as mjs from "../../../scripts/lib/draft-prompt.mjs";
import * as ts from "@/lib/draft-prompt";

// The prompt exists twice because the server action is TS and the scripts are
// .mjs, and neither can import the other. Twice is fine; DIFFERENT is not —
// the whole point of single-sourcing was that the two lanes stopped drifting
// (one used to ask for 300-600 Arabic characters while the craft gate's floor
// is 400). Same doctrine and same shape as craft.test.ts's parity pin.

interface MirrorInput {
  brand: string;
  brief: string;
  instruction?: string;
  angle?: string;
  register?: number;
  scenes?: string;
  lessons?: string;
  violations?: string;
}

const CASES: Array<[string, MirrorInput]> = [
  ["bare ask", { brand: "hogwarts", brief: "منشور عن نظام القبول" }],
  ["unknown brand falls back", { brand: "newthing", brief: "launch note" }],
  [
    "full direction",
    {
      brand: "mkan",
      brief: "الحجز في دقيقة",
      angle: "moment",
      register: 3,
    },
  ],
  [
    "refinement turn",
    {
      brand: "hogwarts",
      brief: "متابعة الحضور",
      instruction: "sharper hook",
      register: 2,
    },
  ],
  [
    "lessons and scenes ride along",
    {
      brand: "hogwarts",
      brief: "كشف الدرجات",
      scenes: "- آخر الفصل، طابور أولياء الأمور عند مكتب الإدارة",
      lessons: "hook 3×, two-posts 1×",
    },
  ],
  [
    "corrective retry",
    {
      brand: "databayt",
      brief: "open source release",
      violations: "invented-number: 40% is not in the brief",
    },
  ],
];

describe("the draft prompt mirror pair", () => {
  it.each(CASES)("renders identically on both sides: %s", (_name, input) => {
    expect(ts.buildDraftPrompt(input)).toEqual(mjs.buildDraftPrompt(input));
  });

  it("agrees on the model and the refusal marker", () => {
    // These two constants cross the same TS/.mjs boundary the prompt does,
    // and drifting has the same cost — a wrong model is a 2× latency
    // regression, a wrong marker re-burns quota on refused rows every tick.
    expect(ts.GEMINI_DRAFT_MODEL).toBe(mjs.GEMINI_DRAFT_MODEL);
    expect(ts.CRAFT_REFUSED_PREFIX).toBe(mjs.CRAFT_REFUSED_PREFIX);
  });

  it("agrees on the brand contexts", () => {
    expect(ts.BRAND_CONTEXTS).toEqual(mjs.BRAND_CONTEXTS);
  });

  it("renders the scene bank identically on both sides", () => {
    // Fixed dates, one per season window plus the unknown-brand miss — the
    // month decides the season, so the pin must not depend on when the suite
    // runs.
    const dates = [
      new Date("2026-06-15T12:00:00Z"), // year-start window
      new Date("2026-09-15T12:00:00Z"), // mid-term window
      new Date("2026-12-15T12:00:00Z"), // term-close window
      new Date("2027-02-20T12:00:00Z"), // ramadan-revision window
      new Date("2026-04-20T12:00:00Z"), // certificate-exams window
    ];
    for (const date of dates) {
      expect(ts.scenesFor("hogwarts", date)).toEqual(
        mjs.scenesFor("hogwarts", date),
      );
      expect(ts.scenesFor("hogwarts", date)).toBeTruthy();
    }
    expect(ts.scenesFor("mkan")).toBeUndefined();
    expect(mjs.scenesFor("mkan")).toBeUndefined();
  });

  it("puts the season's scenes ahead of the evergreen ones", () => {
    // The season is the sharper anchor; evergreen pads after it. The cap
    // keeps the section a nudge rather than a second brief.
    const june = ts.scenesFor("hogwarts", new Date("2026-06-15T12:00:00Z"));
    expect(june).toContain("موسم التسجيل");
    expect(june?.indexOf("موسم التسجيل")).toBeLessThan(
      june?.indexOf("طابور الصباح") ?? -1,
    );
    expect((june ?? "").split("\n").length).toBeLessThanOrEqual(8);
  });

  it("keeps statics ahead of dynamics for the cache prefix", () => {
    // Implicit caching keys on an identical prefix (D-20260807 0.f). The
    // brief is the first per-ask dynamic; everything before it must not vary
    // per ask — so the house rules must sit above it.
    const prompt = ts.buildDraftPrompt({
      brand: "hogwarts",
      brief: "UNIQUE-BRIEF-TOKEN",
      lessons: "hook 1×",
    });
    const rulesAt = prompt.indexOf("House Rules:");
    const briefAt = prompt.indexOf("UNIQUE-BRIEF-TOKEN");
    const lessonsAt = prompt.indexOf("Reviewers recently dismissed");
    expect(rulesAt).toBeGreaterThan(-1);
    expect(rulesAt).toBeLessThan(briefAt);
    expect(briefAt).toBeLessThan(lessonsAt);
  });
});
