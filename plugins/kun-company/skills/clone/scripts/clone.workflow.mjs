export const meta = {
  name: "clone-url-mirror",
  description:
    "Translate → reconcile → land a captured live-URL section into the house stack, pixel-exact, with tiered model+effort (Opus high → Sonnet medium → Sonnet low).",
  phases: [
    { title: "Translate", detail: "DOM + exact styles → pixel-exact JSX", model: "opus" },
    { title: "Reconcile", detail: "render, screenshot ×3, diff vs shots/, fix to tolerance", model: "sonnet" },
    { title: "Land", detail: "place in atom/template/block, pnpm build, report", model: "sonnet" },
  ],
};

// Inputs (from the `clone` skill, AFTER clone-capture.mjs has written the snapshot):
//   args.snapshotDir  absolute path to .clone/<slug>/   (required)
//   args.into         "atom" | "template" | "block" | "auto"  (default "auto")
//   args.componentName optional explicit name; else derived from the slug
//   args.repoRoot     target repo root (default: cwd of the run)
// args may arrive as a live object OR JSON-stringified across the tool boundary — handle both.
const _args =
  args && typeof args === "object"
    ? args
    : typeof args === "string"
      ? (() => { try { return JSON.parse(args); } catch { return {}; } })()
      : {};
const {
  snapshotDir,
  into = "auto",
  componentName,
  repoRoot,
} = _args;

if (!snapshotDir) {
  throw new Error(
    "clone.workflow: args.snapshotDir is required (the .clone/<slug> path). Received args (type " +
      typeof args + "): " + JSON.stringify(args)
  );
}

const REF = "~/.claude/skills/clone/references";
const root = repoRoot || ".";

const TRANSLATE_SCHEMA = {
  type: "object",
  required: ["componentPath", "previewRoute", "exactValueCount"],
  properties: {
    componentPath: { type: "string", description: "path to the component file written" },
    previewRoute: { type: "string", description: "URL path of the scratch preview route, e.g. /clone-preview" },
    previewFile: { type: "string", description: "path to the scratch preview route file (removed in Land)" },
    exactValueCount: { type: "number", description: "count of arbitrary-value Tailwind classes emitted" },
    primitivesUsed: { type: "array", items: { type: "string" } },
    tokenNotes: { type: "array", items: { type: "string" }, description: "optional 'rgb(..) ≈ --foreground' equivalences" },
    summary: { type: "string" },
  },
};

