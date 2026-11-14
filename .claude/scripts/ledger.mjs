#!/usr/bin/env node
// ledger.mjs — the share-economy ledger: who did what, and how one month's money is shared.
//
//   node .claude/scripts/ledger.mjs scores [--month 2026-11] [--json]
//       accepted, rated tasks per person across the databayt org (one GitHub search)
//   node .claude/scripts/ledger.mjs split --money 1600 [--salaries <file>] [--month 2026-11]
//       the salary waterfall for one month's team money; what is left above every salary
//       is shared by that month's scores
//   node .claude/scripts/ledger.mjs statement --month 2026-11 --revenue 4000 --costs 900
//       the whole sheet: community pool, needs fund, the split, the scores
//   node .claude/scripts/ledger.mjs --test
//       the worked example from the contract page, to the dollar
//
// The rule is not invented here. It is the one the team can read on the contract page
// (hogwarts content/docs-en/shared-economy.mdx):
//   - 5% of revenue goes to the community pool; 2.5% of net profit to the needs fund.
//   - The money left after running costs and the pool is split equally. Whoever's equal
//     share is more than their written salary gets the salary and steps out; the rest is
//     split again among the others, lowest salary met first, until every salary is met.
//   - What is left above every salary is shared by score. That last step is a proposal the
//     team agrees on before the first month it applies.
//   - A score is the sum of a person's accepted tasks. Every task carries its rate before
//     anyone starts it (a `rate:<n>` label on the issue); it counts when it is accepted
//     (closed as completed).
//
// It is an accrual ledger, not payroll: it shows what the rule gives; paying follows revenue.
// Zero tokens. Percentages and label names are policy in engine.json → ledger. Salaries are
// private: they live in a file on the owner's machine (ledger.salaries_file), never in git.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HOME = os.homedir();
const KUN = process.env.KUN_DIR || path.join(HOME, "kun");
const readJSON = (p, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return d;
  }
};
export function policy() {
  const l = readJSON(path.join(KUN, ".claude/engine.json"), {}).ledger || {};
  return {
    org: l.org || "databayt",
    pool_pct: l.pool_pct ?? 5,
    needs_fund_pct: l.needs_fund_pct ?? 2.5,
    rate_labels: l.rate_labels || ["rate:", "cu:"],
    require_label: l.require_label || null,
    salaries_file: (l.salaries_file || "~/.claude/state/team/salaries.json").replace(/^~/, HOME),
    people: l.people || {},
  };
}
const round = (x) => Math.round(x * 100) / 100;

// ── the split ──────────────────────────────────────────────────────────────
// salaries: { name: monthly amount }. Returns each person's share, who had their salary met,
// and what is left above every salary.
export function split(money, salaries) {
  const paid = {};
  const met = [];
  let left = Math.max(0, Number(money) || 0);
  let active = Object.keys(salaries).filter((n) => Number(salaries[n]) > 0);
  const unwritten = Object.keys(salaries).filter((n) => !(Number(salaries[n]) > 0));
  for (const n of active) paid[n] = 0;
  while (active.length && left > 0) {
    const share = left / active.length;
    const capped = active.filter((n) => salaries[n] <= share + 1e-9);
    if (!capped.length) {
      for (const n of active) paid[n] = share;
      left = 0;
      break;
    }
    for (const n of capped) {
      paid[n] = salaries[n];
      left -= salaries[n];
      met.push(n);
    }
    active = active.filter((n) => !capped.includes(n));
  }
  return { paid: Object.fromEntries(Object.entries(paid).map(([k, v]) => [k, round(v)])), met, above: active.length ? 0 : round(left), unwritten };
}
export function byScore(amount, scores) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (!(amount > 0) || !(total > 0)) return {};
  return Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, round((amount * v) / total)]));
}

// ── the scores ─────────────────────────────────────────────────────────────
function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}
export function scoreIssues(issues, pol) {
  const people = {};
  const unrated = [];
  for (const i of issues) {
    const labels = (i.labels || []).map((l) => (typeof l === "string" ? l : l.name));
    if (pol.require_label && !labels.includes(pol.require_label)) continue;
    const rateLabel = labels.find((l) => pol.rate_labels.some((p) => l.startsWith(p)));
    const rate = rateLabel ? Number(rateLabel.split(":")[1]) : NaN;
    const who = (i.assignees || []).map((a) => (typeof a === "string" ? a : a.login));
    if (!(rate > 0) || !who.length) {
      unrated.push(i);
      continue;
    }
    for (const login of who) {
      const name = pol.people[login] || login;
      people[name] ||= { score: 0, tasks: 0 };
      people[name].score = round(people[name].score + rate / who.length); // one task, one rate: shared by its assignees
      people[name].tasks++;
    }
  }
  return { people, unrated: unrated.length, counted: issues.length - unrated.length };
}
function fetchIssues(pol, month) {
  const [from, to] = monthRange(month);
  const q = `org:${pol.org} is:issue is:closed reason:completed closed:${from}..${to}`;
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const r = spawnSync("gh", ["api", "-X", "GET", "search/issues", "-f", `q=${q}`, "-F", "per_page=100", "-F", `page=${page}`], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`GitHub search failed: ${(r.stderr || "").slice(0, 200)}`);
    const items = JSON.parse(r.stdout).items || [];
    out.push(...items.map((i) => ({ number: i.number, title: i.title, repo: i.repository_url.split("/").pop(), labels: i.labels, assignees: i.assignees })));
    if (items.length < 100) break;
  }
  return out;
}

