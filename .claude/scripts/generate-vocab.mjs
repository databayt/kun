#!/usr/bin/env node
// generate-vocab.mjs — single-source vocabulary generator for the kun engine.
//
// Source of truth: .claude/vocabulary.json
// Emits:
//   1. src/components/docs/spellbook-data.ts  (the docs-site spellbook — GENERATED banner)
//   2. the "Vocabulary" block in .claude/CLAUDE.md between BEGIN/END markers
//
// Usage:
//   node .claude/scripts/generate-vocab.mjs           # regenerate both outputs
//   node .claude/scripts/generate-vocab.mjs --check   # exit 1 on drift or dangling targets (health.sh runs this)
//
// Edit vocabulary.json, never the generated outputs. docs/KEYWORDS.md is
// non-normative lore; content/docs/keywords.mdx renders from spellbook-data.ts.

import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HOME = process.env.HOME || "";
const VOCAB_PATH = join(ROOT, ".claude/vocabulary.json");
const TS_PATH = join(ROOT, "src/components/docs/spellbook-data.ts");
const CLAUDE_MD_PATH = join(ROOT, ".claude/CLAUDE.md");
const BEGIN = "<!-- BEGIN vocabulary (generated) -->";
const END = "<!-- END vocabulary (generated) -->";
const CHECK = process.argv.includes("--check");

const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf8"));
const q = JSON.stringify; // string → quoted TS/JSON literal

// ── 1. spellbook-data.ts ─────────────────────────────────────────
const HELPER = { familiar: "f", portal: "p", skill: "s", hook: "h", ward: "w", memory: "m" };

function emitSpell(sp) {
  const order = sp.order.map((o) => `${HELPER[o.type]}(${q(o.name)})`).join(", ");
  return `      {
        name: ${q(sp.name)},
        effect: ${q(sp.effect)},
        order: [${order}],
        steps: [${sp.steps.map(q).join(", ")}],
        connects: [${sp.connects.map(q).join(", ")}],
        depends: [${sp.depends.map(q).join(", ")}],
      }`;
}

function emitSchool(sc) {
  const quote = sc.quote !== undefined ? `\n    quote: ${q(sc.quote)},` : "";
  return `  {
    id: ${q(sc.id)},
    number: ${q(sc.number)},
    name: ${q(sc.name)},
    subtitle: ${q(sc.subtitle)},
    description: ${q(sc.description)},${quote}
    spells: [
${sc.spells.map(emitSpell).join(",\n")},
    ],
  }`;
}

function emitWorkflow(wf) {
  const steps = wf.steps
    .map((st) => `      { keyword: ${q(st.keyword)}, action: ${q(st.action)} }`)
    .join(",\n");
  return `  {
    id: ${q(wf.id)},
    name: ${q(wf.name)},
    description: ${q(wf.description)},
    steps: [
${steps},
    ],
  }`;
}

const ts = `// GENERATED FILE — DO NOT EDIT.
// Source of truth: .claude/vocabulary.json
// Regenerate: node .claude/scripts/generate-vocab.mjs   (health.sh flags drift)

// Types
export type OrderType =
  | "familiar"
  | "portal"
  | "skill"
  | "hook"
  | "ward"
  | "memory";

export interface OrderItem {
  type: OrderType;
  name: string;
}

export interface Spell {
  name: string;
  effect: string;
  order: OrderItem[];
  steps: string[];
  connects: string[];
  depends: string[];
}

export interface School {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  description: string;
  quote?: string;
  spells: Spell[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: { keyword: string; action: string }[];
}

// Helper to reduce verbosity
const f = (name: string): OrderItem => ({ type: "familiar", name });
const p = (name: string): OrderItem => ({ type: "portal", name });
const s = (name: string): OrderItem => ({ type: "skill", name });
const h = (name: string): OrderItem => ({ type: "hook", name });
const w = (name: string): OrderItem => ({ type: "ward", name });
const m = (name: string): OrderItem => ({ type: "memory", name });

// ─── Schools ────────────────────────────────────────────────────────────────────

export const schools: School[] = [
${vocab.schools.map(emitSchool).join(",\n")},
];

// ─── Workflows ──────────────────────────────────────────────────────────────────

export const workflows: Workflow[] = [
${vocab.workflows.map(emitWorkflow).join(",\n")},
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

export const orderTypeLabels: Record<OrderType, string> = ${JSON.stringify(vocab.orderTypeLabels, null, 2).replace(/\n/g, "\n")};
`;

function prettify(path) {
  try {
    execFileSync("npx", ["prettier", "--write", path], { cwd: ROOT, stdio: "pipe" });
  } catch {
    /* prettier unavailable — raw output is still valid TS */
  }
}

