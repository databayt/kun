// The missing executable half of the connection ritual.
//
// .claude/skills/facebook/SKILL.md prescribes: post → read the post back →
// delete it → confirm it is gone. Four steps, and until now only three of them
// could be run. `deleteFacebookPost` has existed in src/lib/facebook.ts since
// the transport was written and had ZERO callers anywhere in the repo — no
// route, no script, no test — so "retract the test post" was doctrine with no
// way to obey it. A verification post that cannot be retracted is not
// verification; it is publishing.
//
// TypeScript rather than the .mjs the rest of scripts/ uses, deliberately: the
// point is to exercise the SAME deleteFacebookPost the engine would use, and a
// .mjs cannot import TS. That is also why post-to-facebook.mjs speaks raw Graph
// — it predates this need. Do not add a second delete implementation.
//
//   pnpm tsx scripts/retract-facebook-post.ts --product mkan --id <externalId>
//   pnpm tsx scripts/retract-facebook-post.ts --product mkan --id <id> --read-only
//
// --read-only performs step 2 alone (read back, print the permalink) so a post
// can be inspected before anyone decides to remove it.

import dotenv from "dotenv";
import {
  deleteFacebookPost,
  getFacebookConfig,
} from "../src/lib/facebook";

dotenv.config({ quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

// Narrows at the call site — control-flow narrowing on a module-level const
// does not survive into the closure below, and threading `string | undefined`
// through every call just to re-assert it is noise.
function requireArg(name: string): string {
  const value = arg(name);
  if (!value) {
    console.error(
      "Usage: tsx scripts/retract-facebook-post.ts --product <brand> --id <externalId> [--read-only]",
    );
    process.exit(1);
  }
  return value;
}

const product = requireArg("product");
const externalId = requireArg("id");
const readOnly = process.argv.includes("--read-only");

// Graph takes the token as a query parameter, so the request URL is a secret.
// Print the message, never the URL — the same rule post-to-facebook.mjs states.
async function readBack(
  id: string,
  token: string,
): Promise<{ ok: boolean; message?: string; permalink?: string; error?: string }> {
  const url = new URL(`https://graph.facebook.com/v25.0/${id}`);
  url.searchParams.set("fields", "message,permalink_url,created_time");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = (await res.json().catch(() => null)) as {
    message?: string;
    permalink_url?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, message: body?.message, permalink: body?.permalink_url };
}

async function main(): Promise<void> {
  const { token, pageId } = await getFacebookConfig(product);
  if (!token || !pageId) {
    console.error(`No env pair for ${product} — check FACEBOOK_PAGE_*_${product.toUpperCase()}.`);
    process.exit(1);
  }

  const before = await readBack(externalId, token);
  if (!before.ok) {
    console.error(`Cannot read ${externalId} back: ${before.error}`);
    process.exit(1);
  }
  console.log(`live      ${before.permalink ?? "(no permalink)"}`);
  console.log(`message   ${(before.message ?? "").slice(0, 80)}…`);

  if (readOnly) {
    console.log(JSON.stringify({ ok: true, externalId, deleted: false, permalink: before.permalink }));
    process.exit(0);
  }

  const gone = await deleteFacebookPost(externalId, product);
  if (!gone.ok) {
    console.error(`Delete failed: ${gone.error}`);
    process.exit(1);
  }

  // The delete call returning ok is not proof. A post can be hidden rather than
  // removed, and the only honest check is that reading it back now fails.
  const after = await readBack(externalId, token);
  if (after.ok) {
    console.error("Delete reported success but the post is STILL READABLE — not gone.");
    process.exit(1);
  }
  console.log(`retracted confirmed gone (${after.error})`);
  console.log(JSON.stringify({ ok: true, externalId, deleted: true }));
}

main();
