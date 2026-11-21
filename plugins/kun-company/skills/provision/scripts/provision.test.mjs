import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { forbidden } from "./provision.mjs";

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

// ── uninstall + opt-out ───────────────────────────────────────
// a temp catalog from the fixture: keep `ids`, then let `mutate` edit the kept steps
function runCat(d, ids, mutate, argv, env = {}) {
  const cat = JSON.parse(readFileSync(FIXTURE, "utf8"));
  cat.steps = cat.steps.filter((s) => ids.includes(s.id));
  mutate?.(Object.fromEntries(cat.steps.map((s) => [s.id, s])));
  const cp = join(d, "cat.json");
  writeFileSync(cp, JSON.stringify(cat));
  const r = spawnSync("node", [SCRIPT, "--catalog", cp, "--json", ...argv], {
    encoding: "utf8",
    env: { ...process.env, PROVISION_PROBE_CMD: join(d, "fake-ready"), PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl"), PROVISION_PLATFORM: "darwin", PROVISION_ONBOARD_CMD: "true", ...env },
  });
  const ev = r.stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { ev, done: ev.at(-1), steps: ev.filter((e) => e.type === "step"), r };
}
const optoutOf = (d) => { try { return JSON.parse(readFileSync(join(d, "state/readiness-optout.json"), "utf8")).removed; } catch { return null; } };

test("--uninstall without --only is a usage error (exit 2)", () => {
  const d = setup();
  const r = spawnSync("node", [SCRIPT, "--catalog", FIXTURE, "--uninstall"], { encoding: "utf8", env: { ...process.env, PROVISION_STATE_DIR: join(d, "state"), RUNS_LEDGER: join(d, "runs.jsonl") } });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /--only/);
});

test("uninstall --dry-run emits removing, runs nothing, records nothing", () => {
  const d = setup(["git-identity"]);
  const { steps, done, r } = runCat(d, ["git-identity"], (c) => { c["git-identity"].uninstall.cmd = `touch ${d}/ran`; }, ["--uninstall", "--only", "git-identity", "--dry-run"]);
  assert.equal(r.status, 0);
  assert.deepEqual(st(steps, "git-identity").slice(0, 1), ["removing"]);
  assert.match(steps[0].detail, /^dry-run: touch/);
  assert.equal(done.type, "done");
  assert.ok(!existsSync(join(d, "ran")));
  assert.ok(!existsSync(join(d, "state/readiness.json")));
  assert.equal(optoutOf(d), null);
});

test("a step that no uninstaller covers fails with 'no uninstaller'", () => {
  const d = setup(["gh-auth"]);
  const { steps } = runCat(d, ["git-identity", "github-login"], null, ["--uninstall", "--only", "github-login"]);
  const s = steps.find((e) => e.id === "github-login" && e.status === "fail" && e.detail === "no uninstaller");
  assert.ok(s);
});

test("an installed dependent blocks the uninstall", () => {
  const d = setup(["git-identity", "gh-auth"]);
  const { steps } = runCat(d, ["git-identity", "github-login"], (c) => { c["git-identity"].uninstall.cmd = `touch ${d}/ran`; }, ["--uninstall", "--only", "git-identity"]);
  const b = steps.find((e) => e.id === "git-identity" && e.status === "blocked");
  assert.ok(b);
  assert.equal(b.detail, "needed by: github-login");
  assert.ok(!existsSync(join(d, "ran")));
  assert.equal(optoutOf(d), null);
});

test("dependents inside the target set go first, then their dependency", () => {
  const d = setup(["git-identity", "gh-auth"]);
  const { steps } = runCat(d, ["git-identity", "github-login"], (c) => {
    c["git-identity"].uninstall.cmd = "true";
    c["github-login"].uninstall = { kind: "auto", cmd: "true" };
  }, ["--uninstall", "--only", "git-identity,github-login"]);
  const removed = steps.filter((e) => e.status === "removed").map((e) => e.id);
  assert.deepEqual(removed, ["github-login", "git-identity"]);
});

test("a keystone is handed off as human and never executed", () => {
  const d = setup(["brew"]);
  const { steps } = runCat(d, ["homebrew"], (c) => { c.homebrew.uninstall.cmd = `touch ${d}/keystone-ran`; }, ["--uninstall", "--only", "homebrew"]);
  const h = steps.find((e) => e.id === "homebrew" && e.status === "human" && e.detail.startsWith("touch "));
  assert.ok(h);
  assert.ok(!existsSync(join(d, "keystone-ran")));
  assert.ok("homebrew" in optoutOf(d));
});

test("a forbidden uninstall command is refused", () => {
  const d = setup(["git-identity"]);
  const { steps } = runCat(d, ["git-identity"], (c) => { c["git-identity"].uninstall.cmd = `sudo touch ${d}/pwned`; }, ["--uninstall", "--only", "git-identity"]);
  assert.ok(steps.some((e) => e.status === "fail" && /^refused: uninstall matches guardrail/.test(e.detail)));
  assert.ok(!existsSync(join(d, "pwned")));
  assert.equal(optoutOf(d), null);
});

