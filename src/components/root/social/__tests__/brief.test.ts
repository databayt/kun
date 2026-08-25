import { describe, expect, it } from "vitest";

import { composeBrief } from "@/components/root/social/brief";

const base = {
  text: "",
  feature: null,
  postType: "image" as const,
  channels: [],
  mediaCount: 0,
  style: null,
};

describe("composing a brief from the composer's settings", () => {
  it("refuses when there is no subject at all", () => {
    // A brief with no subject produces copy about the brand in general, which
    // is the post nobody reads. Better to ask for a word than to send one.
    expect(composeBrief(base)).toBeNull();
    expect(composeBrief({ ...base, channels: ["Facebook"] })).toBeNull();
  });

  it("takes a feature alone as a subject", () => {
    const brief = composeBrief({ ...base, feature: "Admission" });
    expect(brief).toContain("Admission");
  });

  it("leads with the writer's own words", () => {
    // Everything else in the brief qualifies this sentence. Put the qualifiers
    // first and the subject reads as an afterthought to its own brief.
    const brief = composeBrief({
      ...base,
      text: "the paper chase ends this term",
      feature: "Admission",
    });
    expect(brief?.split("\n")[0]).toBe("the paper chase ends this term");
  });

  it("says how much copy the shape wants, not what the shape is called", () => {
    // "Text + image" names a card in a picker. A writer needs to know that a
    // caption under one still is a different length from a deck's first panel.
    const caption = composeBrief({ ...base, text: "x", postType: "image" });
    const deck = composeBrief({ ...base, text: "x", postType: "carousel" });
    const silent = composeBrief({ ...base, text: "x", postType: "imageOnly" });

    expect(caption).toContain("beside one image");
    expect(deck).toContain("stand alone");
    expect(silent).toContain("carries the post");
    expect(caption).not.toBe(deck);
  });

  it("tells the writer when the pictures already exist", () => {
    const one = composeBrief({ ...base, text: "x", mediaCount: 1 });
    const many = composeBrief({ ...base, text: "x", mediaCount: 4 });
    expect(one).toContain("One asset is already attached");
    expect(many).toContain("4 assets are already attached");
  });

  it("asks for a visual register only when nothing is attached", () => {
    // With assets in hand the register is already decided; asking for one
    // would describe a picture that is not going to be made.
    const empty = composeBrief({ ...base, text: "x", style: "Cinematic" });
    const held = composeBrief({
      ...base,
      text: "x",
      style: "Cinematic",
      mediaCount: 2,
    });
    expect(empty).toContain("Suggested visual: cinematic.");
    expect(held).not.toContain("Suggested visual");
  });

  it("names the channels the post is going to", () => {
    const brief = composeBrief({
      ...base,
      text: "x",
      channels: ["Facebook", "Instagram"],
    });
    expect(brief).toContain("Going to: Facebook, Instagram.");
  });

  it("never repeats what rides as a column", () => {
    // Angle, register, reference and model are columns on the request and are
    // passed as columns. Saying them again in prose would let the two drift,
    // and the prose copy is the one nothing validates.
    const brief = composeBrief({
      ...base,
      text: "x",
      feature: "Admission",
      channels: ["Facebook"],
      mediaCount: 1,
    });
    expect(brief).not.toMatch(/Angle:|Register:|rung/i);
  });
});
