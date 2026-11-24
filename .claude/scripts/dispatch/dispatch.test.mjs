import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { matchIssue, billingGuard, formatComment, claim, parseBrief, buildBody, takeLock } from "./lib.mjs";
import { runTask, pass } from "./runner.mjs";
import { send } from "./send.mjs";

const L = (...n) => n.map((name) => ({ name }));

test("brief yaml block parses", () => {
  const { brief, cfg } = parseBrief("do it\n\n```yaml\nrepo: hogwarts\ntimeout_min: 5\nmodel: sonnet\n```\n");
  assert.equal(brief, "do it");
  assert.deepEqual(cfg, { repo: "hogwarts", timeout_min: 5, model: "sonnet" });
  assert.match(buildBody("x", { repo: "r" }), /repo: r/);
});

test("label filtering by machine and agent", () => {
  const inst = ["claude", "codex"];
  const ctx = { login: "abdout", installed: inst };
  assert.deepEqual(matchIssue({ labels: L("dispatch", "to:codex") }, ctx), { agent: "codex" });
  assert.equal(matchIssue({ labels: L("dispatch", "to:agy") }, ctx), null, "agent not installed");
  assert.equal(matchIssue({ labels: L("dispatch", "to:codex", "machine:ali") }, ctx), null, "other machine");
  assert.ok(matchIssue({ labels: L("dispatch", "to:codex", "machine:abdout") }, ctx));
  assert.equal(matchIssue({ labels: L("dispatch", "to:codex", "claimed:mac2") }, ctx), null);
  assert.equal(matchIssue({ labels: L("dispatch", "to:codex", "done") }, ctx), null);
  assert.equal(matchIssue({ labels: L("to:codex") }, ctx), null, "no dispatch label");
  assert.deepEqual(matchIssue({ labels: L("dispatch", "to:any") }, ctx), { agent: "claude" });
  assert.deepEqual(matchIssue({ labels: L("dispatch", "to:any") }, { ...ctx, busy: new Set(["claude"]) }), { agent: "codex" });
  assert.equal(matchIssue({ labels: L("dispatch", "to:codex") }, { ...ctx, busy: new Set(["codex"]) }), null, "1 concurrent per agent");
});

test("billing guard refuses fable and escalate", () => {
  assert.match(billingGuard({ model: "fable" }), /refused/);
  assert.match(billingGuard({ model: "claude-fable-5" }), /refused/);
  assert.match(billingGuard({ lane: "escalate" }), /refused/);
  assert.equal(billingGuard({ model: "sonnet", lane: "build" }), null);
});

test("send rejects fable and builds labels", () => {
  assert.throws(() => send(["x", "--to", "claude", "--model", "fable"], () => ""), /refused/);
  const calls = [];
  const url = send(["hello", "--to", "codex", "--machine", "abdout", "--lane", "build"], (a) => (calls.push(a), "https://github.com/databayt/kun/issues/1\n"));
  assert.equal(url, "https://github.com/databayt/kun/issues/1");
  const create = calls.find((a) => a[0] === "issue" && a[1] === "create").join(" ");
  assert.match(create, /--label dispatch --label to:codex --label machine:abdout --label lane:build/);
});

// A fake GitHub: one issue, label events with timestamps.
function fakeGh(login = "abdout") {
  const state = { labels: ["dispatch", "to:codex"], events: [], comments: [], closed: false, t: 0 };
  const gh = (args, { input } = {}) => {
    const j = args.join(" ");
    if (j.startsWith("api user")) return login;
    if (j.startsWith("issue list")) return JSON.stringify([{ number: 7, title: "t", body: "go\n```yaml\ncwd: " + os.tmpdir() + "\n```", labels: state.labels.filter((l) => !l.startsWith("claimed:") || state.keepClaims).map((name) => ({ name })) }]);
    if (j.startsWith("issue edit")) {
      const add = args[args.indexOf("--add-label") + 1];
      const rm = args[args.indexOf("--remove-label") + 1];
      if (args.includes("--add-label")) { state.labels.push(add); state.events.push({ id: ++state.t, event: "labeled", label: { name: add }, created_at: new Date(1e12 + state.t * 1000).toISOString() }); }
      if (args.includes("--remove-label")) state.labels = state.labels.filter((l) => l !== rm);
      return "";
    }
    if (j.startsWith("api repos")) return JSON.stringify(state.events);
    if (j.startsWith("issue comment")) { state.comments.push(input); return ""; }
    if (j.startsWith("issue close")) { state.closed = true; return ""; }
    throw new Error("unmocked gh " + j);
  };
  return { gh, state };
}

