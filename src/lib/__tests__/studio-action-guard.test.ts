import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// `generateStudioImage` was the only exported action in post-social.ts with no
// authorization check, and the only one that could reach a paid renderer.
// Server Action POSTs do not traverse proxy.ts's matcher, so nothing else stood
// in front of it — an anonymous caller could have driven metered spend the
// moment a key appeared in the environment.
//
// Exercising that boundary for real would mean mocking auth() through the
// "use server" bundler seam, which is the friction that split the core out in
// the first place. So this pins the invariant statically, the same way
// carousel-channels.test.ts pins the CHANNELS literal: the guard must be
// present, and it must run BEFORE any work.

const actionsPath = fileURLToPath(
  new URL("../../actions/post-social.ts", import.meta.url),
);

function generateStudioImageBody(): string {
  const src = readFileSync(actionsPath, "utf8");
  const start = src.indexOf("export async function generateStudioImage(");
  if (start === -1)
    throw new Error("generateStudioImage not found in post-social.ts");
  const end = src.indexOf("\n}", start);
  return src.slice(start, end);
}

describe("generateStudioImage stays behind the contributor gate", () => {
  it("calls requireContributor() before doing any work", () => {
    const body = generateStudioImageBody();
    expect(body).toContain("requireContributor()");

    const guardAt = body.indexOf("requireContributor()");
    const coreAt = body.indexOf("generateStudioImageCore(");
    expect(coreAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(coreAt);
  });

  it("reaches no paid renderer from the server", () => {
    // The OpenAI branch was unsanctioned spend: no /decide entry, and
    // media.mdx states the GPT-Image lane is a seat, not an endpoint.
    const src = readFileSync(actionsPath, "utf8");
    expect(src).not.toContain("api.openai.com");
    expect(src).not.toContain("OPENAI_API_KEY");
  });

  it("leaves every other exported action in the file guarded too", () => {
    // A new action added without a guard is the shape this bug took.
    const src = readFileSync(actionsPath, "utf8");
    const unguarded: string[] = [];
    const re = /export async function (\w+)\(/g;
    for (const m of src.matchAll(re)) {
      const start = m.index!;
      const end = src.indexOf("\nexport ", start + 1);
      const body = src.slice(start, end === -1 ? undefined : end);
      if (!body.includes("requireContributor()") && !body.includes("await auth()")) {
        unguarded.push(m[1]);
      }
    }
    expect(unguarded).toEqual([]);
  });
});