// ── 2. CLAUDE.md vocabulary block ────────────────────────────────
function claudeMdBlock() {
  const lines = [BEGIN];
  lines.push(
    "Claude routes these to the right skill + agent + MCP without a dedicated command. Registry: `.claude/vocabulary.json` (edit it, then `node .claude/scripts/generate-vocab.mjs`); browsable at kun.databayt.org/en/docs/keywords."
  );
  lines.push("");
  for (const sc of vocab.schools) {
    const kws = sc.spells
      .map((sp) => (sp.mergedInto ? null : `\`${sp.name}\``))
      .filter(Boolean)
      .join(", ");
    lines.push(`**${sc.name}** — ${sc.subtitle.toLowerCase()}: ${kws}`);
  }
  lines.push(END);
  return lines.join("\n");
}

function writeClaudeMd(dryRun) {
  const md = readFileSync(CLAUDE_MD_PATH, "utf8");
  const bi = md.indexOf(BEGIN);
  const ei = md.indexOf(END);
  if (bi === -1 || ei === -1) {
    console.error(`generate-vocab: markers not found in .claude/CLAUDE.md — add ${BEGIN} … ${END}`);
    process.exit(1);
  }
  const next = md.slice(0, bi) + claudeMdBlock() + md.slice(ei + END.length);
  if (dryRun) return next === md;
  if (next !== md) writeFileSync(CLAUDE_MD_PATH, next);
  return true;
}

// ── 3. Target validation ─────────────────────────────────────────
const BUILTIN_SKILLS = new Set([
  "loop", "schedule", "goal", "code-review", "simplify", "batch", "debug",
  "claude-api", "deep-research", "run", "verify", "insights", "usage", "memory",
]);
const BUILTIN_AGENTS = new Set(["Explore", "Plan", "general-purpose", "claude"]);

function skillExists(name) {
  const n = name.replace(/^\//, "");
  return (
    BUILTIN_SKILLS.has(n) ||
    existsSync(join(ROOT, ".claude/skills", n, "SKILL.md")) ||
    existsSync(join(ROOT, ".claude/commands", `${n}.md`)) ||
    existsSync(join(HOME, ".claude/skills", n, "SKILL.md")) ||
    existsSync(join(HOME, ".claude/commands", `${n}.md`))
  );
}

function agentExists(name) {
  return (
    BUILTIN_AGENTS.has(name) ||
    existsSync(join(ROOT, ".claude/agents", `${name}.md`)) ||
    existsSync(join(HOME, ".claude/agents", `${name}.md`))
  );
}

function validateTargets() {
  const errors = [];
  const warnings = [];
  // Portals may live in the project mcp.json OR the user one (~/.claude/mcp.json
  // is authoritative for `browser` by doctrine) — merge both key sets.
  const mcpKeys = new Set();
  for (const mcpPath of [join(ROOT, ".claude/mcp.json"), join(HOME, ".claude/mcp.json")]) {
    try {
      const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
      for (const k of Object.keys(mcp.mcpServers || {})) mcpKeys.add(k.toLowerCase());
    } catch {
      /* unreadable — that file contributes nothing */
    }
  }
  for (const sc of vocab.schools) {
    for (const sp of sc.spells) {
      for (const o of sp.order) {
        const at = `${sc.id}/${sp.name}`;
        if (o.type === "skill" && !skillExists(o.name)) {
          errors.push(`${at}: skill target ${o.name} not found (checked project+user skills/commands)`);
        } else if (o.type === "familiar" && !agentExists(o.name)) {
          errors.push(`${at}: agent target ${o.name} not found`);
        } else if (o.type === "portal" && mcpKeys.size) {
          const key = o.name.toLowerCase().replace(/\s+/g, "-");
          if (![...mcpKeys].some((k) => k.includes(key) || key.includes(k))) {
            warnings.push(`${at}: portal "${o.name}" has no matching server in mcp.json`);
          }
        }
      }
    }
  }
  return { errors, warnings };
}

// ── main ─────────────────────────────────────────────────────────
if (CHECK) {
  const { errors, warnings } = validateTargets();
  const tmp = mkdtempSync(join(tmpdir(), "vocab-"));
  const tmpTs = join(tmp, "spellbook-data.ts");
  writeFileSync(tmpTs, ts);
  prettify(tmpTs);
  const tsInSync = readFileSync(tmpTs, "utf8") === readFileSync(TS_PATH, "utf8");
  const mdInSync = writeClaudeMd(true);
  if (!tsInSync) errors.push("spellbook-data.ts is out of sync — run generate-vocab.mjs");
  if (!mdInSync) errors.push("CLAUDE.md vocabulary block is out of sync — run generate-vocab.mjs");
  for (const w2 of warnings) console.warn(`warn: ${w2}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    process.exit(1);
  }
  console.log("vocabulary: in sync, all targets resolve");
} else {
  writeFileSync(TS_PATH, ts);
  prettify(TS_PATH);
  writeClaudeMd(false);
  const { errors, warnings } = validateTargets();
  for (const w2 of warnings) console.warn(`warn: ${w2}`);
  for (const e of errors) console.error(`error: ${e}`);
  const total = vocab.schools.reduce((n, s2) => n + s2.spells.length, 0);
  console.log(`generated: ${vocab.schools.length} schools, ${total} spells, ${vocab.workflows.length} workflows${errors.length ? ` — ${errors.length} dangling targets` : ""}`);
  process.exit(errors.length ? 1 : 0);
}
