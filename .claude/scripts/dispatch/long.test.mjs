import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { parseBrief, buildBody } from "./lib.mjs";
import { stableNode } from "./install.mjs";
import { pass, longHandoff } from "./runner.mjs";
import { parseSteps, appendSteps, tickStep, parsePlan, stepVerdict, fileLong, runIssue, runLong, makeBus, files } from "./long.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "long-"));
const noSleep = async () => {};

// A fake GitHub with issues, labels, comments, events.
function fakeGh(init = {}, { failComments = 0 } = {}) {
  const st = { issues: {}, t: 0, failComments, calls: [] };
  st.issues[5] = { number: 5, title: "long: t", state: "OPEN", body: "make files\n\n```yaml\nrepo: " + os.tmpdir() + "\nhours: 8\nstep_timeout_min: 1\nsteps_max: 5\n```\n", labels: ["dispatch", "long", "to:fcc", "machine:abdout"], comments: [], events: [], ...init };
  const gh = (args, { input } = {}) => {
    st.calls.push(args.join(" "));
    const j = args.join(" ");
    const num = Number(args[2]);
    const I = st.issues[num];
    if (j.startsWith("api user")) return "abdout";
    if (j.startsWith("label create")) return "";
    if (j.startsWith("issue view")) return JSON.stringify({ ...I, labels: I.labels.map((name) => ({ name })) });
    if (j.startsWith("issue list")) return JSON.stringify(Object.values(st.issues).filter((i) => i.state === "OPEN" && i.labels.includes("long")).map((i) => ({ ...i, labels: i.labels.map((name) => ({ name })), comments: i.comments.map((body) => ({ body, createdAt: "2026-01-01T00:00:00Z" })) })));
    if (j.startsWith("issue edit")) {
      if (args.includes("--body-file")) I.body = input;
      if (args.includes("--add-label")) { const l = args[args.indexOf("--add-label") + 1]; if (!I.labels.includes(l)) I.labels.push(l); if (l.startsWith("claimed:")) I.events.push({ id: ++st.t, event: "labeled", label: { name: l }, created_at: new Date(1e12 + st.t * 1000).toISOString() }); }
      if (args.includes("--remove-label")) { const l = args[args.indexOf("--remove-label") + 1]; I.labels = I.labels.filter((x) => x !== l); }
      return "";
    }
    if (j.startsWith("api repos")) return JSON.stringify(I?.events || st.issues[5].events);
    if (j.startsWith("issue comment")) { if (st.failComments > 0) { st.failComments--; throw new Error("network down"); } I.comments.push(input); return ""; }
    if (j.startsWith("issue close")) { I.state = "CLOSED"; return ""; }
    if (j.startsWith("issue create")) return "https://github.com/" + args[args.indexOf("--repo") + 1] + "/issues/9\n";
    throw new Error("unmocked gh " + j);
  };
  return { gh, st };
}

const baseCtx = (gh, dir, exec, extra = {}) => ({ rawGh: gh, exec, sleep: noSleep, host: "h1", me: "abdout", engine: { dispatch: { private_repo: "databayt/ops" } }, stateDir: dir, power: () => "AC", proc: new EventEmitter(), ...extra });

test("stableNode never returns a Cellar path", () => {
  assert.equal(stableNode({ candidates: ["/opt/homebrew/bin/node"], ok: () => true, execPath: "/x/node" }), "/opt/homebrew/bin/node");
  assert.equal(stableNode({ candidates: ["/a/Cellar/node@24/1/bin/node", "/usr/local/bin/node"], ok: (p) => true, execPath: "/x/node" }), "/usr/local/bin/node");
  assert.equal(stableNode({ candidates: ["/nope"], ok: () => false, execPath: "/x/node" }), "/x/node");
});

