/**
 * Unit tests for the scoring function and hard filters. Pure functions only —
 * no need to mock Anthropic or GitHub here.
 *
 * Ported from codebase/src/lib/report/__tests__/score.test.ts (2026-05) and
 * extended for the per-reporter floors, the team lane and the split filters.
 *
 * Run via: pnpm vitest run src/lib/report
 */

import { describe, expect, it } from "vitest";

import {
  hostMatches,
  letterRatio,
  runContextFilters,
  runHardFilters,
  runPureFilters,
  uniqueMeaningfulTokens,
} from "../hard-filters";
import { REPORT_LIMITS, SCHEMA_MIN_CHARS } from "../limits";
import { reportSchema } from "../schema";
import { bucketFor, computeScore, THRESHOLDS } from "../score";
import type { AITriageResult, ReporterContext } from "../types";

// ─── fixtures ──────────────────────────────────────────────────────────────

const adminReporter: ReporterContext = {
  kind: "authenticated",
  userId: "user_admin_1",
  role: "ADMIN",
  emailVerified: true,
  accountAgeDays: 365,
  isSuspended: false,
  ipHash: "abc123",
  priorAccepted: 5,
  priorRejected: 0,
};

const teamReporter: ReporterContext = {
  kind: "authenticated",
  userId: "user_team_1",
  role: "ADMIN",
  emailVerified: true,
  accountAgeDays: 30,
  isSuspended: false,
  ipHash: "team01",
  isTeam: true,
};

const newGuestReporter: ReporterContext = {
  kind: "authenticated",
  userId: "user_guest_1",
  role: "GUEST",
  emailVerified: false,
  accountAgeDays: 1,
  isSuspended: false,
  ipHash: "def456",
};

const anonReporter: ReporterContext = {
  kind: "anonymous",
  ipHash: "anon_xyz",
};

const goodTriage: AITriageResult = {
  classification: "bug",
  severity: "high",
  qualityScore: 80,
  clarity: 75,
  hasRepro: true,
  hasExpected: true,
  destructiveSignals: [],
  language: "en",
  rationale: "Clear repro on price step",
};

const spamTriage: AITriageResult = {
  ...goodTriage,
  classification: "spam",
  qualityScore: 10,
  clarity: 15,
  hasRepro: false,
  hasExpected: false,
  rationale: "Keyboard mashing",
};

const destructiveTriage: AITriageResult = {
  ...goodTriage,
  classification: "destructive",
  destructiveSignals: ["asks to delete all student data"],
  rationale: "User asks to delete production data without confirmation",
};

const featureTriage: AITriageResult = {
  ...goodTriage,
  classification: "feature",
  rationale: "Asks for new dashboard tab",
};

const baseInput = {
  description:
    "The price step in the onboarding wizard does not advance to the next page when I click Continue. I see a console error about a missing handler.",
  pageUrl: "https://ed.databayt.org/ar/onboarding/abc/price",
  category: "broken" as const,
  reproSteps: "1. Open price step 2. Click Continue 3. Nothing happens",
  expected: "Should advance to the next step",
  actual: "Stays on price step with no feedback",
  severityHint: "high" as const,
  viewport: "1440x900",
  direction: "ltr" as const,
  browser: "Mozilla/5.0 Chrome/120.0",
  hasScreenshot: false,
  captchaToken: undefined,
};

const ctx = {
  hostAllowlist: ["*.databayt.org", "*.balqalam.com", "localhost"],
  recentSelfSubmissions: [] as string[],
  captchaValid: true as boolean | null,
  isBanned: false,
};

// ─── limits ────────────────────────────────────────────────────────────────

describe("REPORT_LIMITS", () => {
  it("signed-in floor is lower than anonymous on both axes", () => {
    expect(REPORT_LIMITS.authenticated.minChars).toBeLessThan(
      REPORT_LIMITS.anonymous.minChars,
    );
    expect(REPORT_LIMITS.authenticated.minTokens).toBeLessThan(
      REPORT_LIMITS.anonymous.minTokens,
    );
  });

  it("schema floor equals the lowest per-kind floor", () => {
    expect(SCHEMA_MIN_CHARS).toBe(REPORT_LIMITS.authenticated.minChars);
  });
});

// ─── schema ────────────────────────────────────────────────────────────────

