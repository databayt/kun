#!/usr/bin/env node
// kun dispatch "<brief>" --to codex [--machine x] [--repo hogwarts] [--lane build] [--cwd dir] [--timeout 30] [--model m]
import { realGh, REPO, ensureLabels, buildBody, billingGuard } from "./lib.mjs";

export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); o[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; } else o._.push(a);
  }
  return o;
}

export function send(argv, gh = realGh) {
  const o = parseArgs(argv);
  const brief = o._.join(" ").trim();
  if (!brief) throw new Error('usage: kun dispatch "<brief>" --to <claude|codex|opencode|agy|hermes|fcc|any> [--machine <login>] [--repo r] [--lane l] [--timeout min] [--model m]');
  const to = o.to || "any";
  const bad = billingGuard({ model: o.model, lane: o.lane });
  if (bad) throw new Error(bad);
  const labels = ["dispatch", `to:${to}`];
  if (o.machine) labels.push(`machine:${o.machine}`);
  if (o.lane) labels.push(`lane:${o.lane}`);
  ensureLabels(gh, labels.slice(1).map((n) => [n, "1d76db", "dispatch routing"]));
  const title = `dispatch(${to}): ${brief.split("\n")[0].slice(0, 70)}`;
  const body = buildBody(brief, { repo: o.repo, cwd: o.cwd, timeout_min: o.timeout, model: o.model });
  return gh(["issue", "create", "--repo", REPO, "--title", title, "--body", body, ...labels.flatMap((l) => ["--label", l])]).trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { console.log(send(process.argv.slice(2))); } catch (e) { console.error(e.message); process.exit(1); }
}