const RECONCILE_SCHEMA = {
  type: "object",
  required: ["matched", "iterations"],
  properties: {
    matched: { type: "boolean", description: "true if all 3 breakpoints are within tolerance of shots/" },
    iterations: { type: "number" },
    remainingDiffs: { type: "array", items: { type: "string" }, description: "any diffs left if not matched" },
    shotsTaken: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

const LAND_SCHEMA = {
  type: "object",
  required: ["finalPath", "buildPassed"],
  properties: {
    finalPath: { type: "string" },
    buildPassed: { type: "boolean" },
    level: { type: "string", description: "atom | template | block" },
    scratchRemoved: { type: "boolean" },
    summary: { type: "string" },
  },
};

// ── Phase 1 — Translate (Opus, high). The reasoning crux: fidelity is decided here.
phase("Translate");
log("translating captured section → pixel-exact JSX (Opus, high effort)");
const draft = await agent(
  `You are translating a captured live-URL section into pixel-exact house-stack JSX (Next 16 / React 19 / Tailwind v4 / shadcn-ui).

SNAPSHOT: ${snapshotDir}
Read, in order: ${snapshotDir}/manifest.json, ${snapshotDir}/dom.html, ${snapshotDir}/styles.json, ${snapshotDir}/tokens.json, and look at ${snapshotDir}/shots/1440.png.
Read these references first: ${REF}/snapshot-schema.md, ${REF}/style-mapping.md, ${REF}/rtl-logical.md.

DOCTRINE (pixel-exact — manifest.fidelity === "pixel-exact"):
- Reproduce EXACT computed values as Tailwind arbitrary values (text-[39px] font-[590] leading-[41px] bg-[rgb(...)]). Do NOT snap to the spacing scale or to design tokens.
- DOM structure follows dom.html; styles per node come from styles.json (keys align by path).
- Use a shadcn/ui primitive or existing atom ONLY where it does not compromise fidelity (a semantic <Button> whose classes are overridden to the exact captured styles is fine; a styled <div> is fine too).
- RTL-ready: inline-axis spacing/insets/text-align/per-corner radii → logical (ms/me/ps/pe/start/end/rounded-ss…) per rtl-logical.md. Block-axis & symmetric stay physical+exact.
- Responsive: author md:/lg: variants ONLY from tokens.json.breakpointBehavior; do not invent breakpoints.
- Assets: reference downloaded files in ${snapshotDir}/assets/ (use next/image); substitute cataloged fonts (assets/fonts.json) with the nearest next/font or existing --font-* and note it.
- Container widths: reproduce exact sizes for leaf/intrinsic elements; for layout containers prefer the mechanism (max-w-[..] mx-auto, flex-1) over a frozen width. See style-mapping.md "container caveat".

OUTPUT:
1. Write the component to a sensible draft path under ${root}/src/components/ (name: ${componentName || "from the slug"}). Pure presentational, typed, no business logic.
2. Create a scratch preview route so it can be rendered in isolation — e.g. ${root}/src/app/clone-preview/page.tsx (or this repo's App Router convention) that renders ONLY this component full-bleed on a matching background. This route is temporary (removed in Land).
3. Return the structured result. exactValueCount = how many arbitrary-value classes you emitted (sanity signal that you mirrored, not approximated).`,
  { label: "translate", phase: "Translate", model: "opus", effort: "high", agentType: "clone", schema: TRANSLATE_SCHEMA }
);

if (!draft) throw new Error("clone.workflow: translate phase returned nothing");
log(`translated → ${draft.componentPath} (${draft.exactValueCount} exact-value classes)`);

// ── Phase 2 — Reconcile (Sonnet, medium). Iterative visual diff — cheaper model, multiple passes.
phase("Reconcile");
log("rendering + visual-diffing against captured shots (Sonnet, medium effort)");
const recon = await agent(
  `You are visually reconciling a freshly-translated component against the ORIGINAL captured screenshots. Pixel-exact target.

COMPONENT: ${draft.componentPath}
PREVIEW ROUTE: ${draft.previewRoute} (file: ${draft.previewFile})
ORIGINAL SHOTS: ${snapshotDir}/shots/375.png, /768.png, /1440.png  (these are GROUND TRUTH)

SCRATCH FILES: write EVERY screenshot, crop, and diff image you produce into ${snapshotDir}/reconcile/ (create it — it is gitignored under .clone/). NEVER write scratch images to the repo root or src/ — that litters the project.

STEPS:
1. Ensure the dev server is running on port 3000 (start "pnpm dev" in the background if needed; wait until ready). NEVER use another port.
2. For each breakpoint 375, 768, 1440: resize the browser to that width and navigate to http://localhost:3000${draft.previewRoute}; screenshot into ${snapshotDir}/reconcile/ (browser MCP — mcp__browser__*).
3. Compare your screenshot to the matching ${snapshotDir}/shots/<bp>.png. Look for differences in: color, spacing/padding, font size/weight/line-height, border-radius, shadow, alignment, and layout/wrapping.
4. For each real difference, edit ${draft.componentPath} to fix it — adjust the arbitrary Tailwind values toward the captured ones in ${snapshotDir}/styles.json. Re-screenshot and re-compare.
5. Loop at most 3 iterations. Stop when all 3 breakpoints are within tolerance.

TOLERANCE: minor anti-aliasing/text-render differences are acceptable; structural/color/spacing differences are not. IMPORTANT: if the source uses a proprietary font (e.g. Anthropic Sans, SF Pro) that you substitute with the nearest web font, text line-wrapping and line-count may differ because the substitute has different metrics — that is an acceptable FONT artifact, NOT a structural diff to chase. Match layout/columns/sizing/spacing; report any wrap difference honestly as a font-metrics note rather than distorting sizes to force it.

Return matched=true only if all three breakpoints match structurally (font-metric wrap differences noted but allowed). List any remaining diffs honestly.`,
  { label: "reconcile", phase: "Reconcile", model: "sonnet", effort: "medium", schema: RECONCILE_SCHEMA }
);

if (recon && !recon.matched) {
  log(`reconcile left ${recon.remainingDiffs?.length || 0} diffs after ${recon.iterations} iterations — Land will report them`);
}

// ── Phase 3 — Land (Sonnet, low). Mechanical: place, build, clean up, report.
phase("Land");
log("placing into the component hierarchy + build check (Sonnet, low effort)");
const landed = await agent(
  `You are landing a reconciled clone into the component hierarchy and verifying the build.

COMPONENT: ${draft.componentPath}
SCRATCH PREVIEW FILE (remove this): ${draft.previewFile}
TARGET LEVEL: ${into}   (if "auto": decide by size/complexity — a single composed UI unit → atom (src/components/atom/); a full-page section/layout → template; UI+business-logic → block)

STEPS:
1. Move/rename the component to its final hierarchy location for level "${into}". Fix imports/exports. Follow this repo's existing naming + folder conventions (look at neighbors).
2. Remove the scratch preview route file (${draft.previewFile}) and any now-empty scratch folders. Do NOT leave clone-preview wired in. Then SWEEP scratch artifacts: delete any reconcile screenshots left in the repo root (clone-check*.png, shot-*.png, *-crop.png, *-iter*.png) and the ${snapshotDir}/reconcile/ dir. Run \`git status --short\` and confirm the only new file is the landed component (the .clone/ snapshot is gitignored and stays).
3. Run "pnpm build" (or "pnpm tsc --noEmit" if a full build is too slow) and confirm it passes. Fix any type errors you introduced.
4. Return finalPath, the level you chose, buildPassed, and a one-paragraph summary: where it landed, exact-value count, fonts substituted, any token equivalences worth adopting later, and any reconcile diffs left unresolved.

Do NOT delete the ${snapshotDir} snapshot — it stays as the scratch record.`,
  { label: "land", phase: "Land", model: "sonnet", effort: "low", agentType: "clone", schema: LAND_SCHEMA }
);

return {
  snapshotDir,
  component: landed?.finalPath || draft.componentPath,
  level: landed?.level || into,
  buildPassed: landed?.buildPassed ?? null,
  matched: recon?.matched ?? null,
  exactValueClasses: draft.exactValueCount,
  fontsAndTokenNotes: draft.tokenNotes || [],
  remainingDiffs: recon?.remainingDiffs || [],
  summary: landed?.summary || draft.summary,
};