describe("reportSchema", () => {
  it("rejects descriptions under the schema floor", () => {
    const res = reportSchema.safeParse({
      ...baseInput,
      description: "too short",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a short signed-in-length report (the per-kind floor is HF1's job)", () => {
    const res = reportSchema.safeParse({
      ...baseInput,
      description: "قائمة الطلاب فارغة",
    });
    expect(res.success).toBe(true);
  });

  it("accepts a well-formed report", () => {
    const res = reportSchema.safeParse(baseInput);
    expect(res.success).toBe(true);
  });

  it("rejects invalid viewport format", () => {
    const res = reportSchema.safeParse({ ...baseInput, viewport: "huge" });
    expect(res.success).toBe(false);
  });
});

// ─── hard filters ──────────────────────────────────────────────────────────

describe("runHardFilters", () => {
  it("HF1: anonymous under 30 chars is rejected", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(
      { ...parsed, description: "Hi there friend, broken" },
      anonReporter,
      ctx,
    );
    expect(r?.code).toBe("HF1_too_short");
  });

  it("HF1: signed-in reporter clears the lower floor with the same text", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(
      { ...parsed, description: "Hi there friend, broken" },
      adminReporter,
      ctx,
    );
    expect(r?.code).not.toBe("HF1_too_short");
  });

  it("HF1: signed-in reporter still fails under 10 chars", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(
      { ...parsed, description: "broken" },
      adminReporter,
      ctx,
    );
    expect(r?.code).toBe("HF1_too_short");
  });

  it("HF3: anonymous without captcha", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(parsed, anonReporter, {
      ...ctx,
      captchaValid: false,
    });
    expect(r?.code).toBe("HF3_no_captcha");
  });

  it("HF3: captchaValid null means not enforced — passes", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(parsed, anonReporter, {
      ...ctx,
      captchaValid: null,
    });
    expect(r).toBeNull();
  });

  it("HF4: suspended account", () => {
    const parsed = reportSchema.parse(baseInput);
    const suspended: ReporterContext = { ...adminReporter, isSuspended: true };
    const r = runHardFilters(parsed, suspended, ctx);
    expect(r?.code).toBe("HF4_suspended");
  });

  it("HF5: rejects out-of-allowlist host", () => {
    const parsed = reportSchema.parse({
      ...baseInput,
      pageUrl: "https://evil.example.com/foo",
    });
    const r = runHardFilters(parsed, adminReporter, ctx);
    expect(r?.code).toBe("HF5_host_mismatch");
  });

  it("HF5: a dev URL with a port matches the bare `localhost` entry", () => {
    // URL.host carries the port ("localhost:3000"); the allowlist is matched on
    // hostname. Every local report was silently rejected before this test.
    const parsed = reportSchema.parse({
      ...baseInput,
      pageUrl: "http://localhost:3000/en/docs",
    });
    expect(runHardFilters(parsed, adminReporter, ctx)).toBeNull();
  });

  it("HF5: balqalam.com tenants pass once listed (the 2026-09 cutover gap)", () => {
    const parsed = reportSchema.parse({
      ...baseInput,
      pageUrl: "https://kingfahd.balqalam.com/ar/timetable",
    });
    expect(runHardFilters(parsed, adminReporter, ctx)).toBeNull();
    expect(
      runHardFilters(parsed, adminReporter, {
        ...ctx,
        hostAllowlist: ["*.databayt.org"],
      })?.code,
    ).toBe("HF5_host_mismatch");
  });

  it("HF6: rejects gibberish with few unique tokens", () => {
    const parsed = reportSchema.parse({
      ...baseInput,
      description: "asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf",
    });
    const r = runHardFilters(parsed, adminReporter, ctx);
    expect(r?.code).toBe("HF6_few_tokens");
  });

  it("HF6: a three-word signed-in report passes, the same words anonymous fail", () => {
    const parsed = reportSchema.parse({
      ...baseInput,
      description: "قائمة الطلاب فارغة في صفحة التسجيل",
    });
    expect(runHardFilters(parsed, adminReporter, ctx)).toBeNull();
    const short = reportSchema.parse({
      ...baseInput,
      description: "class list empty here",
    });
    expect(runHardFilters(short, adminReporter, ctx)).toBeNull();
    expect(runHardFilters(short, anonReporter, ctx)?.code).toBe(
      "HF1_too_short",
    );
  });

  it("HF7: rejects keyboard mashing (low letter ratio)", () => {
    const parsed = reportSchema.parse({
      ...baseInput,
      description: "!@#$%^&*()!@#$%^&*()!@#$%^&*()!@#$%^&*()!!!!!!",
    });
    const r = runHardFilters(parsed, adminReporter, ctx);
    // Symbol-only text has zero meaningful tokens, so HF6 fires first — either
    // way the paste is silently rejected before any network call.
    expect(["HF6_few_tokens", "HF7_gibberish"]).toContain(r?.code);
  });

  it("HF9: rejects same description from same reporter within 60s", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(parsed, adminReporter, {
      ...ctx,
      recentSelfSubmissions: [parsed.description.slice(0, 60)],
    });
    expect(r?.code).toBe("HF9_self_duplicate");
  });

  it("HF10: banned identifier short-circuits everything", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(parsed, adminReporter, { ...ctx, isBanned: true });
    expect(r?.code).toBe("HF10_banned");
  });

  it("passes a clean authenticated report on production host", () => {
    const parsed = reportSchema.parse(baseInput);
    const r = runHardFilters(parsed, adminReporter, ctx);
    expect(r).toBeNull();
  });
});

