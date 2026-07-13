export const meta = {
  name: "carousel",
  description:
    "Batch per-block carousel decks — resolve a product's blocks, draft one bilingual deck per block, adversarial copy QA, render, stage. Never publishes.",
  whenToUse:
    "Invoked when Abdout asks for carousels across a product's feature blocks (e.g. 'carousels for the hogwarts blocks'). The invocation is the multi-agent opt-in. One brand-level deck is NOT this — that is the /carousel skill in-session.",
  phases: [
    {
      title: "Resolve",
      detail: "read the product repo's blocks.json + per-block records",
    },
    {
      title: "Draft",
      detail:
        "one agent per block writes a deck into the brand repo's carousels/ dir",
    },
    {
      title: "QA",
      detail:
        "adversarial copy review per deck (Arabic, hook, one-idea, budgets) + one fixer round",
    },
    {
      title: "Stage",
      detail:
        "render every deck via the CLI; report file paths — staged, never published",
    },
  ],
};

// args: "hogwarts" | { brand, blocks: "all" | string[], repoPath, base, limit }
const _a =
  args && typeof args === "object"
    ? args
    : typeof args === "string"
      ? { brand: args }
      : {};
const brand = _a.brand || "hogwarts";
const repoPath = _a.repoPath || `/Users/abdout/${brand}`;
const deckDir = _a.deckDir || `${repoPath}/carousels`; // decks live with the product
const base = _a.base || "http://localhost:3000";
const LIMIT = _a.limit ?? 6; // decks per run — keep runs reviewable
const wanted = _a.blocks && _a.blocks !== "all" ? _a.blocks : null;

const DECK_RULES = `
Deck contract (zod, kun/src/components/root/carousel/schema.ts):
{ brand:"${brand}", slug:"block-<name>", title:{ar,en}, block:"<name>",
  slides:[3..10 of {type: cover|point|stat|quote|steps|cta, theme: ivory|dark|clay|oat,
  art?: "<file>.svg", ...bilingual text fields per type}],
  captions:{base:{ar,en}, hashtags:["#..."], link:"https://..."}, createdAt:"YYYY-MM-DD", status:"draft" }
Copy rules: AR crafted first (never literal translation); cover hook <=12 words; ONE idea
per slide; open loop between slides; concrete nouns; CTA last; headline <=48 AR / <=56 EN
chars; body <=140; no letter-spacing concepts in AR; Latin digits inside copy.
Art: pick from kun/public/carousel-art/ (or cdn.databayt.org/anthropic/<file>) — Anthropic
ILLUSTRATIONS only, never Anthropic/Claude logomarks. Voice: kun/content/docs/brand.mdx +
kun/content/docs/social/${brand}.mdx — HP flavor light for hogwarts.
`;

// ── Phase 1: Resolve ──────────────────────────────────────────────────────
phase("Resolve");
const resolved = await agent(
  `Read ${repoPath}/.claude/blocks.json. ${
    wanted
      ? `Keep only these blocks: ${JSON.stringify(wanted)}.`
      : `Pick the ${LIMIT} most marketable blocks (client-facing features, not infra).`
  } For each block, read its README.md / docs under the block's component dir if present and
  distill: what it does, who it serves, the one pain it kills, one proof point. Return JSON.`,
  {
    label: "resolve:blocks",
    schema: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              context: { type: "string" },
            },
            required: ["name", "context"],
          },
        },
      },
      required: ["blocks"],
    },
  },
);
const blocks = (resolved?.blocks || []).slice(0, LIMIT);
if (!blocks.length) throw new Error(`no blocks resolved for ${brand}`);
log(`${blocks.length} blocks → decks`);

// ── Phases 2+3 pipelined per block: Draft → QA → fix ─────────────────────
const qaResults = await pipeline(
  blocks,
  (b) =>
    agent(
      `Write a bilingual carousel deck for the "${b.name}" block of ${brand}.
Context: ${b.context}
${DECK_RULES}
Write the file to ${deckDir}/block-${b.name}.json and
return {"slug":"block-${b.name}","written":true}.`,
      {
        label: `draft:${b.name}`,
        phase: "Draft",
        schema: {
          type: "object",
          properties: {
            slug: { type: "string" },
            written: { type: "boolean" },
          },
          required: ["slug", "written"],
        },
      },
    ),
  (draft, b) =>
    agent(
      `Adversarially review the carousel deck ${deckDir}/block-${b.name}.json.
Attack: Arabic correctness and naturalness (is it crafted or translated?), hook strength
(<=12 words, pain/promise?), one-idea-per-slide, budget overflows (headline 48 AR / 56 EN,
body 140), CTA clarity, art choice sanity. If ANY finding, FIX the file in place (minimum
diff, keep the voice) and list what you changed. Return JSON.`,
      {
        label: `qa:${b.name}`,
        phase: "QA",
        schema: {
          type: "object",
          properties: {
            pass: { type: "boolean" },
            findings: { type: "array", items: { type: "string" } },
          },
          required: ["pass", "findings"],
        },
      },
    ).then((qa) => ({ block: b.name, qa })),
);

// ── Phase 4: Stage (render every surviving deck) ─────────────────────────
phase("Stage");
const staged = await agent(
  `For each deck slug in ${JSON.stringify(
    qaResults.filter(Boolean).map((r) => `block-${r.block}`),
  )}: run \`node scripts/render-carousel.mjs ${brand}/<slug>\` from /Users/abdout/kun
(dev server assumed on ${base} — if it is down, report that instead of starting it).
Return JSON with per-slug output paths or the error.`,
  {
    label: "stage:render-all",
    schema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slug: { type: "string" },
              outDir: { type: "string" },
              error: { type: "string" },
            },
            required: ["slug"],
          },
        },
      },
      required: ["results"],
    },
  },
);

return {
  brand,
  decks: qaResults.filter(Boolean),
  staged: staged?.results || [],
  note: "STAGED ONLY — human approval required before any publish/DM (see /carousel step 8).",
};
