// hermes — chat gateway (~/.hermes). Compiles ONLY the non-secret parts: SOUL.md (from .claude/hermes/SOUL.md
// + org-memory pointer) and cron jobs (.claude/hermes/jobs.json, merged by job name into cron/jobs.json).
// config.yaml, auth.json, channels, platform tokens are never read for writing. Index runs hermes as a
// dry-run unless `--only hermes --write`.
import { join } from "node:path";
import { MEMORY_POINTER, Plan, read, readManifest, target } from "./lib.mjs";

export const transforms = { "soul-md": 1, "cron-jobs-merge": 1 };

export function mergeJobs(cur, ours, prevNames = []) {
  const jobs = Array.isArray(cur?.jobs) ? [...cur.jobs] : [];
  const names = new Set(ours.map((j) => j.name));
  const kept = jobs.filter((j) => !(prevNames.includes(j.name) && !names.has(j.name)));
  for (const j of ours) {
    const i = kept.findIndex((x) => x.name === j.name);
    if (i >= 0) kept[i] = { ...kept[i], ...j }; else kept.push(j);
  }
  return { ...(cur || {}), jobs: kept };
}

export function plan(ctx) {
  const p = new Plan("hermes");
  const soul = read(join(ctx.kun, ".claude/hermes/SOUL.md"));
  if (soul) p.file(target(ctx, "hermes", "soul").path, `${soul.replace(/\s+$/, "")}\n\n${MEMORY_POINTER}\n`);
  else p.notice("hermes: .claude/hermes/SOUL.md does not exist yet — SOUL.md skipped");
  const jobsSrc = read(join(ctx.kun, ".claude/hermes/jobs.json"));
  if (jobsSrc) {
    const parsed = JSON.parse(jobsSrc);
    const ours = Array.isArray(parsed) ? parsed : parsed.jobs || [];
    const path = target(ctx, "hermes", "cron").path;
    let cur = { jobs: [] };
    try { cur = JSON.parse(read(path) || '{"jobs":[]}'); } catch { p.notice("hermes cron/jobs.json unreadable — left alone"); return p; }
    const merged = mergeJobs(cur, ours, readManifest(ctx, "hermes").meta?.jobs || []);
    p.file(path, JSON.stringify(merged, null, 2) + "\n");
    p.meta = { jobs: ours.map((j) => j.name) };
  } else p.notice("hermes: .claude/hermes/jobs.json absent — cron untouched");
  p.notice("hermes: config.yaml (mcp/skills keys) is not written — it also holds credentials and channels; edit by hand");
  p.skipPrune = true;
  return p;
}
