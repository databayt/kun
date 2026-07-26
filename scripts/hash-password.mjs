#!/usr/bin/env node

/**
 * Generate a contributor password hash for the kun login.
 *
 *   node scripts/hash-password.mjs abdout            # prompts, input hidden
 *   printf 'pw\n' | node scripts/hash-password.mjs abdout   # piped (CI/testing)
 *
 * The password is read from stdin, never argv, so it stays out of shell
 * history and out of the process table. It is never written to disk or echoed.
 *
 * The resulting hash is safe to paste into Vercel env. It is NOT safe to commit
 * to this repo, which is public — a hash allows offline brute-force.
 */

import crypto from "node:crypto";

const SCHEME = "scrypt";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MIN_LENGTH = 12;

// Must stay in sync with src/lib/password.ts — same scheme, same params.
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: 256 * N * R,
  });
  return [SCHEME, N, R, P, salt.toString("hex"), derived.toString("hex")].join(
    "$",
  );
}

/** Read every line of piped stdin up front, so both prompts can be served. */
function readPipedLines() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.split(/\r?\n/)));
    process.stdin.on("error", reject);
  });
}

/**
 * Prompt on a TTY with echo suppressed.
 *
 * Raw mode rather than overriding readline's internal _writeToOutput: that
 * trick leaves the promise unsettled under a pty, which made the script hang
 * instead of printing a hash.
 */
function promptHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buffer = "";
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      resolve(buffer);
    };

    // Raw mode delivers whatever arrived: one character when someone types, but
    // the whole string when they paste — and pasting out of a password manager
    // is the normal case. Walk the chunk instead of switching on it, or a pasted
    // password never matches Enter and the prompt hangs forever.
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return done();
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          buffer = buffer.slice(0, -1);
          continue;
        }
        // Skip other control characters (arrow keys, escape sequences).
        if (ch >= " ") buffer += ch;
      }
    };
    stdin.on("data", onData);
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const id = (process.argv[2] ?? "").trim().toLowerCase();
if (!id) {
  console.error("Usage: node scripts/hash-password.mjs <contributor-id>");
  console.error("  e.g. node scripts/hash-password.mjs abdout");
  process.exit(1);
}

const varName = `AUTH_PASSWORD_HASH_${id.toUpperCase()}`;

function assertStrong(password) {
  if (password.length < MIN_LENGTH) {
    fail(
      `Refusing: ${password.length} characters. This hash may end up somewhere ` +
        `readable, so offline brute-force is the threat model — use ${MIN_LENGTH}+.`,
    );
  }
}

let password;
if (process.stdin.isTTY) {
  password = await promptHidden(`Password for "${id}": `);
  // Length before confirmation — no point making someone type a doomed
  // password twice before telling them it's too short.
  assertStrong(password);
  const confirm = await promptHidden("Confirm: ");
  if (password !== confirm) fail("Passwords did not match.");
} else {
  // Piped: first line is the password. No confirmation — that guard exists to
  // catch human typos, and a pipe has none to catch.
  const [first] = await readPipedLines();
  password = first ?? "";
  assertStrong(password);
}

console.log(`\n${varName}=${hashPassword(password)}\n`);
console.log("Set it in production with:");
console.log(`  vercel env add ${varName} production\n`);
console.log(
  "Paste the value after the '=' when prompted. Do not commit it — this repo is public.",
);
