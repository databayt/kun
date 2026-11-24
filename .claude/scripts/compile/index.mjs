#!/usr/bin/env node
// kun compile — turn the kun source into each coding agent's native configuration.
//
//   node index.mjs --all                  compile every agent (hermes stays a dry-run)
//   node index.mjs --only codex,opencode  just those agents   (claude fcc codex opencode agy hermes)
//   node index.mjs --check [--all|--only] write nothing; list drift; exit 1 when anything drifted
//   node index.mjs --dry-run              print the planned writes, write nothing
//   node index.mjs --quiet                one line per agent (errors and drift still print)
//   node index.mjs --only hermes --write  let hermes really write (default is dry-run)
//   --from-setup                          called by setup.sh: claude does only its pointer block (setup is the installer)
//
// Idempotent: a second run changes nothing. Source of truth: .claude/targets.json + the kun source tree.
import { makeCtx, apply } from "./lib.mjs";

export const AGENTS = ["claude", "fcc", "codex", "opencode", "agy", "hermes"];

export async function run(argv, { ctxOver = {}, out = console.log } = {}) {
  const has = (f) => argv.includes(f);
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? (argv[onlyIdx + 1] || "").split(",").filter(Boolean) : null;
  if (!has("--all") && !only) { out("usage: kun compile --all | --only <agent>[,<agent>]  [--check] [--dry-run] [--quiet] [--write]\nagents: " + AGENTS.join(" ")); return 2; }
  const names = has("--all") ? AGENTS : only;
  const bad = names.filter((n) => !AGENTS.includes(n));
  if (bad.length) { out(`unknown agent: ${bad.join(", ")} (known: ${AGENTS.join(", ")})`); return 2; }
  let anyDrift = false;
  process.env.KUN_COMPILE_ACTIVE = "1";
  for (const name of names) {
    // hermes is dry-run unless asked, and never in --all
    const hermesDry = name === "hermes" && !(has("--write") && only?.includes("hermes"));
    const ctx = makeCtx({ check: has("--check"), dryRun: has("--dry-run") || (hermesDry && !has("--check")), quiet: has("--quiet"), write: has("--write"), ...ctxOver });
    let res;
    try {
      const mod = await import(`./${name}.mjs`);
      res = apply(ctx, mod.plan(ctx, { fromSetup: has("--from-setup") }));
    } catch (e) { out(`${name.padEnd(9)} ERROR ${e.message}`); anyDrift = true; continue; }
    const d = res.drift;
    const mode = ctx.check ? "check" : ctx.dryRun ? (hermesDry && !has("--dry-run") ? "dry-run (hermes default)" : "dry-run") : "write";
    if (d.length) anyDrift = true;
    const verb = ctx.check ? "drift" : ctx.dryRun ? "would change" : "changed";
    out(`${name.padEnd(9)} ${d.length ? `${verb}: ${d.length}` : "ok"} of ${res.results.length}  [${mode}]`);
    if (d.length && !(ctx.quiet && !ctx.check && !ctx.dryRun)) for (const r of d.slice(0, 25)) out(`    ${r.status.padEnd(6)} ${r.path}${r.why ? ` — ${r.why}` : ""}${r.backup ? `  (backup ${r.backup})` : ""}${r.ran && r.ran !== "ok" ? `  [${r.ran}]` : ""}`);
    if (d.length > 25) out(`    … ${d.length - 25} more`);
    if (!ctx.quiet) for (const n of res.notices) out(`    note: ${n}`);
  }
  return ctxOver.check || has("--check") ? (anyDrift ? 1 : 0) : 0;
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) run(process.argv.slice(2)).then((c) => process.exit(c));
