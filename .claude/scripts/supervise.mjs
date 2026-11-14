#!/usr/bin/env node
// supervise.mjs — the one that acts on what runs.sh judges (2026-11-02).
//
//   node supervise.mjs            one tick (launchd com.databayt.supervisor, every 5 min + on a real wake)
//   node supervise.mjs --dry      decide and log, act on nothing
//   node supervise.mjs --status   print the last tick's state
//   node supervise.mjs --test-slots   slot-math self-test
//   node supervise.mjs --install  install the launchd job (StartInterval 300, RunAtLoad)
//   drills: --only <job> (that job alone: no heal, no beat) · --force live,alerts (switch parts on for this
//   run) · SUPERVISE_STATE, KUN_NOTIFY_FILE, SUPERVISE_ISSUE_LABEL, SUPERVISE_COOLDOWN_MIN
//
// Each tick, on the owner Mac only and only in a full wake with the network:
//   heal    what jobs depend on: the Hermes gateway (gone → kickstart; hung → kickstart -k), Colima
//           + the Twenty containers, the session-vault Chrome, KeepAlive daemons, plists that lost
//           their job-run.sh wrapper. Backoff: 3 tries an hour per target.
//   resume  a missed or failed slot, by the job's policy (engine.json → jobs.<job>.resume): auto =
//           re-fire the newest owed slot through the job's own entry (launchctl kickstart / hermes cron
//           run), at most max_attempts started runs per slot; tick = one early run after a wake. Never a
//           live run, never within 3 min of a wake (launchd and Hermes catch up first), never when the
//           next slot is under an hour away. At most 2 re-fires a tick, mkan first.
//   escalate what stays broken: one GitHub issue per job or dependency (label job-health, the owner's
//           repo, assigned abdout — the record) + one Slack line (#mkan with a mention, or Abdout's DM —
//           the push). Closed with a note when the job is ok again.
//   beat    mkan's deadline jobs into WaState('mac-beat'), so the watchdog outside the Mac can tell
//           when the Mac has gone quiet past a deadline.
// engine.json → jobs.$supervise: live / heal / alerts switch each part on (off = logged as "would").
// State: ~/.claude/state/supervise.json. It never edits a job's own record; runs.sh stays the judge.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();
const KUN = process.env.KUN_DIR ?? join(HOME, 'kun');
const ENGINE = join(KUN, '.claude', 'engine.json');
const STATE_DIR = process.env.RUNS_STATE_DIR ?? join(HOME, '.claude', 'state', 'runs');
const LOCK_DIR = process.env.RUNS_LOCK_DIR ?? join(HOME, '.claude', 'state', 'locks');
const SUP = process.env.SUPERVISE_STATE ?? join(HOME, '.claude', 'state', 'supervise.json');
const HERMES_JOBS = join(HOME, '.hermes', 'cron', 'jobs.json');
const UID = process.getuid?.() ?? 501;
const PATH = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const NOW = Date.now();

