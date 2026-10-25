// ── The posting itself: fetched at send time, text only ──────────────────────
//
// Shared by wave.ts (letters), ats.ts (forms) and tailor.ts (CVs). Moved out of
// wave.ts on 2026-10-06 so tailor.ts can use it without a wave ↔ tailor cycle.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DATA } from "./paths.mjs";

export const splitName = (name: string): { role: string; company: string } => {
  const at = name.lastIndexOf(" @ ");
  return at > -1
    ? { role: name.slice(0, at), company: name.slice(at + 3) }
    : { role: name, company: name };
};

// Every posting read is kept for a week. Job boards that answered the wave at
// 07:00 often 403 the same bot by the 10:00 send — without this the send gate
// held every card it had just verified as "posting unreachable" (2026-10-15:
// 3 of 3 queued). A failed fetch falls back to what the wave read.
const CACHE_DIR = join(DATA, ".state", "postings");
const CACHE_TTL_MS = 7 * 86_400_000;
const cacheFile = (url: string) =>
  join(CACHE_DIR, `${createHash("sha1").update(url).digest("hex")}.txt`);

export async function postingText(
  url: string | undefined,
): Promise<string | null> {
  if (!url) return null;
  const text = await fetchPostingText(url);
  const file = cacheFile(url);
  if (text === GONE) return null; // a closed posting never falls back
  if (text) {
    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(file, text);
    } catch {}
    return text;
  }
  try {
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_TTL_MS)
      return readFileSync(file, "utf-8");
  } catch {}
  return null;
}

const GONE = Symbol("gone");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128 Safari/537.36";

async function fetchPostingText(
  url: string,
): Promise<string | null | typeof GONE> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404 || res.status === 410) return GONE;
    // MyJobMag's Cloudflare challenges Node's TLS fingerprint but lets curl
    // through (2026-10-25: 28 cards held as "posting unreachable" / "recipient
    // not on the posting" while the page was plainly up).
    if (res.status === 403 || res.status === 503) return curlText(url);
    if (!res.ok) return null;

    // Official job notices are often PDFs (CIMERWA's are): read them with
    // pdftotext rather than as bytes.
    if (
      /pdf/i.test(res.headers.get("content-type") ?? "") ||
      /\.pdf($|\?)/i.test(url)
    ) {
      const tmp = join(tmpdir(), `posting-${process.pid}-${Date.now()}.pdf`);
      writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
      const out = spawnSync("pdftotext", ["-layout", tmp, "-"], {
        encoding: "utf-8",
        timeout: 60_000,
      });
      rmSync(tmp, { force: true });
      return out.status === 0 ? out.stdout.replace(/\s+/g, " ").trim() : null;
    }

    return htmlText(await res.text());
  } catch {
    return null;
  }
}

function htmlText(html: string): string {
  // Addresses that only live in a mailto: link, or are split for line
  // breaking with <wbr>, still count as "on the posting".
  const mailto = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) =>
    decodeURIComponent(m[1]),
  );
  return (
    html
      .replace(/<wbr\s*\/?>|<\/wbr>/gi, "")
      .replace(
        /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g,
        " ",
      )
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;?/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .split(/Similar jobs/i)[0]
      .trim() + (mailto.length ? ` ${[...new Set(mailto)].join(" ")}` : "")
  );
}

/// A page that a challenge blocks for fetch() but serves to curl.
function curlText(url: string): string | null | typeof GONE {
  const out = spawnSync(
    "curl",
    ["-sL", "--max-time", "30", "-A", UA, "-w", "\\n%{http_code}", url],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 },
  );
  if (out.status !== 0) return null;
  const cut = out.stdout.lastIndexOf("\n");
  const code = Number(out.stdout.slice(cut + 1));
  if (code === 404 || code === 410) return GONE;
  if (code !== 200) return null;
  const html = out.stdout.slice(0, cut);
  if (/just a moment|cf-chl/i.test(html)) return null;
  return htmlText(html);
}
