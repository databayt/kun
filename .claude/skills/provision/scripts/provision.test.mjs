import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "provision.mjs");
const FIXTURE = join(HERE, "../fixtures/readiness.json");

// fake kun-ready: passes a probe when file $T/<probe>.ok exists; "win"/"skipme" skip
function setup(okProbes = []) {
  const d = mkdtempSync(join(tmpdir(), "prov-"));
  const fake = join(d, "fake-ready");
  writeFileSync(fake, `#!/bin/bash\n[ "$1" = skipme ] && { echo skipped; exit 2; }\n[ -f "${d}/$1.ok" ] && { echo "ok $1"; exit 0; }\necho "missing $1"; exit 1\n`);
  chmodSync(fake, 0o755);
  for (const p of okProbes) writeFileSync(join(d, p + ".ok"), "");
  return d;
}
function runP(d, argv, env = {}) {
  const r = spawnSync("node", [SCRIPT, "--catalog", FIXTURE, "--json", ...argv], {
    encoding: "utf8",
    env: { ...process.env, PROVISION_PROBE_CMD: join(d, "fake-ready"), PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl"), PROVISION_PLATFORM: "darwin", PROVISION_ONBOARD_CMD: "true", ...env },
  });
  const ev = r.stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { ev, done: ev.at(-1), steps: ev.filter((e) => e.type === "step"), r };
}
const st = (steps, id) => steps.filter((s) => s.id === id).map((s) => s.status);

test("filtering by os, role and departments", () => {
  const d = setup();
  let { ev } = runP(d, ["--check"]);
  assert.equal(ev[0].total, 7); // win-tool excluded on darwin
  ({ ev } = runP(d, ["--check", "--role", "member"]));
  assert.equal(ev[0].total, 6); // engine-sync is engineer-only
  ({ ev } = runP(d, ["--check", "--departments", "mkan"]));
  assert.equal(ev[0].total, 6); // hogwarts-env excluded
  ({ ev } = runP(d, ["--check", "--only", "kun-repo"]));
  assert.equal(ev[0].total, 3); // + after deps: github-login, git-identity
});

test("a failed dependency blocks its dependents", () => {
  const d = setup(["gh-auth"]); // git-identity fails, github-login passes but is after it
  const { steps } = runP(d, ["--check"]);
  assert.deepEqual(st(steps, "git-identity"), ["fail"]);
  assert.deepEqual(st(steps, "github-login"), ["blocked"]);
  assert.deepEqual(st(steps, "kun-repo"), ["blocked"]);
});

test("human steps that fail are reported as human and count as failing", () => {
  const d = setup(["git-identity"]);
  const { steps, done } = runP(d, ["--check"]);
  assert.deepEqual(st(steps, "github-login"), ["human"]);
  assert.ok(done.human.includes("github-login"));
  assert.ok(done.failing.includes("github-login"));
});

test("percent math excludes skips", () => {
  const d = setup(["git-identity", "brew", "agent-code"]);
  const { done } = runP(d, ["--check", "--only", "git-identity,homebrew,agent-code"]);
  assert.equal(done.applicable, 3);
  assert.equal(done.passed, 3);
  assert.equal(done.percent, 100);
  const d2 = setup(["git-identity"]);
  const o = runP(d2, ["--check", "--only", "git-identity,homebrew"]);
  assert.equal(o.done.percent, 50);
});

test("fix then recheck -> fixed, and the step ends up passing", () => {
  const d = setup();
  const cat = JSON.parse(readFileSync(FIXTURE, "utf8"));
  cat.steps = cat.steps.filter((s) => s.id === "git-identity");
  cat.steps[0].fix.cmd = `touch ${d}/git-identity.ok`;
  const cp = join(d, "cat.json");
  writeFileSync(cp, JSON.stringify(cat));
  const r = spawnSync("node", [SCRIPT, "--catalog", cp, "--json", "--complete"], { encoding: "utf8", env: { ...process.env, PROVISION_PROBE_CMD: join(d, "fake-ready"), PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl"), PROVISION_PLATFORM: "darwin", PROVISION_ONBOARD_CMD: "true" } });
  const ev = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  const s = ev.filter((e) => e.type === "step" && e.id === "git-identity").map((e) => e.status);
  assert.deepEqual(s, ["fail", "fixing", "fixed", "pass"]);
  assert.equal(ev.at(-1).percent, 100);
  assert.ok(existsSync(join(d, "state/readiness.json")));
  assert.match(readFileSync(join(d, "runs.jsonl"), "utf8"), /"job": ?"provision"/);
});

test("no-progress stop: a fix that does nothing is tried once, passes capped", () => {
  const d = setup();
  const cat = JSON.parse(readFileSync(FIXTURE, "utf8"));
  cat.steps = cat.steps.filter((s) => s.id === "git-identity");
  cat.steps[0].fix.cmd = "true";
  const cp = join(d, "cat.json");
  writeFileSync(cp, JSON.stringify(cat));
  const r = spawnSync("node", [SCRIPT, "--catalog", cp, "--json", "--complete"], { encoding: "utf8", env: { ...process.env, PROVISION_PROBE_CMD: join(d, "fake-ready"), PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl"), PROVISION_PLATFORM: "darwin", PROVISION_ONBOARD_CMD: "true" } });
  const ev = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(ev.filter((e) => e.status === "fixing").length, 1);
  assert.equal(ev.filter((e) => e.type === "pass").length, 2);
  assert.equal(ev.at(-1).percent, 0);
});

test("guardrail refuses forbidden fixes and terminal fixes never run", () => {
  const d = setup();
  const cat = JSON.parse(readFileSync(FIXTURE, "utf8"));
  cat.steps = cat.steps.filter((s) => ["git-identity", "kun-repo"].includes(s.id));
  cat.steps[0].fix.cmd = `sudo touch ${d}/pwned`;
  cat.steps[1].after = [];
  cat.steps[1].fix = { kind: "terminal", cmd: `touch ${d}/terminal-ran` };
  const cp = join(d, "cat.json");
  writeFileSync(cp, JSON.stringify(cat));
  const r = spawnSync("node", [SCRIPT, "--catalog", cp, "--json", "--complete"], { encoding: "utf8", env: { ...process.env, PROVISION_PROBE_CMD: join(d, "fake-ready"), PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl"), PROVISION_PLATFORM: "darwin", PROVISION_ONBOARD_CMD: "true" } });
  const ev = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  const refused = ev.find((e) => e.id === "git-identity" && /refused/.test(e.detail));
  assert.ok(refused);
  assert.ok(!existsSync(join(d, "pwned")));
  assert.ok(!existsSync(join(d, "terminal-ran")));
  const k = ev.filter((e) => e.id === "kun-repo").at(-1);
  assert.equal(k.status, "fail");
  assert.match(k.detail, /fix:terminal/);
});

test("NDJSON shape and secret redaction", () => {
  const d = setup(["git-identity"]);
  const fake = join(d, "fake-ready");
  writeFileSync(fake, `#!/bin/bash\necho "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123 leaked"\nexit 1\n`);
  const { ev, done } = runP(d, ["--check", "--only", "git-identity"]);
  assert.deepEqual(Object.keys(ev[0]), ["type", "mode", "catalogVersion", "total"]);
  assert.equal(ev[1].type, "pass");
  assert.deepEqual(Object.keys(ev.find((e) => e.type === "step")), ["type", "id", "stage", "status", "detail"]);
  assert.deepEqual(Object.keys(done), ["type", "percent", "passed", "applicable", "failing", "human"]);
  assert.ok(!JSON.stringify(ev).includes("ghp_abc"));
});

test("dry-run prints fixes without running them", () => {
  const d = setup();
  const cat = JSON.parse(readFileSync(FIXTURE, "utf8"));
  cat.steps = cat.steps.filter((s) => s.id === "git-identity");
  cat.steps[0].fix.cmd = `touch ${d}/ran`;
  const cp = join(d, "cat.json");
  writeFileSync(cp, JSON.stringify(cat));
  const r = spawnSync("node", [SCRIPT, "--catalog", cp, "--json", "--complete", "--dry-run"], { encoding: "utf8", env: { ...process.env, PROVISION_PROBE_CMD: join(d, "fake-ready"), PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl"), PROVISION_PLATFORM: "darwin", PROVISION_ONBOARD_CMD: "true" } });
  assert.match(r.stdout, /dry-run: touch/);
  assert.ok(!existsSync(join(d, "ran")));
});