const readJson = (p, d) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return d;
  }
};
const writeJson = (p, v) => {
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(`${p}.tmp`, JSON.stringify(v, null, 1));
  renameSync(`${p}.tmp`, p);
};
const iso = (ms) => (ms ? new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z') : null);
const t = (s) => (s ? Date.parse(s) || 0 : 0);
const safe = (job) => job.replace(/[^A-Za-z0-9._-]/g, '_');
const sh = (cmd, argv, opts = {}) => {
  try {
    return { ok: true, out: execFileSync(cmd, argv, { encoding: 'utf8', timeout: 60_000, env: { ...process.env, PATH }, stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim() };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}`.trim(), err: `${e.stderr ?? e.message ?? ''}`.trim().slice(0, 300), code: e.status };
  }
};
const alive = (pid) => {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
};

// ── slot math: cron expressions (Hermes) and launchd calendar entries, local time ──────────────
function field(spec, lo, hi) {
  const out = new Set();
  for (const part of String(spec).split(',')) {
    const [range, stepS] = part.split('/');
    const step = stepS ? Number(stepS) : 1;
    let a;
    let b;
    if (range === '*') [a, b] = [lo, hi];
    else if (range.includes('-')) [a, b] = range.split('-').map(Number);
    else [a, b] = [Number(range), stepS ? hi : Number(range)];
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}
export function cronMatcher(expr, utc = false) {
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/);
  const G = utc
    ? { min: (d) => d.getUTCMinutes(), hr: (d) => d.getUTCHours(), day: (d) => d.getUTCDate(), mon: (d) => d.getUTCMonth() + 1, wd: (d) => d.getUTCDay() }
    : { min: (d) => d.getMinutes(), hr: (d) => d.getHours(), day: (d) => d.getDate(), mon: (d) => d.getMonth() + 1, wd: (d) => d.getDay() };
  const M = field(m, 0, 59);
  const H = field(h, 0, 23);
  const D = field(dom, 1, 31);
  const Mo = field(mon, 1, 12);
  const W = new Set([...field(dow, 0, 7)].map((v) => v % 7));
  const domAny = dom === '*';
  const dowAny = dow === '*';
  return (d) =>
    M.has(G.min(d)) &&
    H.has(G.hr(d)) &&
    Mo.has(G.mon(d)) &&
    (domAny && dowAny ? true : domAny ? W.has(G.wd(d)) : dowAny ? D.has(G.day(d)) : D.has(G.day(d)) || W.has(G.wd(d)));
}
export function calendarMatcher(entries) {
  const list = (Array.isArray(entries) ? entries : [entries]).map(
    (e) => (d) =>
      (e.Minute === undefined || e.Minute === d.getMinutes()) &&
      (e.Hour === undefined || e.Hour === d.getHours()) &&
      (e.Day === undefined || e.Day === d.getDate()) &&
      (e.Month === undefined || e.Month === d.getMonth() + 1) &&
      (e.Weekday === undefined || e.Weekday % 7 === d.getDay()),
  );
  return (d) => list.some((f) => f(d));
}
export function prevFire(match, from, maxDays = 9) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  for (let i = 0; i < maxDays * 1440; i++, d.setTime(d.getTime() - 60_000)) if (match(d)) return d.getTime();
  return null;
}
export function nextFire(match, from, maxDays = 9) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  for (let i = 0; i < maxDays * 1440; i++) {
    d.setTime(d.getTime() + 60_000);
    if (match(d)) return d.getTime();
  }
  return null;
}

function testSlots() {
  const at = (s) => new Date(s).getTime(); // local time strings
  const cases = [
    ['0 6,18 * * *', '2026-11-02T17:59', '2026-11-02T06:00', '2026-11-02T18:00'],
    ['0 6,18 * * *', '2026-11-02T18:00', '2026-11-02T18:00', '2026-11-03T06:00'],
    ['30 8 * * 1-5', '2026-11-08T12:00', '2026-11-06T08:30', '2026-11-09T08:30'], // Sunday → Friday's slot, Monday next
    ['0 */4 * * *', '2026-11-02T19:59', '2026-11-02T16:00', '2026-11-02T20:00'],
    ['0 18 * * 0', '2026-11-03T10:00', '2026-11-01T18:00', '2026-11-08T18:00'],
    ['0 10 * * 1', '2026-11-02T09:00', '2026-10-26T10:00', '2026-11-02T10:00'],
    ['0 1 1 * *', '2026-11-06T12:00', '2026-11-01T01:00', '2026-12-01T01:00'], // monthly: 62-day search, not "daily"
    ['0 1 1 * *', '2026-11-01T00:59', '2026-10-01T01:00', '2026-11-01T01:00'],
  ];
  let fail = 0;
  const fmt = (ms) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  for (const [expr, now, prev, next] of cases) {
    const m = cronMatcher(expr);
    const [p, n] = [fmt(prevFire(m, at(now), 62)), fmt(nextFire(m, at(now), 62))];
    const ok = p === prev && n === next;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} cron '${expr}' at ${now}: prev ${p} (want ${prev}) next ${n} (want ${next})`);
  }
  const cal = [
    [[{ Hour: 1, Minute: 30 }, { Hour: 4, Minute: 30 }], '2026-11-02T03:00', '2026-11-02T01:30', '2026-11-02T04:30'],
    [{ Weekday: 1, Hour: 9, Minute: 30 }, '2026-11-02T09:29', '2026-10-26T09:30', '2026-11-02T09:30'],
    [{ Hour: 7, Minute: 0 }, '2026-11-02T07:50', '2026-11-02T07:00', '2026-11-03T07:00'],
    [{ Weekday: 0, Hour: 9, Minute: 0 }, '2026-11-02T10:00', '2026-11-01T09:00', '2026-11-08T09:00'],
  ];
  for (const [entries, now, prev, next] of cal) {
    const m = calendarMatcher(entries);
    const [p, n] = [fmt(prevFire(m, at(now))), fmt(nextFire(m, at(now)))];
    const ok = p === prev && n === next;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} launchd ${JSON.stringify(entries)} at ${now}: prev ${p} (want ${prev}) next ${n} (want ${next})`);
  }
  console.log(fail ? `${fail} FAILED` : 'all slot cases pass');
  process.exit(fail ? 1 : 0);
}

// ── the Mac and the world ──────────────────────────────────────────────────────────────────
const fullWake = () => {
  const s = process.env.RUNS_FAKE_SYSTEMSTATE ?? sh('pmset', ['-g', 'systemstate']).out;
  return !s || /Graphics/.test(s);
};
const up = (url, secs = 8) => sh('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', String(secs), url]);
const online = () => up(process.env.LANE_ONLINE_URL ?? 'https://www.cloudflare.com/cdn-cgi/trace', 10).ok;
const waketime = () => {
  const m = /sec = (\d+)/.exec(sh('sysctl', ['-n', 'kern.waketime']).out);
  return m ? Number(m[1]) * 1000 : 0;
};
const launchdPid = (label) => {
  const r = sh('launchctl', ['list', label]);
  const m = /"PID" = (\d+);/.exec(r.out);
  return r.ok ? (m ? Number(m[1]) : 0) : null; // null = not loaded
};
const launchdRunning = (label) => /\n\s*state = running/.test(`\n${sh('launchctl', ['print', `gui/${UID}/${label}`]).out}`);
const plist = (label) => {
  const p = join(HOME, 'Library', 'LaunchAgents', `${label}.plist`);
  if (!existsSync(p)) return null;
  const r = sh('plutil', ['-convert', 'json', '-o', '-', p]);
  try {
    return r.ok ? JSON.parse(r.out) : null;
  } catch {
    return null;
  }
};
const stateOf = (job) => readJson(join(STATE_DIR, `${safe(job)}.json`), null);
// A job's newest log write (ms): the evidence for a run from before the job kept its own record.
const newestLog = (j) => {
  let newest = 0;
  for (const g of j.logs ?? []) {
    for (const p of globSync(g.replace(/^~/, HOME))) {
      try {
        newest = Math.max(newest, statSync(p).mtimeMs);
      } catch {}
    }
  }
  return newest;
};
const lockLive = (job) => {
  const d = join(LOCK_DIR, `${safe(job)}.lock`);
  const pid = (() => {
    try {
      return readFileSync(join(d, 'pid'), 'utf8').trim();
    } catch {
      return '';
    }
  })();
  return pid && alive(pid) ? Number(pid) : 0;
};

// ── the tick ─────────────────────────────────────────────────────────────────────────────────
function main() {
  if (flag('--test-slots')) return testSlots();
  if (flag('--install')) return install();
  if (flag('--status')) {
    const s = readJson(SUP, null);
    console.log(s ? JSON.stringify({ ...s, log: (s.log ?? []).slice(-25) }, null, 1) : 'no supervisor state yet');
    return;
  }
  const engine = readJson(ENGINE, {});
  const jobs = engine.jobs ?? {};
  const cfg = jobs.$supervise ?? {};
  const owners = jobs.$owners ?? {};
  const dry = flag('--dry');
  const force = (args[args.indexOf('--force') + 1] ?? '').split(',');
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const on = (k) => !dry && (!!cfg[k] || (args.includes('--force') && force.includes(k)));
  const mode = { live: on('live'), heal: !only && on('heal'), alerts: on('alerts') };
  // A drill touches one job: no \$supervise in its scope, so no dependency issues either.
  const scope = only ? Object.fromEntries(Object.entries(jobs).filter(([k]) => k === only || k === '$owners')) : jobs;
  // The owner Mac only: the one that runs kun-aware (teammates' Macs have none of these jobs).
  if (!existsSync(join(HOME, 'Library', 'LaunchAgents', 'com.databayt.kun-aware.plist'))) return;
  const sup = readJson(SUP, null) ?? { fired: {}, heals: {}, alerts: {}, issues: {}, log: [] };
  for (const k of ['fired', 'heals', 'alerts', 'issues']) sup[k] ??= {};
  sup.log ??= [];
  sup.seen ??= {};
  const log = (action, job, why) => {
    const k = `${action}|${job}|${String(why ?? '').slice(0, 80)}`;
    if (sup.seen[k] && NOW - sup.seen[k] < 3_600_000) return; // the same news, folded for an hour
    sup.seen[k] = NOW;
    const line = { at: iso(Date.now()), action, job, why: String(why ?? '').slice(0, 240) };
    sup.log.push(line);
    console.log(`${line.at} ${action} ${job ?? ''} ${line.why}`);
  };
  // One tick at a time.
  const lock = join(LOCK_DIR, 'supervise.lock');
  mkdirSync(LOCK_DIR, { recursive: true });
  const held = readJson(lock, null);
  if (held && alive(held.pid) && NOW - (held.at ?? 0) < 20 * 60_000) return;
  writeJson(lock, { pid: process.pid, at: NOW });
  try {
    sup.at = iso(NOW);
    sup.mode = mode;
    powerGuard(log);
    sup.awake = fullWake();
    sup.online = sup.awake && online();
    if (!sup.awake || !sup.online) {
      sup.skipped = !sup.awake ? 'dark wake' : 'offline';
      return;
    }
    delete sup.skipped;
    const wake = waketime();
    sup.wake = iso(wake);
    // The judge.
    const judged = sh('bash', [join(HOME, '.claude', 'scripts', 'runs.sh'), '--json'], { timeout: 90_000 });
    let rows = [];
    try {
      rows = JSON.parse(judged.out).rows ?? [];
    } catch {
      log('alert', 'supervisor', `runs.sh --json unreadable: ${judged.err || judged.out.slice(0, 120)}`);
      if (mode.alerts) notify('kun', owners, 'supervisor', `⚠️ The job supervisor cannot read runs.sh --json: ${judged.err || 'no output'}. It re-runs nothing until that is fixed.`);
      return; // fail closed: never re-fire blind
    }
    const row = Object.fromEntries(rows.map((r) => [r.job, r]));
    const hermes = (() => {
      const d = readJson(HERMES_JOBS, {});
      return Object.fromEntries((Array.isArray(d) ? d : d.jobs ?? []).map((h) => [`hermes:${h.name}`, h]));
    })();

    const down = only ? new Set() : heal(jobs, sup, mode, log, wake);
    resume(scope, row, hermes, sup, mode, log, wake, down, cfg);
    const c = only ? { jobs: {}, rows: {} } : cloud(jobs.$cloud, sup, mode, log, cfg);
    escalate({ ...scope, ...c.jobs }, { ...row, ...c.rows }, sup, mode, log, owners, cfg, down, wake);
    if (!only) beat(jobs, hermes, sup, mode, log, cfg);
  } finally {
    sup.log = sup.log.slice(-300);
    for (const k of Object.keys(sup.seen ?? {})) if (NOW - sup.seen[k] > 86_400_000) delete sup.seen[k];
    writeJson(SUP, sup);
    rmSync(lock, { force: true });
  }
}

// ── heal ─────────────────────────────────────────────────────────────────────────────────────
// The presence loop (devices.sh) holds this Mac awake as a server and stands down when the
// laptop is being carried. If that loop has died, nothing would ever clear the flag, and a
// shut laptop on battery would run flat and hot in a bag. This is the second guard: before
// the wake gate, on every tick.
function powerGuard(log) {
  if (process.platform !== 'darwin' || !existsSync('/etc/sudoers.d/kun-pmset')) return;
  if (!/"SleepDisabled" = Yes/.test(sh('ioreg', ['-rd1', '-c', 'IOPMrootDomain']).out)) return;
  const onBattery = !/AC Power/.test(sh('pmset', ['-g', 'batt']).out);
  const lidShut = /"AppleClamshellState" = Yes/.test(sh('ioreg', ['-r', '-k', 'AppleClamshellState', '-d', '1']).out);
  const loop = sh('launchctl', ['list']).out.split('\n').find((l) => l.trim().endsWith('com.databayt.presence')) || '';
  const loopUp = /^\d+\s/.test(loop.trim());
  if (onBattery && lidShut && !loopUp) {
    const r = sh('sudo', ['-n', '/usr/bin/pmset', '-a', 'disablesleep', '0']);
    log('heal', 'power', r.ok ? 'presence loop is down with the lid shut on battery — sleep allowed again' : `could not clear SleepDisabled: ${r.err}`);
  }
}

function heal(jobs, sup, mode, log, wake) {
  const down = new Set();
  const attempt = (target, why, fn) => {
    const h = (sup.heals[target] ??= { tries: [] });
    h.tries = h.tries.filter((ms) => NOW - ms < 3_600_000);
    h.down = iso(NOW);
    h.why = why;
    if (h.tries.length >= 3) {
      h.exhausted = true;
      return;
    }
    if (!mode.heal) return log('would-heal', target, why);
    h.tries.push(NOW);
    const r = fn();
    log(r.ok ? 'heal' : 'heal-failed', target, r.ok ? why : `${why}: ${r.err || r.out}`.slice(0, 200));
  };
  const fine = (target) => {
    if (sup.heals[target]?.down) log('healthy', target, 'up again');
    delete sup.heals[target];
  };
  // Hermes gateway: gone, or hung (its ticker has not succeeded for 10 min while the Mac was awake).
  const gw = launchdPid('ai.hermes.gateway');
  const tick = Number((() => {
    try {
      return readFileSync(process.env.SUPERVISE_TICKER ?? join(HOME, '.hermes', 'cron', 'ticker_last_success'), 'utf8');
    } catch {
      return '0';
    }
  })().trim().split('+')[0]) * 1000;
  if (gw === 0 || gw === null) {
    down.add('hermes');
    attempt('hermes', 'the Hermes gateway is not running', () => sh('launchctl', ['kickstart', `gui/${UID}/ai.hermes.gateway`]));
  } else if (tick && NOW - tick > 10 * 60_000 && NOW - wake > 10 * 60_000) {
    down.add('hermes');
    attempt('hermes', `the Hermes ticker has not run for ${Math.round((NOW - tick) / 60_000)} min`, () => sh('launchctl', ['kickstart', '-k', `gui/${UID}/ai.hermes.gateway`]));
  } else fine('hermes');
  // The Twenty CRM runs on Hetzner since 2026-11-14 (twenty/hetzner/). :3100 on this Mac is the
  // SSH tunnel (com.databayt.twenty-tunnel), so a dead :3100 is healed by restarting the tunnel —
  // NEVER by starting Colima or the old local containers: that would revive a stale second CRM.
  // Colima is no longer always-on; nothing here starts it.
  if (up(`${process.env.RUNS_TWENTY_URL ?? 'http://localhost:3100'}/healthz`).out !== '200') {
    down.add('twenty');
    attempt('twenty', 'the Twenty CRM is not answering on :3100 (Hetzner tunnel)', () => sh('launchctl', ['kickstart', '-k', `gui/${UID}/com.databayt.twenty-tunnel`]));
  } else fine('twenty');
  // The session-vault Chrome (TikTok uploads, logged-in reads). A plain kickstart never fights a run.
  if (!up(`${process.env.RUNS_VAULT_URL ?? 'http://127.0.0.1:9222'}/json/version`, 4).ok) {
    down.add('vault');
    attempt('vault', 'the session-vault Chrome is not answering on :9222', () => sh('launchctl', ['kickstart', `gui/${UID}/com.databayt.chrome-session`]));
  } else fine('vault');
  // KeepAlive daemons with no process.
  for (const [name, j] of Object.entries(jobs)) {
    if (name.startsWith('$') || j.resume !== 'heal' || !j.label || name === 'chrome-vault') continue;
    if (!existsSync(join(HOME, 'Library', 'LaunchAgents', `${j.label}.plist`))) continue;
    const pid = launchdPid(j.label);
    if (!pid) {
      down.add(name);
      attempt(name, pid === null ? 'not loaded in launchd' : 'its daemon is not running', () => (pid === null ? sh('launchctl', ['bootstrap', `gui/${UID}`, join(HOME, 'Library', 'LaunchAgents', `${j.label}.plist`)]) : sh('launchctl', ['kickstart', `gui/${UID}/${j.label}`])));
    } else fine(name);
  }
  // A plist an installer rewrote loses its job-run.sh wrapper: wrap it again (only idle jobs reload).
  const wrapper = join(HOME, '.claude', 'bin', 'job-run.sh');
  const unwrapped = Object.entries(jobs).filter(([n, j]) => !n.startsWith('$') && j.label && j.kind !== 'trigger' && Number(j.cadence_hours ?? 24) !== 0 && plist(j.label) && !(plist(j.label).ProgramArguments ?? []).slice(0, 2).includes(wrapper));
  if (unwrapped.length) {
    if (mode.heal) {
      const r = sh('python3', [join(KUN, '.claude', 'scripts', 'wrap-plists.py')], { timeout: 120_000 });
      log('heal', 'plists', `re-wrapped ${unwrapped.map(([n]) => n).join(', ')}: ${r.out.split('\n').slice(-1)[0] ?? ''}`);
    } else log('would-heal', 'plists', `re-wrap ${unwrapped.map(([n]) => n).join(', ')}`);
  }
  return down;
}

// ── resume ───────────────────────────────────────────────────────────────────────────────────
function scheduleOf(name, j, h) {
  if (name.startsWith('hermes:')) {
    if (!h || h.enabled === false) return null;
    if (h.schedule?.kind === 'cron' && h.schedule.expr) return { match: cronMatcher(h.schedule.expr) };
    return null;
  }
  const p = j.label ? plist(j.label) : null;
  if (!p) return null;
  if (p.StartCalendarInterval) return { match: calendarMatcher(p.StartCalendarInterval) };
  if (p.StartInterval) return { every: Number(p.StartInterval) * 1000 };
  return null;
}

function resume(jobs, row, hermes, sup, mode, log, wake, down, cfg) {
  const grace = (cfg.wake_grace_minutes ?? 3) * 60_000;
  const toNext = (cfg.min_minutes_to_next_slot ?? 60) * 60_000;
  const cap = cfg.max_refires_per_tick ?? 2;
  if (NOW - wake < grace) return log('wait', null, 'woke under 3 min ago — launchd and Hermes catch up first');
  const order = Object.entries(jobs)
    .filter(([n, j]) => !n.startsWith('$') && (j.resume === 'auto' || j.resume === 'tick'))
    .sort(([, a], [, b]) => (a.owner === 'mkan' ? 0 : 1) - (b.owner === 'mkan' ? 0 : 1));
  let fired = 0;
  for (const [name, j] of order) {
    if (fired >= cap) break;
    const h = hermes[name];
    if (!name.startsWith('hermes:') && !(j.label && existsSync(join(HOME, 'Library', 'LaunchAgents', `${j.label}.plist`)))) continue;
    if (name.startsWith('hermes:') && !h) continue;
    if ((j.needs ?? []).some((n) => down.has(n))) continue; // its dependency is being healed
    const r = row[name];
    if (r?.needs_human) continue; // escalated, never re-fired
    const st = stateOf(name) ?? {};
    // Live: its own record says running with a live pid, its job-run lock is held, or launchd runs it.
    // (A Hermes run-now is guarded by Hermes' own claim: a second one is refused, not doubled.)
    const live = (st.status === 'start' && st.pid && alive(st.pid)) || lockLive(name) || (j.label && launchdRunning(j.label));
    if (live) continue;
    const sched = scheduleOf(name, j, h);
    if (!sched) continue;
    // When was it last done? Its own record's last ok; a Hermes job with no record of its own (the 4h
    // heartbeat) by Hermes' last ok run. A digest that ran but never reached Slack is not done.
    let lastGood = t(st.last_ok);
    if (!st.status && !st.steps && h?.last_status === 'ok') lastGood = Math.max(lastGood, t(h.last_run_at));
    // No record of its own yet (it ran before it went behind job-run.sh): a log written after the
    // slot, with the judge calling it ok, counts as done.
    const noRecord = !st.status && !st.steps && !name.startsWith('hermes:');
    if (noRecord && (r?.state === 'ok' || r?.state === 'warn')) lastGood = Math.max(lastGood, newestLog(j));
    if (j.only_if === 'undelivered' && h?.last_delivery_error && t(h.last_run_at) >= lastGood - 300_000) lastGood = 0;
    if (sched.every) {
      // StartInterval jobs: launchd misses firings during sleep; one early run once awake.
      const lastStart = t(st.started) || t(st.ts) || (noRecord ? newestLog(j) : 0);
      if (NOW - Math.max(lastStart, lastGood) < sched.every * 1.5) continue;
      if (mode.live || (!flag('--dry') && (cfg.live_owners ?? []).includes(j.owner ?? 'kun'))) {
        sh('launchctl', ['kickstart', `gui/${UID}/${j.label}`]);
        fired++;
        log('fire', name, `no run for ${Math.round((NOW - Math.max(lastStart, lastGood)) / 60_000)} min (every ${sched.every / 60_000} min; slept through)`);
      } else log('would-fire', name, `no run for ${Math.round((NOW - Math.max(lastStart, lastGood)) / 60_000)} min`);
      continue;
    }
    const slot = prevFire(sched.match, NOW);
    const next = nextFire(sched.match, NOW);
    if (!slot || lastGood >= slot) continue; // the newest slot is done
    if (NOW - slot < 5 * 60_000) continue; // its scheduler is firing it right now
    if (next && next - NOW < toNext) continue; // the next slot is close: let it run
    if (j.refire_within_hours && NOW - slot > j.refire_within_hours * 3_600_000) continue; // too late to matter
    // Attempts: runs that really started since the slot (defers and slept-through runs don't count).
    const runs = (st.runs ?? []).filter((x) => t(x.started) >= slot && x.status && x.status !== 'defer' && !x.slept);
    const max = j.resume === 'tick' ? 1 : (j.max_attempts ?? 1);
    const key = `${name}@${iso(slot)}`;
    const f = (sup.fired[key] ??= { n: 0 });
    if (runs.length >= max || f.n >= max) {
      f.exhausted = true;
      continue;
    }
    if (f.at && NOW - t(f.at) < Number(process.env.SUPERVISE_COOLDOWN_MIN ?? 20) * 60_000) continue; // a re-fire is still getting going
    const entry = j.refire ?? name;
    const why = `slot ${iso(slot)} has no ok (${r?.why || st.summary || st.status || 'never ran'}); attempt ${runs.length + 1}/${max}`;
    // live_owners: re-fire live for these owners while the rest stay dry (rollout: mkan first).
    const liveHere = mode.live || (!flag('--dry') && (cfg.live_owners ?? []).includes(j.owner ?? 'kun'));
    if (!liveHere) {
      if (!f.would) log('would-fire', entry, why);
      f.would = iso(NOW);
      continue;
    }
    if (entry.startsWith('hermes:')) {
      const target = hermes[entry];
      if (!target) continue;
      spawn('hermes', ['cron', 'run', target.id], { detached: true, stdio: 'ignore', env: { ...process.env, PATH } }).unref();
    } else {
      const ej = jobs[entry];
      sh('launchctl', ['kickstart', `gui/${UID}/${ej?.label ?? j.label}`]);
    }
    f.n += 1;
    f.at = iso(NOW);
    fired++;
    log('fire', entry, why);
  }
  // Forget fired-slot records older than a week.
  for (const k of Object.keys(sup.fired)) if (NOW - t(k.split('@')[1]) > 7 * 86_400_000) delete sup.fired[k];
}

// ── escalate ─────────────────────────────────────────────────────────────────────────────────
function notify(ownerName, owners, title, text) {
  const o = owners[ownerName] ?? { notify: 'me' };
  if (process.env.KUN_NOTIFY_FILE) {
    writeFileSync(process.env.KUN_NOTIFY_FILE, `[${o.notify}] ${text}\n`, { flag: 'a' });
    return true;
  }
  if (o.notify === 'mkan') {
    const cfg = readJson(ENGINE, {}).jobs?.$supervise ?? {};
    const r = sh('bash', ['-c', 'cd "$HOME/mkan" && pnpm -s crm:post-mkan'], { input: `${cfg.mkan_mention ?? ''} ${text}`.trim(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000 });
    return r.ok;
  }
  const r = sh('bash', ['-c', '. "$HOME/.claude/scripts/lib/notify.sh" && kun_notify me "$1" "$2"', '_', title, text]);
  return r.ok;
}

function escalate(jobs, row, sup, mode, log, owners, cfg, down, wake) {
  const label = process.env.SUPERVISE_ISSUE_LABEL ?? cfg.issue_label ?? 'job-health';
  const today = iso(NOW).slice(0, 10);
  if (sup.issues.day !== today) sup.issues = { day: today, n: 0 };
  const problems = new Map(); // key → { owner, why, fix }
  // A dependency that could not be healed: one problem for it, its dependents stay quiet.
  for (const [target, h] of Object.entries(jobs.$supervise ? sup.heals : {})) {
    if (h.exhausted) problems.set(`dep:${target}`, { owner: 'kun', why: `${h.why} — 3 restarts in the last hour did not bring it back` });
  }
  for (const [name, j] of Object.entries(jobs)) {
    if (name.startsWith('$')) continue;
    const r = row[name];
    if (!r) continue;
    if ((j.needs ?? []).some((n) => down.has(n))) continue;
    const exhausted = Object.entries(sup.fired).some(([k, f]) => (k.startsWith(`${j.refire ?? name}@`) || k.startsWith(`${name}@`)) && f.exhausted);
    const awakeHour = NOW - wake > 3_600_000;
    if (r.needs_human) problems.set(name, { owner: j.owner ?? 'kun', why: /^needs you/i.test(r.why) ? r.why : `needs you: ${r.why}` });
    // auto: red or stale is what the re-fires are for — escalate only once a slot's attempts are used up.
    else if (j.resume === 'auto') {
      if (exhausted && (r.state === 'red' || r.state === 'stale')) problems.set(name, { owner: j.owner ?? 'kun', why: r.why });
    }
    // tick: it runs again by itself; escalate when it has had no ok for 2x its cadence while the Mac
    // was awake an hour (after a long sleep everything is stale until it catches up).
    else if (j.resume === 'tick') {
      if (r.state === 'stale' && awakeHour) problems.set(name, { owner: j.owner ?? 'kun', why: r.why });
    }
    // alert / heal / none (triggers, daemons): nothing re-runs them, so red is news at once.
    else if (r.state === 'red' || (r.state === 'stale' && awakeHour)) problems.set(name, { owner: j.owner ?? 'kun', why: r.why });
  }
  // Open or reopen one issue per problem; one Slack line each.
  for (const [key, p] of problems) {
    const a = sup.alerts[key];
    if (a?.open) continue;
    const o = owners[p.owner] ?? owners.kun ?? { repo: 'databayt/kun' };
    const title = `job-health: ${key} — ${p.why}`.slice(0, 120);
    const body = `The job supervisor could not fix this on its own.\n\n- **What:** ${key}\n- **Why:** ${p.why}\n- **Seen:** ${iso(NOW)} on the owner Mac\n\nDetail: \`bash ~/.claude/scripts/runs.sh\` · \`node ~/kun/.claude/scripts/supervise.mjs --status\`. This issue closes itself when the job records an ok again.`;
    if (!mode.alerts) {
      log('would-alert', key, p.why);
      continue;
    }
    let number = a?.issue;
    const recent = a?.closedAt && NOW - t(a.closedAt) < (cfg.reopen_days ?? 7) * 86_400_000;
    if (recent && number) {
      sh('gh', ['issue', 'reopen', String(number), '--repo', a.repo]);
      sh('gh', ['issue', 'comment', String(number), '--repo', a.repo, '--body', `Broken again: ${p.why}`]);
    } else {
      if (sup.issues.n >= (cfg.max_new_issues_per_day ?? 5)) {
        log('alert-capped', key, p.why);
        continue;
      }
      sh('gh', ['label', 'create', label, '--repo', o.repo, '--color', 'D93F0B', '--description', 'A scheduled job the supervisor could not fix']);
      const r = sh('gh', ['issue', 'create', '--repo', o.repo, '--title', title, '--body', body, '--label', label, '--assignee', 'abdout']);
      const m = /\/issues\/(\d+)/.exec(r.out);
      if (!m) {
        log('alert-failed', key, r.err || r.out);
        continue;
      }
      number = Number(m[1]);
      sup.issues.n += 1;
    }
    sup.alerts[key] = { open: true, repo: o.repo, issue: number, openedAt: iso(NOW), why: p.why, owner: p.owner };
    notify(p.owner, owners, 'Kun jobs', `⚠️ ${key}: ${p.why} — https://github.com/${o.repo}/issues/${number}`);
    log('alert', key, `${o.repo}#${number}: ${p.why}`);
  }
  // Recovered: close with a note.
  for (const [key, a] of Object.entries(sup.alerts)) {
    if (!a.open || problems.has(key)) continue;
    const r = row[key];
    const ok = key.startsWith('dep:') ? !sup.heals[key.slice(4)] : r && (r.state === 'ok' || r.state === 'defer' || r.state === 'warn');
    if (!ok) continue;
    if (!mode.alerts) {
      log('would-close', key, 'ok again');
      continue;
    }
    sh('gh', ['issue', 'close', String(a.issue), '--repo', a.repo, '--comment', `✅ ${key} is ok again (${iso(NOW)}) — closing.`]);
    notify(a.owner, owners, 'Kun jobs', `✅ ${key} is ok again — closed https://github.com/${a.repo}/issues/${a.issue}`);
    sup.alerts[key] = { ...a, open: false, closedAt: iso(NOW) };
    log('close', key, `${a.repo}#${a.issue}`);
  }
}