test("claim race: two runners, one wins", () => {
  const { gh, state } = fakeGh();
  // runner A labels first, then B; both then read events
  gh(["issue", "edit", "7", "--add-label", "claimed:mac-a"]);
  const bWins = claim(gh, 7, "mac-b", "abdout");
  assert.equal(bWins, false, "later claim loses");
  assert.ok(!state.labels.includes("claimed:mac-b"), "loser removes its label");
  assert.ok(state.labels.includes("claimed:mac-a"));
  const { gh: g2 } = fakeGh();
  assert.equal(claim(g2, 7, "mac-a", "abdout"), true);
});

test("result comment formatting truncates and carries run id", () => {
  const c = formatComment({ agent: "claude", host: "mac", ok: true, code: 0, output: "x".repeat(9000), seconds: 4, runId: "R1" });
  assert.match(c, /dispatch done/);
  assert.match(c, /last 3500 chars/);
  assert.match(c, /ledger run: R1/);
  assert.ok(c.length < 4500);
  assert.match(formatComment({ agent: "a", host: "h", ok: false, code: 2, output: "boom", seconds: 1 }), /failed: exit 2/);
});

test("success closes the issue, failure leaves it open with failed", async () => {
  let r = fakeGh();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsp-"));
  let res = await pass({ gh: r.gh, installed: ["codex"], stateDir: dir, log() {}, exec: async () => ({ code: 0, output: "PONG", timedOut: false }) });
  assert.equal(res[0].ok, true);
  assert.ok(r.state.closed && r.state.labels.includes("done"));
  assert.match(r.state.comments[0], /PONG/);

  r = fakeGh();
  res = await pass({ gh: r.gh, installed: ["codex"], stateDir: dir, log() {}, exec: async () => ({ code: 3, output: "bad", timedOut: false }) });
  assert.equal(res[0].ok, false);
  assert.ok(!r.state.closed && r.state.labels.includes("failed"));
});

test("timeout becomes failed", async () => {
  const r = fakeGh();
  const out = await runTask(r.gh, { number: 7, body: "go\n```yaml\ncwd: " + os.tmpdir() + "\ntimeout_min: 1\n```", labels: [] }, "codex", {
    host: "h", engine: {}, exec: async (spec, ms) => { assert.equal(ms, 60000); return { code: 124, output: "", timedOut: true }; },
  });
  assert.equal(out.ok, false);
  assert.match(r.state.comments[0], /failed: timeout/);
  assert.ok(r.state.labels.includes("failed") && !r.state.closed);
});

test("real timeout kills a slow process", async () => {
  const { execAgent } = await import("./lib.mjs");
  const res = await execAgent({ cmd: "sleep", args: ["5"], cwd: os.tmpdir(), env: {} }, 300);
  assert.equal(res.timedOut, true);
  assert.equal(res.code, 124);
});

test("billing guard stops a fable lane before running", async () => {
  const r = fakeGh();
  let ran = false;
  const out = await runTask(r.gh, { number: 7, body: "go", labels: L("lane:escalate") }, "claude", { host: "h", engine: {}, exec: async () => { ran = true; return {}; } });
  assert.equal(ran, false);
  assert.equal(out.refused, true);
  assert.ok(r.state.labels.includes("failed"));
});

test("lock allows one task per agent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-"));
  const a = takeLock("codex", dir);
  assert.ok(a);
  assert.equal(takeLock("codex", dir), null);
  a();
  assert.ok(takeLock("codex", dir));
});
