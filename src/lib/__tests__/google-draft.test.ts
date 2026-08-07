import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRAFT_MODELS } from "@/components/root/social/knobs";
import { GEMINI_DRAFT_MODEL } from "@/lib/google-draft";

// The inline Gemini lane exists in two places that cannot import each other:
// src/lib/google-draft.ts (the server action's adapter, TypeScript) and
// scripts/social-drafts.mjs drain-google (the launchd tick, plain .mjs). The
// model id is an execution parameter with a measured cost profile — D-20260807
// timed the candidates and chose gemini-3.6-flash — so the two surfaces
// drifting apart is not cosmetic: before the reconcile, one called a model 2×
// slower than the one the memo picked, and the Hub's label named a third.
describe("the gemini draft model", () => {
  it("is the model the decision memo measured and chose", () => {
    expect(GEMINI_DRAFT_MODEL).toBe("gemini-3.6-flash");
  });

  it("is what drain-google actually calls", () => {
    // Same idiom as knobs.test.ts's KNOWN_MODELS pin: read the script as
    // source, because a .mjs cannot be imported into a TS test any more than
    // the TS can be imported into the .mjs.
    const script = readFileSync(
      join(process.cwd(), "scripts/social-drafts.mjs"),
      "utf8",
    );
    const declared = script.match(/const GEMINI_MODEL = "([^"]+)"/)?.[1];
    expect(declared).toBe(GEMINI_DRAFT_MODEL);
  });

  it("is what the Hub's model select says it is", () => {
    // The knob label is the only place a contributor learns which model
    // answers a google-free ask. "Gemini 2.5 Pro" over a 3.6-flash call is a
    // lie in a dropdown.
    const knob = DRAFT_MODELS.find((m) => m.id === "google-free");
    expect(knob?.label).toMatch(/Gemini 3\.6 Flash/);
  });
});