// ── cloud: scheduled GitHub workflows and Cloudflare Worker crons ──────────────────────────────
// They run off the Mac, but they fail too. Checked every check_minutes (default 60); the result is
// kept in supervise.json so escalate sees it every tick (to open, and to close, its issues).
//   GitHub: the newest scheduled run per workflow (gh run list). Failed → re-run its failed jobs once
//   (gh run rerun --failed; live for live_owners), then escalate. A workflow GitHub disabled for
//   inactivity is enabled again (heal). No scheduled run for 2x its period + 2 h → stale.
//   Workers: each cron route's newest run in Workers Logs (the scheduled handler logs {cron, path,
//   status, ms}). Status ≥ 500 → red; no run for 2x its period + 15 min → stale. Alert only: a blind
//   re-run of a school's or a tenant's cron route could send something twice.
// 62 days back and forth: a monthly cron ("0 1 1 * *") has no slot inside the 9-day default, and
// falling back to "daily" made it alarm two days after every 1st (databayt/mkan#58, 2026-11-03).
const period = (match) => {
  const a = prevFire(match, NOW, 62);
  const b = a && nextFire(match, a, 62);
  return a && b ? b - a : 86_400_000;
};
/** Workers Logs keeps about 7 days: a slot older than this cannot be checked, so it is not "stale". */
const LOGS_RETAIN_MS = 6 * 86_400_000;
function cloud(cc, sup, mode, log, cfg) {
  if (!cc) return { jobs: {}, rows: {} };
  if (sup.cloud && sup.cloudAt && NOW - t(sup.cloudAt) < (cc.check_minutes ?? 60) * 60_000) return sup.cloud;
  const jobs = {};
  const rows = {};
  sup.ghRerun ??= {};
  const liveFor = (owner) => mode.live || (!flag('--dry') && (cfg.live_owners ?? []).includes(owner));
  for (const g of cc.gh ?? []) {
    const key = `gh:${g.repo}/${g.workflow}`;
    jobs[key] = { owner: g.owner ?? 'kun', resume: 'auto', max_attempts: 1 };
    const file = join(HOME, g.repo.split('/')[1], '.github', 'workflows', g.workflow);
    const crons = (() => {
      try {
        return [...readFileSync(file, 'utf8').matchAll(/^\s*-\s*cron:\s*["']?([^"'#\n]+)/gm)].map((m) => m[1].trim());
      } catch {
        return [];
      }
    })();
    const every = crons.length ? Math.min(...crons.map((c) => period(cronMatcher(c, true)))) : 86_400_000;
    const list = sh('gh', ['run', 'list', '--repo', g.repo, '--workflow', g.workflow, '--event', 'schedule', '--limit', '2', '--json', 'databaseId,status,conclusion,createdAt,attempt']);
    let run = null;
    let before = null;
    try {
      [run = null, before = null] = JSON.parse(list.out || '[]');
    } catch {}
    // GitHub throttles frequent schedules (every 15 min runs every few hours): stale only after 12 h.
    const staleAfter = Math.max(2 * every + 7_200_000, 12 * 3_600_000);
    if (!list.ok) {
      rows[key] = { job: key, state: 'ok', why: `gh unreachable: ${list.err.slice(0, 80)}` };
      continue;
    }
    const age = run ? NOW - t(run.createdAt) : Infinity;
    if (run && run.status !== 'completed') rows[key] = { job: key, state: 'ok', why: run.status };
    else if (run && ['failure', 'timed_out', 'startup_failure'].includes(run.conclusion) && age < staleAfter) {
      const id = String(run.databaseId);
      // Re-run only a fresh failure (the run before it was green): one that fails every time needs a
      // person, and re-running it only burns Actions minutes.
      const fresh = !before || before.conclusion === 'success';
      if (fresh && (run.attempt ?? 1) < 2 && !sup.ghRerun[id]) {
        if (liveFor(jobs[key].owner)) {
          const r = sh('gh', ['run', 'rerun', id, '--failed', '--repo', g.repo]);
          sup.ghRerun[id] = iso(NOW);
          log(r.ok ? 'fire' : 'fire-failed', key, r.ok ? `scheduled run ${id} ${run.conclusion}: re-running its failed jobs` : r.err);
        } else log('would-fire', key, `scheduled run ${id} ${run.conclusion}: would re-run its failed jobs`);
        rows[key] = { job: key, state: 'red', why: `scheduled run ${run.conclusion} (${iso(t(run.createdAt))})` };
      } else {
        (sup.fired[`${key}@${iso(t(run.createdAt))}`] ??= { n: 1 }).exhausted = true;
        rows[key] = { job: key, state: 'red', why: `scheduled run ${run.conclusion}${fresh ? ' again after a re-run' : ', and the run before it too'} — https://github.com/${g.repo}/actions/runs/${id}` };
      }
    } else if (!run || age > staleAfter) {
      // Not running at all: disabled for inactivity (GitHub does that after 60 quiet days) → enable.
      const wl = sh('gh', ['workflow', 'list', '--repo', g.repo, '--all', '--json', 'path,state']);
      const state = (() => {
        try {
          return (JSON.parse(wl.out).find((w) => w.path.endsWith(`/${g.workflow}`)) ?? {}).state;
        } catch {
          return undefined;
        }
      })();
      if (state === 'disabled_inactivity' && mode.heal) {
        const r = sh('gh', ['workflow', 'enable', g.workflow, '--repo', g.repo]);
        log(r.ok ? 'heal' : 'heal-failed', key, r.ok ? 'GitHub had disabled it for inactivity: enabled again' : r.err);
        rows[key] = { job: key, state: 'ok', why: 'enabled again' };
        continue;
      }
      (sup.fired[`${key}@stale`] ??= { n: 1 }).exhausted = true;
      rows[key] = { job: key, state: 'stale', why: state && state !== 'active' ? `workflow ${state}` : `no scheduled run for ${run ? Math.round(age / 3_600_000) : '?'} h (every ${Math.round(every / 3_600_000) || '<1'} h)` };
    } else {
      delete sup.fired[`${key}@stale`];
      rows[key] = { job: key, state: 'ok', why: '' };
    }
  }
  // Cloudflare Worker crons, through the Workers Logs telemetry API (CLOUDFLARE_API_TOKEN).
  // launchd has no shell profile: the token comes from the Keychain (service cloudflare-api).
  const token = (process.env.CLOUDFLARE_API_TOKEN || sh('security', ['find-generic-password', '-s', 'cloudflare-api', '-w']).out || '').trim();
  const acct = (process.env.CLOUDFLARE_ACCOUNT_ID ?? cc.cf_account ?? '').trim();
  if (token && acct) {
    const hdr = join(LOCK_DIR, `cf-headers.${process.pid}`);
    writeFileSync(hdr, `Authorization: Bearer ${token}\nContent-Type: application/json\n`, { mode: 0o600 });
    try {
      for (const w of cc.workers ?? []) {
        const map = readJson(w.crons.replace(/^~/, HOME), {}).schedules ?? {};
        for (const [expr, paths] of Object.entries(map)) {
          const match = cronMatcher(expr, true);
          const every = period(match);
          // A cron rarer than the log retention (monthly): look only around its last slot, and only
          // while that slot is still in the logs; otherwise there is nothing to judge until it fires.
          const lastSlot = every > LOGS_RETAIN_MS ? prevFire(match, NOW, 62) : null;
          const from = lastSlot ? lastSlot - 300_000 : NOW - Math.max(2 * every + 900_000, 3_600_000);
          for (const path of paths) {
            const key = `cf:${w.worker}${path}`;
            jobs[key] = { owner: w.owner ?? 'kun', resume: 'alert' };
            if (lastSlot && NOW - lastSlot > LOGS_RETAIN_MS) {
              rows[key] = { job: key, state: 'ok', why: `runs ${expr} UTC; next check after ${iso(nextFire(match, NOW, 62) ?? NOW)}` };
              continue;
            }
            const body = JSON.stringify({
              queryId: 'kun-supervise-cron',
              view: 'events',
              limit: 1,
              timeframe: { from, to: NOW },
              parameters: { datasets: ['cloudflare-workers'], filters: [{ key: '$metadata.service', operation: 'eq', type: 'string', value: w.worker }, { key: 'path', operation: 'eq', type: 'string', value: path }] },
            });
            const r = sh('curl', ['-s', '--max-time', '20', '-H', `@${hdr}`, '-X', 'POST', `https://api.cloudflare.com/client/v4/accounts/${acct}/workers/observability/telemetry/query`, '--data-binary', '@-'], { input: body, stdio: ['pipe', 'pipe', 'pipe'] });
            let ev = null;
            let ok = false;
            try {
              const d = JSON.parse(r.out);
              ok = !!d.success;
              ev = d.result?.events?.events?.[0] ?? null;
            } catch {}
            if (!ok) {
              rows[key] = { job: key, state: 'ok', why: 'Workers Logs unreadable' };
              continue;
            }
            const src = ev?.source ?? {};
            if (!ev) rows[key] = { job: key, state: 'stale', why: lastSlot ? `no run in Workers Logs since its ${iso(lastSlot)} slot (cron ${expr} UTC)` : `no run in Workers Logs for ${Math.round((NOW - from) / 60_000)} min (cron ${expr} UTC)` };
            else if (Number(src.status) >= 500 || src.error) rows[key] = { job: key, state: 'red', why: `last run ${src.status ?? src.error} at ${iso(ev.timestamp)} (cron ${expr} UTC)` };
            else rows[key] = { job: key, state: 'ok', why: '' };
          }
        }
      }
    } finally {
      rmSync(hdr, { force: true });
    }
  } else log('cloud-skipped', 'workers', 'no CLOUDFLARE_API_TOKEN / account id in the environment');
  sup.cloud = { jobs, rows };
  sup.cloudAt = iso(NOW);
  const bad = Object.values(rows).filter((x) => x.state !== 'ok');
  log('cloud', null, `${Object.keys(rows).length} cloud schedule(s) checked, ${bad.length} not ok${bad.length ? `: ${bad.map((x) => x.job).join(', ')}` : ''}`);
  return sup.cloud;
}

/**
 * Whether this tick may write the beat (2026-11-07, Abdout: "match the app's ticks"). mkan's Neon
 * sleeps after 5 quiet minutes, so the beat lands only in the first 5 minutes after the app's own
 * ticks, when the database is awake anyway: every quarter hour by day (07:00–21:45 here, the
 * Worker's `15,30,45 5-19` UTC outbox plus its hourly tick) and on the hour at night. Once a beat
 * is `beat_minutes` old (75), any tick writes one, so a missed window never leaves it stale.
 * The watchdog calls the beat stale after 80 minutes (ops/watchdog BEAT_STALE_SEC).
 */
function beatDue(lastBeatAt, now, cfg = {}) {
  if (!lastBeatAt) return true;
  const since = now - lastBeatAt;
  if (since >= (cfg.beat_minutes ?? 75) * 60_000) return true;
  const at = new Date(now);
  const day = at.getHours() >= 7 && at.getHours() <= 21;
  const inWindow = at.getMinutes() % (day ? 15 : 60) < 5;
  return inWindow && since >= 10 * 60_000;
}

// ── beat: the watchdog outside the Mac reads this ─────────────────────────────────────────────
function beat(jobs, hermes, sup, mode, log, cfg) {
  if (!beatDue(sup.beatAt ? t(sup.beatAt) : 0, NOW, cfg)) return;
  const due = {};
  for (const [name, j] of Object.entries(jobs)) {
    if (name.startsWith('$') || !j.deadline_hours) continue;
    const sched = scheduleOf(name, j, hermes[name]);
    if (!sched?.match) continue;
    const st = stateOf(name) ?? {};
    const lastOk = t(st.last_ok);
    const slot = prevFire(sched.match, NOW);
    const next = nextFire(sched.match, NOW);
    const dueBy = (lastOk >= slot ? next : slot) + j.deadline_hours * 3_600_000;
    due[name] = { lastOk: iso(lastOk), dueBy: iso(dueBy) };
  }
  if (!Object.keys(due).length) return;
  const value = { at: iso(NOW), jobs: due };
  if (!mode.live && !(cfg.live_owners ?? []).length && !mode.heal && !mode.alerts && !flag('--beat')) {
    sup.beatAt = iso(NOW);
    sup.beat = value;
    return log('would-beat', null, `${Object.keys(due).length} deadline job(s)`);
  }
  const env = (() => {
    try {
      return readFileSync(join(HOME, 'mkan', '.env'), 'utf8');
    } catch {
      return '';
    }
  })();
  const url = (/^DATABASE_URL=(.*)$/m.exec(env)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  if (!url) return log('beat-skipped', null, 'no mkan DATABASE_URL');
  const host = new URL(url).hostname;
  const body = JSON.stringify({
    query: `insert into "WaState" ("key", "value", "updatedAt") values ($1, $2::jsonb, now()) on conflict ("key") do update set "value" = excluded."value", "updatedAt" = now()`,
    params: ['mac-beat', JSON.stringify(value)],
  });
  // The connection string goes in a header file (0600), never on a command line `ps` can read.
  const hdr = join(LOCK_DIR, `beat-headers.${process.pid}`);
  writeFileSync(hdr, `Neon-Connection-String: ${url}\nContent-Type: application/json\n`, { mode: 0o600 });
  const r = sh('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '15', '-X', 'POST', `https://${host}/sql`, '-H', `@${hdr}`, '--data-binary', '@-'], { input: body, stdio: ['pipe', 'pipe', 'pipe'] });
  rmSync(hdr, { force: true });
  if (r.out === '200') {
    sup.beatAt = iso(NOW);
    sup.beat = value;
  } else log('beat-failed', null, `HTTP ${r.out || r.err}`);
}

// ── install ──────────────────────────────────────────────────────────────────────────────────
function install() {
  const label = 'com.databayt.supervisor';
  // The stable Homebrew link, not the versioned Cellar path a node upgrade removes.
  const node = existsSync('/opt/homebrew/bin/node') ? '/opt/homebrew/bin/node' : process.execPath;
  const p = join(HOME, 'Library', 'LaunchAgents', `${label}.plist`);
  const logs = join(HOME, '.claude', 'logs');
  mkdirSync(logs, { recursive: true });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>${node}</string><string>${join(KUN, '.claude', 'scripts', 'supervise.mjs')}</string></array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${join(logs, 'supervise-launchd.out')}</string>
  <key>StandardErrorPath</key><string>${join(logs, 'supervise-launchd.err')}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${PATH}</string></dict>
</dict>
</plist>
`;
  writeFileSync(`${p}.tmp`, xml);
  renameSync(`${p}.tmp`, p);
  sh('launchctl', ['bootout', `gui/${UID}/${label}`]);
  const r = sh('launchctl', ['bootstrap', `gui/${UID}`, p]);
  console.log(r.ok ? `installed ${label} (every 5 min + at load)` : `! bootstrap: ${r.err}`);
}

main();