test("brief carries long keys; steps parse, append and tick by text", () => {
  const body = buildBody("goal", { repo: "kun", hours: 8, step_timeout_min: 30, steps_max: 15 });
  assert.deepEqual(parseBrief(body).cfg, { repo: "kun", hours: 8, step_timeout_min: 30, steps_max: 15 });
  const b2 = appendSteps(body, ["a", "b"]);
  assert.deepEqual(parseSteps(b2).steps, [{ done: false, text: "a" }, { done: false, text: "b" }]);
  const b3 = tickStep(b2, "b");
  assert.deepEqual(parseSteps(b3).steps.map((s) => s.done), [false, true]);
  assert.equal(tickStep(b3, "zzz"), null);
  assert.equal(parseSteps(appendSteps(b2, ["c"])).steps.length, 1, "re-appending replaces the section");
  assert.deepEqual(parsePlan("blah\n- [ ] one\n- [ ] two\n- [ ] three", 2), ["one", "two"]);
  assert.deepEqual(stepVerdict("x\nSTEP: failed — no disk\n"), { status: "failed", reason: "no disk" });
  assert.equal(stepVerdict("hi"), null);
});

test("fileLong: labels, private repo rules", () => {
  const calls = [];
  const gh = (a) => (calls.push(a), a[0] === "api" ? "abdout" : "https://github.com/databayt/kun/issues/12\n");
  const r = fileLong(["do it", "--repo", "kun", "--hours", "2", "--queue"], { gh, engine: {} });
  assert.equal(r.number, 12); assert.equal(r.queue, true);
  const create = calls.find((a) => a[0] === "issue" && a[1] === "create");
  assert.ok(["dispatch", "long", "to:fcc", "machine:abdout"].every((l) => create.includes(l)));
  assert.match(create[create.indexOf("--body") + 1], /hours: 2/);
  assert.throws(() => fileLong(["x", "--private"], { gh, engine: { dispatch: { private_repo: null } } }), /set engine\.json dispatch\.private_repo/);
  assert.throws(() => fileLong(["x", "--private", "--to", "fcc"], { gh, engine: { dispatch: { private_repo: "databayt/ops" } } }), /only on claude/);
  calls.length = 0;
  fileLong(["x", "--private"], { gh, engine: { dispatch: { private_repo: "databayt/ops" } } });
  const c2 = calls.find((a) => a[0] === "issue" && a[1] === "create");
  assert.equal(c2[c2.indexOf("--repo") + 1], "databayt/ops");
  assert.ok(c2.includes("data:private") && c2.includes("to:claude"));
});

test("full loop: plan, steps, ticks, summary, done and closed", async () => {
  const { gh, st } = fakeGh();
  const dir = tmp();
  const specs = [];
  let t = 1e12;
  const exec = async (spec) => {
    specs.push(spec);
    t += 5000;
    if (specs.length === 1) return { code: 0, output: "## Steps\n- [ ] make a\n- [ ] make b", timedOut: false };
    return { code: 0, output: `did it\nSTEP: done`, timedOut: false };
  };
  const res = await runIssue(5, "databayt/kun", { ...baseCtx(gh, dir, exec), now: () => t });
  assert.equal(res.state, "done");
  const I = st.issues[5];
  assert.equal(I.state, "CLOSED");
  assert.ok(I.labels.includes("done") && I.labels.includes("claimed:h1"));
  assert.deepEqual(parseSteps(I.body).steps.map((s) => s.done), [true, true]);
  const kinds = I.comments.map((c) => c.match(/\*\*(long [a-z]+)/)?.[1]);
  assert.deepEqual(kinds, ["long started", "long plan", "long step", "long step", "long done"]);
  assert.match(I.comments[0], /deadline/);
  assert.equal(specs[0].env.KUN_FREE_ROUTE, "pool");
  assert.equal(specs[0].env.KUN_FREE_COMBO, "long");
  assert.match(specs[1].args[1], /You are on step 1 of 2: make a/);
  assert.match(specs[0].args[1], /Change no files/);
  assert.ok(fs.readFileSync(files(5, dir).journal, "utf8").includes("long started"));
});

