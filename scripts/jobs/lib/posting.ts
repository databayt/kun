// ── The posting itself: fetched at send time, text only ──────────────────────
//
// Shared by wave.ts (letters), ats.ts (forms) and tailor.ts (CVs). Moved out of
// wave.ts on 2026-10-06 so tailor.ts can use it without a wave ↔ tailor cycle.

import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const splitName = (name: string): { role: string; company: string } => {
  const at = name.lastIndexOf(" @ ");
  return at > -1
    ? { role: name.slice(0, at), company: name.slice(at + 3) }
    : { role: name, company: name };
};

export async function postingText(
  url: string | undefined,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128 Safari/537.36",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;

    // Official job notices are often PDFs (CIMERWA's are): read them with
    // pdftotext rather than as bytes.
    if (/pdf/i.test(res.headers.get("content-type") ?? "") || /\.pdf($|\?)/i.test(url)) {
      const tmp = join(tmpdir(), `posting-${process.pid}-${Date.now()}.pdf`);
      writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
      const out = spawnSync("pdftotext", ["-layout", tmp, "-"], { encoding: "utf-8", timeout: 60_000 });
      rmSync(tmp, { force: true });
      return out.status === 0 ? out.stdout.replace(/\s+/g, " ").trim() : null;
    }

    const html = await res.text();
    // Addresses that only live in a mailto: link, or are split for line
    // breaking with <wbr>, still count as "on the posting".
    const mailto = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decodeURIComponent(m[1]));
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
  } catch {
    return null;
  }
}