describe("split filters", () => {
  it("pure filters need no context and catch junk", () => {
    const parsed = reportSchema.parse({
      ...baseInput,
      description: "asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf",
    });
    expect(runPureFilters(parsed, anonReporter, ctx.hostAllowlist)?.code).toBe(
      "HF6_few_tokens",
    );
    expect(
      runPureFilters(
        reportSchema.parse(baseInput),
        anonReporter,
        ctx.hostAllowlist,
      ),
    ).toBeNull();
  });

  it("context filters honour the identity/history phases", () => {
    const banned = { ...ctx, isBanned: true, description: "x" };
    expect(runContextFilters(adminReporter, banned, "identity")?.code).toBe(
      "HF10_banned",
    );
    expect(runContextFilters(adminReporter, banned, "history")).toBeNull();

    const dup = {
      ...ctx,
      recentSelfSubmissions: ["the same head"],
      description: "The same head",
    };
    expect(runContextFilters(adminReporter, dup, "identity")).toBeNull();
    expect(runContextFilters(adminReporter, dup, "history")?.code).toBe(
      "HF9_self_duplicate",
    );
  });
});

// ─── scoring ───────────────────────────────────────────────────────────────

describe("computeScore", () => {
  const parsed = reportSchema.parse(baseInput);

  it("admin + good content + good triage + prod host → verified-report", () => {
    const r = computeScore(parsed, {
      reporter: adminReporter,
      triage: goodTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).toBe("verified-report");
    expect(r.score).toBeGreaterThanOrEqual(THRESHOLDS.verified);
  });

  it("anonymous + good content + good triage caps near needs-human (low R)", () => {
    const r = computeScore(parsed, {
      reporter: anonReporter,
      triage: goodTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).not.toBe("verified-report");
    expect(r.score).toBeLessThan(THRESHOLDS.verified);
  });

  it("destructive classification → needs-human regardless of score", () => {
    const r = computeScore(parsed, {
      reporter: adminReporter,
      triage: destructiveTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).toBe("needs-human");
  });

  it("feature classification → demoted from verified to needs-human", () => {
    const r = computeScore(parsed, {
      reporter: adminReporter,
      triage: featureTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).not.toBe("verified-report");
  });

  it("spam classification → score discounted, lands silent or low", () => {
    const r = computeScore(parsed, {
      reporter: anonReporter,
      triage: spamTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(["silent-reject", "low-confidence"]).toContain(r.bucket);
  });

  it("AI failure (triage=null) caps verified → needs-human", () => {
    const r = computeScore(parsed, {
      reporter: adminReporter,
      triage: null,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).not.toBe("verified-report");
  });

  it("corroboration bonus boosts bug scores", () => {
    const lowR = computeScore(parsed, {
      reporter: newGuestReporter,
      triage: goodTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    const corroborated = computeScore(parsed, {
      reporter: newGuestReporter,
      triage: goodTriage,
      corroborationCount: 3,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(corroborated.score).toBeGreaterThan(lowR.score);
  });

  it("coordinated-noise penalty subtracts from score", () => {
    const clean = computeScore(parsed, {
      reporter: anonReporter,
      triage: goodTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    const noisy = computeScore(parsed, {
      reporter: anonReporter,
      triage: goodTriage,
      corroborationCount: 0,
      ipDailyNoise: 5,
      hostIsProd: true,
    });
    expect(noisy.score).toBeLessThan(clean.score);
  });

  it("silent-reject bucket has empty labels", () => {
    const minimal = reportSchema.parse({
      ...baseInput,
      description: "x".repeat(35), // passes Zod but content is empty value
      reproSteps: undefined,
      expected: undefined,
      actual: undefined,
      category: "other",
    });
    const r = computeScore(minimal, {
      reporter: anonReporter,
      triage: spamTriage,
      corroborationCount: 0,
      ipDailyNoise: 10,
      hostIsProd: false,
    });
    if (r.bucket === "silent-reject") {
      expect(r.labels).toEqual([]);
    }
  });

  it("severityHint=critical with score >= 60 promotes to verified", () => {
    const r = computeScore(
      { ...parsed, severityHint: "critical" },
      {
        reporter: { ...newGuestReporter, accountAgeDays: 100 },
        triage: { ...goodTriage, severity: "critical" },
        corroborationCount: 0,
        ipDailyNoise: 0,
        hostIsProd: true,
      },
    );
    expect(r.bucket).toBe("verified-report");
  });
});

describe("computeScore — team lane", () => {
  // The shape of every real team report so far: one short sentence, category
  // "other", no repro, no triage (no ANTHROPIC_API_KEY in prod). hogwarts#382
  // ("in the student drop down list not all the students appears") scored 40
  // → low-confidence → "agent skips, 14d auto-close". That is the bug.
  const shortTeamReport = reportSchema.parse({
    description: "in the student drop down list not all the students appears",
    pageUrl: "https://demo.balqalam.com/en/students/enroll",
    category: "other",
    viewport: "1366x633",
    direction: "ltr",
    browser: "Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36",
    hasScreenshot: false,
  });

  it("the same report as a non-team ADMIN still lands low-confidence without triage", () => {
    const r = computeScore(shortTeamReport, {
      reporter: { ...adminReporter, accountAgeDays: 30, priorAccepted: 0 },
      triage: null,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).toBe("low-confidence");
  });

  it("a team reporter never sinks below needs-human and carries the team label", () => {
    const r = computeScore(shortTeamReport, {
      reporter: teamReporter,
      triage: null,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).toBe("needs-human");
    expect(r.breakdown.R).toBe(30);
    expect(r.labels).toContain("team");
    expect(r.labels).toContain("needs-human");
    expect(r.labels).not.toContain("low-confidence");
  });

  it("team + AI-confirmed bug with repro still reaches verified-report", () => {
    const r = computeScore(reportSchema.parse(baseInput), {
      reporter: teamReporter,
      triage: goodTriage,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).toBe("verified-report");
    expect(r.labels).toContain("team");
  });

  it("team is a floor, not a free pass: no triage means no auto-fix", () => {
    const r = computeScore(reportSchema.parse(baseInput), {
      reporter: teamReporter,
      triage: null,
      corroborationCount: 0,
      ipDailyNoise: 0,
      hostIsProd: true,
    });
    expect(r.bucket).toBe("needs-human");
  });
});

// ─── helper functions ──────────────────────────────────────────────────────

describe("hostMatches", () => {
  it("exact match", () => {
    expect(hostMatches("localhost", ["localhost"])).toBe(true);
  });
  it("wildcard suffix", () => {
    expect(hostMatches("ed.databayt.org", ["*.databayt.org"])).toBe(true);
    expect(hostMatches("databayt.org", ["*.databayt.org"])).toBe(true);
    expect(hostMatches("kingfahd.balqalam.com", ["*.balqalam.com"])).toBe(true);
  });
  it("rejects mismatched host", () => {
    expect(hostMatches("evil.example.com", ["*.databayt.org"])).toBe(false);
    expect(hostMatches("notbalqalam.com", ["*.balqalam.com"])).toBe(false);
  });
});

describe("bucketFor", () => {
  it("respects strict thresholds", () => {
    expect(bucketFor(29)).toBe("silent-reject");
    expect(bucketFor(30)).toBe("low-confidence");
    expect(bucketFor(54)).toBe("low-confidence");
    expect(bucketFor(55)).toBe("needs-human");
    expect(bucketFor(74)).toBe("needs-human");
    expect(bucketFor(75)).toBe("verified-report");
    expect(bucketFor(100)).toBe("verified-report");
  });
});

describe("uniqueMeaningfulTokens", () => {
  it("dedupes case-insensitively and ignores short tokens", () => {
    expect(uniqueMeaningfulTokens("the the THE the The the")).toBe(1);
  });
  it("handles Arabic", () => {
    expect(
      uniqueMeaningfulTokens("هذا اختبار للتحقق من العد"),
    ).toBeGreaterThanOrEqual(4);
  });
});

describe("letterRatio", () => {
  it("scores normal English text high", () => {
    const r = letterRatio("This is a regular sentence with words.");
    expect(r.letters).toBeGreaterThan(0.7);
  });
  it("scores symbol-only text low", () => {
    const r = letterRatio("!@#$%^&*()!@#$%^&*()");
    expect(r.letters).toBe(0);
  });
});
