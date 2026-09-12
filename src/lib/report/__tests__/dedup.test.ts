/**
 * Dedup — the similarity check must compare description to description.
 * A real pipeline-written issue body carries a metadata footer and a score
 * block that a re-submission can never share; comparing against the whole
 * body kept every verbatim re-report below the 0.8 threshold.
 */

import { describe, expect, it } from "vitest";

import { descriptionOf, jaccardSimilarity } from "../dedup";

const description =
  "in the student drop down list not all the students appears";

// The exact shape buildBody() writes (see pipeline.ts), as seen on hogwarts#382.
const realBody = [
  description,
  "",
  "---",
  "",
  "**Page**: `https://demo.databayt.org/en/students/enroll`",
  "**Reporter**: ADMIN (id:cmrkybll…)",
  "**Time**: 2026-07-15T15:07:45.085Z",
  "**Category**: other",
  "**Viewport**: 1366x633",
  "**Direction**: ltr",
  "**Browser**: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  "",
  "<!-- score-block",
  JSON.stringify(
    {
      score: 40,
      bucket: "low-confidence",
      classification: "unknown",
      severity: "medium",
      language: "other",
      scores: { R: 23, Q: 7, C: 10, A: 0, P: 0 },
      rationale: "",
    },
    null,
    2,
  ),
  "-->",
].join("\n");

describe("descriptionOf", () => {
  it("returns the reporter's words above the first rule", () => {
    expect(descriptionOf({ title: "x", body: realBody })).toBe(description);
  });

  it("falls back to the title for bodies the pipeline did not write", () => {
    expect(descriptionOf({ title: "Manual issue", body: "" })).toBe(
      "Manual issue",
    );
    expect(
      descriptionOf({ title: "Manual issue", body: "\n---\nonly a footer" }),
    ).toBe("Manual issue");
  });
});

describe("jaccardSimilarity", () => {
  it("a verbatim re-submission against the whole body would NOT have matched", () => {
    expect(jaccardSimilarity(description, realBody)).toBeLessThan(0.8);
  });

  it("the same re-submission against the extracted description matches", () => {
    expect(
      jaccardSimilarity(
        description,
        descriptionOf({ title: "x", body: realBody }),
      ),
    ).toBe(1);
  });

  it("a lightly edited re-submission still clears the threshold", () => {
    const edited =
      "in the student drop down list not all the students appears today";
    expect(
      jaccardSimilarity(edited, descriptionOf({ title: "x", body: realBody })),
    ).toBeGreaterThanOrEqual(0.8);
  });

  it("a different report on the same page does not", () => {
    const other = "the enroll button stays disabled after picking a grade";
    expect(
      jaccardSimilarity(other, descriptionOf({ title: "x", body: realBody })),
    ).toBeLessThan(0.8);
  });
});
