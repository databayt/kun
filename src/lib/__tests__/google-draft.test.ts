import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRAFT_MODELS } from "@/components/root/social/knobs";
import { GEMINI_DRAFT_MODEL } from "@/lib/google-draft";

// The TS/.mjs cross-boundary pins (model id, craft-refused marker) live in
// draft-prompt.test.ts now — the mirror pair is imported directly on both
// sides, which beats the source-regex pins this file carried when the
// constants still lived in two hand-kept copies. What remains here is the
// lane's outward truth: the measured model choice and the label a
// contributor reads.
describe("the gemini draft model", () => {
  it("is the model the decision memo measured and chose", () => {
    expect(GEMINI_DRAFT_MODEL).toBe("gemini-3.6-flash");
  });

  it("is what the Hub's model select says it is", () => {
    // The knob label is the only place a contributor learns which model
    // answers a google-free ask. "Gemini 2.5 Pro" over a 3.6-flash call is a
    // lie in a dropdown.
    const knob = DRAFT_MODELS.find((m) => m.id === "google-free");
    expect(knob?.label).toMatch(/Gemini 3\.6 Flash/);
  });
});

describe("the craft-refused marker", () => {
  it("is told to the claude lane in the drain prompt", () => {
    // The refused row's whole point is that the NEXT lane knows why. The
    // heredoc must brief the writer on the craftRefused field, or the marker
    // is written and never read.
    const drain = readFileSync(
      join(process.cwd(), "scripts/drain-drafts.sh"),
      "utf8",
    );
    expect(drain).toContain('"craftRefused"');
  });
});