test("a failed step retries once, a second failure stops with failed", async () => {
  const { gh, st } = fakeGh({ body: "g\n\n## Steps\n\n- [ ] only\n" });
  let calls = 0;
  const res = await runIssue(5, "databayt/kun", baseCtx(gh, tmp(), async () => (calls++, { code: 0, output: "STEP: failed — nope", timedOut: false })));
  assert.equal(res.state, "failed");
  assert.equal(calls, 2);
  assert.ok(st.issues[5].labels.includes("failed") && st.issues[5].state === "OPEN");
  assert.ok(st.issues[5].comments.some((c) => /step 1\/1 failed \(attempt 2\)/.test(c)));
});

test("exit 0 without a STEP line passes with a note; timeout is a failure", async () => {
  const { gh, st } = fakeGh({ body: "g\n\n## Steps\n\n- [ ] one\n" });
  const res = await runIssue(5, "databayt/kun", baseCtx(gh, tmp(), async () => ({ code: 0, output: "ok", timedOut: false })));
  assert.equal(res.state, "done");
  assert.ok(st.issues[5].comments.some((c) => /no STEP line/.test(c)));
  const f2 = fakeGh({ body: "g\n\n## Steps\n\n- [ ] one\n" });
  const r2 = await runIssue(5, "databayt/kun", baseCtx(f2.gh, tmp(), async () => ({ code: 124, output: "", timedOut: true })));
  assert.equal(r2.state, "failed");
});

test("stop file pauses after the current step; deadline pauses", async () => {
  const { gh, st } = fakeGh({ body: "g\n\n## Steps\n\n- [ ] a\n- [ ] b\n" });
  const dir = tmp();
  const res = await runIssue(5, "databayt/kun", baseCtx(gh, dir, async () => { fs.writeFileSync(files(5, dir).stop, "x"); return { code: 0, output: "STEP: done", timedOut: false }; }));
  assert.equal(res.state, "paused");
  assert.ok(st.issues[5].labels.includes("paused"));
  assert.deepEqual(parseSteps(st.issues[5].body).steps.map((s) => s.done), [true, false]);
  assert.ok(st.issues[5].comments.some((c) => /paused by person at step 2\/2/.test(c)));
  // resume on the same host continues; deadline
  let t = 1e12;
  const r2 = await runIssue(5, "databayt/kun", { ...baseCtx(gh, dir, async () => { t += 9 * 3600_000; return { code: 0, output: "STEP: done", timedOut: false }; }), now: () => t });
  assert.equal(r2.state, "done", "the last step finished before the deadline check");
  const f3 = fakeGh({ body: "g\n\n```yaml\nhours: 1\n```\n\n## Steps\n\n- [ ] a\n- [ ] b\n" });
  let t3 = 1e12;
  const r3 = await runIssue(5, "databayt/kun", { ...baseCtx(f3.gh, tmp(), async () => { t3 += 2 * 3600_000; return { code: 0, output: "STEP: done", timedOut: false }; }), now: () => t3 });
  assert.equal(r3.state, "paused");
  assert.ok(f3.st.issues[5].comments.some((c) => /deadline/.test(c)));
});

test("data rule: private needs claude and the private repo", async () => {
  let f = fakeGh({ labels: ["dispatch", "long", "to:fcc", "data:private"] });
  let ran = false;
  let r = await runIssue(5, "databayt/ops", baseCtx(f.gh, tmp(), async () => (ran = true, {})));
  assert.equal(r.state, "failed"); assert.equal(ran, false);
  assert.match(f.st.issues[5].comments[0], /never goes to a free agent/);
  f = fakeGh({ labels: ["dispatch", "long", "to:claude", "data:private"] });
  r = await runIssue(5, "databayt/kun", baseCtx(f.gh, tmp(), async () => ({})));
  assert.equal(r.state, "failed");
  assert.match(f.st.issues[5].comments[0], /private repo/);
  f = fakeGh({ labels: ["dispatch", "long", "to:claude", "lane:escalate"] });
  r = await runIssue(5, "databayt/kun", baseCtx(f.gh, tmp(), async () => ({})));
  assert.match(f.st.issues[5].comments[0], /attended-only/);
});

