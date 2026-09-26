import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRAFT_MODEL,
  DISMISS_REASONS,
  DISMISS_REASON_IDS,
  DRAFT_ANGLES,
  DRAFT_MODELS,
  DRAFT_MODEL_IDS,
  DRAFT_REGISTERS,
} from "@/components/root/social/knobs";

// These are not shape tests. Every assertion here is a doctrine that lives in
// prose somewhere else — copy.mdx, the drain script — and would
// otherwise be enforced only by whoever remembers it. The knobs are the surface
// where the doctrine meets a dropdown, which is exactly where it drifts.

describe("the register ladder", () => {
  it("never offers rung 1", () => {
    // copy.mdx: "Rung 1 — فصحى الصحافة (MSA press-release). Never ships."
    // Offering it would let the Hub ask for the one register the craft bar
    // rejects on sight, and the draft would come back already failed.
    expect(DRAFT_REGISTERS.map((r) => r.id)).not.toContain(1);
  });

  it("offers every rung the ladder says can ship", () => {
    expect(DRAFT_REGISTERS.map((r) => r.id)).toEqual([2, 3, 4]);
  });

  it("says what every rung sounds like, in Arabic", () => {
    // `markers` is the card's body, and the ladder is a fact about Arabic — a
    // rung whose markers came back transliterated or translated would describe
    // the register instead of letting anyone hear it.
    for (const rung of DRAFT_REGISTERS) {
      expect(rung.markers, `${rung.id} markers`).toMatch(/[؀-ۿ]/);
    }
  });

  it("carries both languages for every rung", () => {
    // The Hub is Arabic-default. A rung whose hint exists only in English is
    // invisible guidance to the reader most likely to be choosing a register.
    for (const rung of DRAFT_REGISTERS) {
      expect(rung.labelAr.length).toBeGreaterThan(0);
      expect(rung.hintAr.length).toBeGreaterThan(0);
    }
  });
});

describe("the three angles", () => {
  it("carries both languages, name and definition", () => {
    // The Hub draws each angle as a card whose BODY is the definition — an
    // angle card missing its Arabic would be an empty card to the reader most
    // likely to be choosing one.
    for (const angle of DRAFT_ANGLES) {
      expect(angle.labelAr.length, `${angle.id} labelAr`).toBeGreaterThan(0);
      expect(angle.hint.length, `${angle.id} hint`).toBeGreaterThan(0);
      expect(angle.hintAr.length, `${angle.id} hintAr`).toBeGreaterThan(0);
    }
  });

  it("is exactly copy.mdx's set", () => {
    // "Name three angles before writing one" — the pain, the moment, the proof.
    // A fourth here would be an angle the craft bar has no opinion about.
    expect(DRAFT_ANGLES.map((a) => a.id)).toEqual(["pain", "moment", "proof"]);
  });
});

describe("the model chain", () => {
  // The draft chain is owned by knobs.ts + the drain's KNOWN_MODELS — NOT by
  // .claude/engine.json. Asserting the Hub default === engine.json's `model`
  // is the coupling that let a social-default change overwrite the engine's
  // Claude Code session model (4f2bd76); the drain contract below is the real
  // execution guarantee.

  it("names each model's place in the chain, in both languages", () => {
    // The Hub's model cards are four names; `role` is the only thing that
    // separates them for someone choosing.
    for (const m of DRAFT_MODELS) {
      expect(m.role.length, `${m.id} role`).toBeGreaterThan(0);
      expect(m.roleAr.length, `${m.id} roleAr`).toBeGreaterThan(0);
    }
  });

  it("lists the default first, so the select opens on it", () => {
    expect(DRAFT_MODELS[0].id).toBe(DEFAULT_DRAFT_MODEL);
  });

  it("is the same set the drain groups by", () => {
    // drain-drafts.sh groups the pending queue by model and makes one claude
    // call per group. A model offered here but absent from KNOWN_MODELS there
    // silently falls into the `default` group — the ask would be answered, on
    // the wrong model, with nothing in the log to say so.
    const drain = readFileSync(
      join(process.cwd(), "scripts/drain-drafts.sh"),
      "utf8",
    );
    const declared = drain.match(/KNOWN_MODELS="([^"]+)"/)?.[1]?.split(" ");
    expect(declared).toEqual([...DRAFT_MODEL_IDS]);
  });
});

describe("dismiss reasons", () => {
  it("keeps ids stable and separate from labels", () => {
    // The id is the aggregation key `social-drafts.mjs lessons` groups by, and
    // it is stored in a column that outlives any wording. Reasons are rendered
    // from the bilingual dictionary; if an id ever becomes a sentence, a
    // rewording orphans every row written before it.
    for (const reason of DISMISS_REASONS) {
      expect(reason.id).toMatch(/^[a-z-]+$/);
    }
    expect(new Set(DISMISS_REASON_IDS).size).toBe(DISMISS_REASON_IDS.length);
  });

  it("names the craft check for the two that have one", () => {
    // Check 1 (hook) and check 2 (one idea) are the two failures the craft bar
    // makes binary, and the two the drain is told to fix by name.
    expect(DISMISS_REASONS.find((r) => r.id === "hook")?.check).toBe(1);
    expect(DISMISS_REASONS.find((r) => r.id === "two-posts")?.check).toBe(2);
  });
});