test("a successful uninstall writes the opt-out; --check then skips it without moving the percent", () => {
  const d = setup(["git-identity", "brew"]);
  const mutate = (c) => { c["git-identity"].uninstall.cmd = `rm -f ${d}/git-identity.ok`; };
  const un = runCat(d, ["git-identity", "homebrew"], mutate, ["--uninstall", "--only", "git-identity"]);
  assert.deepEqual(un.steps.filter((e) => e.id === "git-identity").map((e) => e.status).slice(0, 2), ["removing", "removed"]);
  assert.ok("git-identity" in optoutOf(d));
  const state = JSON.parse(readFileSync(join(d, "state/readiness.json"), "utf8"));
  assert.deepEqual(state.removed, ["git-identity"]);
  assert.match(readFileSync(join(d, "runs.jsonl"), "utf8"), /"summary":"uninstall:/);
  const ck = runCat(d, ["git-identity", "homebrew"], mutate, ["--check"]);
  const gi = ck.steps.find((e) => e.id === "git-identity");
  assert.equal(gi.status, "skip");
  assert.equal(gi.detail, "removed by you");
  assert.equal(ck.done.applicable, 1);
  assert.equal(ck.done.percent, 100);
  assert.ok(!ck.done.failing.includes("git-identity"));
});

test("--complete leaves an opted-out step alone; --complete --only <id> reinstalls it", () => {
  const d = setup(["brew"]);
  const mutate = (c) => { c["git-identity"].fix.cmd = `touch ${d}/git-identity.ok`; };
  mkdirSync(join(d, "state"), { recursive: true });
  writeFileSync(join(d, "state/readiness-optout.json"), JSON.stringify({ removed: { "git-identity": new Date().toISOString() } }));
  const plain = runCat(d, ["git-identity", "homebrew"], mutate, ["--complete"]);
  assert.ok(!plain.steps.some((e) => e.id === "git-identity" && e.status === "fixing"));
  assert.ok(!existsSync(join(d, "git-identity.ok")));
  assert.ok("git-identity" in optoutOf(d));
  const again = runCat(d, ["git-identity", "homebrew"], mutate, ["--complete", "--only", "git-identity"]);
  assert.ok(again.steps.some((e) => e.id === "git-identity" && e.status === "fixed"));
  assert.ok(existsSync(join(d, "git-identity.ok")));
  assert.deepEqual(optoutOf(d), {});
});

test("an opt-out whose thing is back after 30 minutes is dropped; a fresh one reads 'removal in progress'", () => {
  const d = setup(["git-identity"]);
  mkdirSync(join(d, "state"), { recursive: true });
  const old = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  writeFileSync(join(d, "state/readiness-optout.json"), JSON.stringify({ removed: { "git-identity": old } }));
  let ck = runCat(d, ["git-identity"], null, ["--check"]);
  assert.equal(ck.steps[0].status, "pass");
  assert.deepEqual(optoutOf(d), {});
  writeFileSync(join(d, "state/readiness-optout.json"), JSON.stringify({ removed: { "git-identity": new Date().toISOString() } }));
  ck = runCat(d, ["git-identity"], null, ["--check"]);
  assert.equal(ck.steps[0].status, "skip");
  assert.equal(ck.steps[0].detail, "removal in progress");
});

// ── the real catalog ──────────────────────────────────────────
test("catalog v2: every uninstall is well formed, auto ones pass the guardrail, keystones are terminal", () => {
  const cat = JSON.parse(readFileSync(join(HERE, "../../../machine/readiness.json"), "utf8"));
  assert.equal(cat.version, 2);
  let n = 0;
  for (const s of cat.steps) {
    if (!s.uninstall) continue;
    n++;
    assert.ok(["auto", "terminal"].includes(s.uninstall.kind), `${s.id}: kind`);
    assert.ok(typeof s.uninstall.cmd === "string" && s.uninstall.cmd.trim(), `${s.id}: cmd`);
    if (s.uninstall.kind === "auto") {
      assert.equal(forbidden(s.uninstall.cmd), null, `${s.id}: auto uninstall hits the guardrail`);
      assert.ok(!/rm\s+-[a-z]*r/.test(s.uninstall.cmd), `${s.id}: auto uninstall must not rm -r`);
      assert.ok(!s.uninstall.keystone, `${s.id}: keystone must be terminal`);
    }
    if (s.uninstall.keystone) assert.equal(s.uninstall.kind, "terminal", `${s.id}: keystone kind`);
  }
  assert.ok(n > 30);
  for (const id of ["brew", "node", "repo.kun", "claude.cli"]) {
    const u = cat.steps.find((s) => s.id === id).uninstall;
    assert.equal(u.kind, "terminal", id);
    assert.equal(u.keystone, true, id);
  }
  assert.ok(!cat.steps.find((s) => s.id === "repos.dir").uninstall);
  const keystones = cat.steps.filter((s) => s.uninstall?.keystone).map((s) => s.id).sort();
  assert.deepEqual(keystones, ["brew", "claude.cli", "node", "repo.kun"]);
});

test("an --only run folds into the last full picture instead of replacing it", () => {
  const d = setup(["git-identity"]); // the rest fail
  const full = runP(d, ["--check"]);
  const part = runP(d, ["--check", "--only", "git-identity"]);
  assert.equal(part.ev[0].total, 1);
  assert.equal(part.done.applicable, full.done.applicable);
  assert.equal(part.done.percent, full.done.percent);
  assert.deepEqual(part.done.failing, full.done.failing);
  const state = JSON.parse(readFileSync(join(d, "state", "readiness.json"), "utf8"));
  assert.equal(state.steps.length, full.steps.length);
});