test("comments survive a network drop: backlog posted late", async () => {
  const { gh, st } = fakeGh({ body: "g\n\n## Steps\n\n- [ ] one\n" }, { failComments: 12 });
  const res = await runIssue(5, "databayt/kun", baseCtx(gh, tmp(), async () => ({ code: 0, output: "STEP: done", timedOut: false })));
  assert.equal(res.state, "done");
  const all = st.issues[5].comments.join("\n");
  assert.match(all, /posted late/);
  assert.match(all, /long started/);
  assert.match(all, /long done/);
});

test("makeBus retries gh and journals", async () => {
  let n = 0;
  const dir = tmp();
  const bus = makeBus((a) => { if (++n < 3) throw new Error("x"); return "ok"; }, { n: 1, repo: "r", stateDir: dir, sleep: noSleep });
  assert.equal(await bus.gh(["a"]), "ok");
  assert.equal(n, 3);
});

test("SIGTERM comments, pauses and releases", async () => {
  const { gh, st } = fakeGh({ body: "g\n\n## Steps\n\n- [ ] one\n" });
  const proc = new EventEmitter(); let exited;
  proc.exit = (c) => { exited = c; };
  const dir = tmp();
  await runIssue(5, "databayt/kun", baseCtx(gh, dir, async () => { proc.emit("SIGTERM", "SIGTERM"); await new Promise((r) => setTimeout(r, 20)); return { code: 0, output: "STEP: done", timedOut: false }; }, { proc }));
  assert.equal(exited, 143);
  assert.ok(st.issues[5].comments.some((c) => /interrupted/.test(c) && /step 1\/1/.test(c)));
  assert.ok(st.issues[5].labels.includes("paused"));
});

test("runLong drains the next long issue", async () => {
  const { gh, st } = fakeGh({ body: "g\n\n## Steps\n\n- [ ] one\n" });
  st.issues[6] = { ...st.issues[5], number: 6, labels: ["dispatch", "long", "to:fcc"], events: [], comments: [], body: "h\n\n## Steps\n\n- [ ] two\n" };
  st.issues[6].events = [];
  const gh2 = (a, o) => { const r = gh(a, o); return r; };
  const res = await runLong(5, { ...baseCtx(gh2, tmp(), async () => ({ code: 0, output: "STEP: done", timedOut: false })), installed: ["fcc"], engine: {}, repo: "databayt/kun" });
  assert.deepEqual(res.map((r) => [r.n, r.state]), [[5, "done"], [6, "done"]]);
});

test("runner hands a long issue to the long loop, not runTask", async () => {
  const { gh } = fakeGh();
  const spawned = [];
  const dir = tmp();
  const res = await pass({ gh, installed: ["fcc"], stateDir: dir, repos: ["databayt/kun"], log() {}, spawnLong: (i) => spawned.push(i.number), exec: async () => { throw new Error("runTask must not run"); } });
  assert.deepEqual(spawned, [5]);
  assert.equal(res[0].long, true);
  // lock held by a live pid: no second spawn
  fs.writeFileSync(path.join(dir, "long.lock"), String(process.pid));
  spawned.length = 0;
  await pass({ gh, installed: ["fcc"], stateDir: dir, repos: ["databayt/kun"], log() {}, spawnLong: (i) => spawned.push(i.number) });
  assert.deepEqual(spawned, []);
  // paused / other machine / claimed elsewhere are not ours
  const ctx = { me: "abdout", host: "h1", installed: ["fcc"], busy: new Set(), stateDir: tmp(), spawnLong: (i) => spawned.push(i.number) };
  for (const labels of [["dispatch", "long", "paused"], ["dispatch", "long", "machine:ali"], ["dispatch", "long", "claimed:other"]]) assert.equal(longHandoff({ number: 1, labels: labels.map((name) => ({ name })) }, ctx), null);
  assert.equal(longHandoff({ number: 1, labels: ["dispatch", "long", "claimed:h1"].map((name) => ({ name })) }, ctx), true, "own claim, dead loop: resume");
});

test("a verb with no number is a usage error, never a new issue", async () => {
  const calls = [];
  await assert.rejects(() => (async () => { const { cli } = await import("./long.mjs"); return cli(["stop"], { gh: (a) => (calls.push(a), ""), out() {} }); })(), /usage/);
  assert.equal(calls.length, 0);
});