// ── output ─────────────────────────────────────────────────────────────────
const money = (x) => `$${Number(x).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
function printScores(s, month) {
  console.log(`scores — ${month}: ${s.counted} accepted and rated task(s); ${s.unrated} closed task(s) had no rate or no assignee and do not count`);
  const rows = Object.entries(s.people).sort((a, b) => b[1].score - a[1].score);
  if (!rows.length) console.log("  nobody has a score yet: a task counts when its issue carries a rate label (rate:<n>) and an assignee, and is closed as completed");
  for (const [name, v] of rows) console.log(`  ${name.padEnd(18)} ${String(v.score).padStart(8)}   ${v.tasks} task(s)`);
}
function printSplit(r, salaries, scoreShare) {
  for (const [n, v] of Object.entries(r.paid)) console.log(`  ${n.padEnd(18)} ${money(v).padStart(10)}${r.met.includes(n) ? "   salary met" : `   of ${money(salaries[n])}`}${scoreShare[n] ? `   + ${money(scoreShare[n])} by score` : ""}`);
  for (const n of r.unwritten) console.log(`  ${n.padEnd(18)} ${"—".padStart(10)}   no salary written: the rule can only pay what is written`);
  if (r.above > 0) console.log(`  above every salary: ${money(r.above)}${Object.keys(scoreShare).length ? " — shared by score (a proposal until the team agrees)" : " — no scores this month, so it is not shared yet"}`);
}

function test() {
  const S = { A: 300, B: 500, C: 800, D: 1000 };
  const want = { 800: [200, 200, 200, 200], 1600: [300, 433.33, 433.33, 433.33], 2200: [300, 500, 700, 700], 2600: [300, 500, 800, 1000] };
  let ok = true;
  for (const [m, w] of Object.entries(want)) {
    const got = Object.values(split(Number(m), S).paid);
    const pass = got.every((g, i) => Math.abs(g - w[i]) < 0.01);
    console.log(`${pass ? "ok  " : "FAIL"} team money ${money(m)} → ${got.map(money).join("  ")}`);
    ok &&= pass;
  }
  const over = split(3000, S);
  const p1 = over.above === 400 && over.met.length === 4;
  console.log(`${p1 ? "ok  " : "FAIL"} $3,000 → every salary met, $${over.above} above`);
  const bs = byScore(400, { A: 3, B: 1 });
  const p2 = bs.A === 300 && bs.B === 100;
  console.log(`${p2 ? "ok  " : "FAIL"} $400 by score 3:1 → A ${money(bs.A)}, B ${money(bs.B)}`);
  const sc = scoreIssues(
    [
      { labels: ["rate:5"], assignees: ["x"] },
      { labels: [{ name: "cu:3" }], assignees: [{ login: "x" }, { login: "y" }] },
      { labels: ["bug"], assignees: ["x"] },
      { labels: ["rate:8"], assignees: [] },
    ],
    { rate_labels: ["rate:", "cu:"], require_label: null, people: { y: "Yasin" } }
  );
  const p3 = sc.people.x.score === 6.5 && sc.people.Yasin.score === 1.5 && sc.unrated === 2;
  console.log(`${p3 ? "ok  " : "FAIL"} scores: a shared task splits its rate; unrated and unassigned tasks do not count`);
  const p4 = split(500, { A: 300, B: 0 }).unwritten.join() === "B";
  console.log(`${p4 ? "ok  " : "FAIL"} a person with no written salary is named, not paid`);
  const zero = split(0, S);
  const p5 = Object.values(zero.paid).every((v) => v === 0) && zero.met.length === 0 && zero.above === 0;
  console.log(`${p5 ? "ok  " : "FAIL"} team money $0 → nobody is paid, no salary is met, nothing above the salaries`);
  return ok && p1 && p2 && p3 && p4 && p5;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flag = (n, d = null) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
  const pol = policy();
  const month = flag("month", new Date().toISOString().slice(0, 7));
  try {
    if (cmd === "--test") process.exitCode = test() ? 0 : 1;
    else if (cmd === "scores") {
      const s = scoreIssues(fetchIssues(pol, month), pol);
      if (argv.includes("--json")) console.log(JSON.stringify({ month, ...s }, null, 1));
      else printScores(s, month);
    } else if (cmd === "split" || cmd === "statement") {
      const salaries = readJSON(flag("salaries", pol.salaries_file), null);
      if (!salaries) {
        console.error(`ledger: no salaries file at ${flag("salaries", pol.salaries_file)} — write {"Name": monthly amount, …} there; it stays on this machine`);
        process.exit(1);
      }
      let team = Number(flag("money", 0));
      if (cmd === "statement") {
        const revenue = Number(flag("revenue", 0));
        const costs = Number(flag("costs", 0));
        const pool = round((revenue * pol.pool_pct) / 100);
        const net = revenue - costs - pool;
        const needs = net > 0 ? round((net * pol.needs_fund_pct) / 100) : 0;
        team = round(Math.max(0, net - needs));
        console.log(`statement — ${month}\n  revenue ${money(revenue)} · running costs ${money(costs)}\n  community pool (${pol.pool_pct}% of revenue) ${money(pool)}\n  needs fund (${pol.needs_fund_pct}% of net profit) ${money(needs)}\n  team money ${money(team)}\n`);
      }
      let scores = {};
      try {
        const s = scoreIssues(fetchIssues(pol, month), pol);
        scores = Object.fromEntries(Object.entries(s.people).map(([k, v]) => [k, v.score]));
      } catch (e) {
        console.error(`ledger: scores unavailable (${e.message}); the split is shown without them`);
      }
      const r = split(team, salaries);
      console.log(`split of ${money(team)} — ${month}`);
      printSplit(r, salaries, byScore(r.above, scores));
    } else {
      console.log("ledger.mjs scores [--month YYYY-MM] | split --money N | statement --month YYYY-MM --revenue N --costs N | --test");
    }
  } catch (e) {
    console.error(`ledger: ${e.message}`);
    process.exit(1);
  }
}
