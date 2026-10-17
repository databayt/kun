// ── Resolve: give every TO_APPLY card a way to apply ─────────────────────────
//
//   pnpm jobs:resolve            dry run — what each posting yields
//   pnpm jobs:resolve --apply    write applyEmail / applyUrl + channel
//
// On 2026-10-10, 194 of 195 TO_APPLY cards carried only the job-board link
// (MyJobMag, jobinrwanda, Himalayas, …): no address, no form, so the wave
// skipped every one and the loop sent nothing. This opens each posting and
// takes the route it names — an address in the application section, a hosted
// Greenhouse/Lever/Ashby form, or the employer's own page — so the wave and
// the ATS lane can pick the card up the next morning.

import { listBoard, noteRow, patchRow, type BoardRow } from "./board";

const APPLY = process.argv.includes("--apply");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128 Safari/537.36";

// Addresses that belong to the job board, a tracker or a template — never the employer.
const JUNK_EMAIL =
  /myjobmag|jobinrwanda|weworkremotely|himalayas|jobicy|remoteok|indeed|linkedin|tinyboards|norrsken|hotline|^help|^support@|privacy|noreply|no-reply|donotreply|example\.|sentry|wixpress|cloudflare|\.(png|jpe?g|gif|webp|svg)$/i;
const PLATFORM_HOSTS =
  /mercor\.com|micro1\.ai|mindrift|toloka|alignerr|outlier\.ai|invisible|turing\.com|upwork\.com|contra\.com|mostaql\.com|andela\.com|arc\.dev|toptal\.com/i;
const BOARD_HOSTS =
  /myjobmag|jobinrwanda|weworkremotely|himalayas|jobicy|remoteok|indeed|linkedin|facebook|twitter|x\.com|whatsapp|t\.me|google\.com\/maps|instagram|youtube/i;

type Route =
  | { kind: "email"; email: string }
  | { kind: "ats"; url: string }
  | { kind: "portal"; url: string; platform: boolean }
  | { kind: "none"; why: string };

/// Cloudflare email protection: hex, first byte is the XOR key.
const cfDecode = (hex: string): string => {
  const k = parseInt(hex.slice(0, 2), 16);
  let s = "";
  for (let i = 2; i < hex.length; i += 2)
    s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
  return s;
};

const emailsIn = (html: string): string[] => {
  const found = [
    ...[...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) =>
      decodeURIComponent(m[1]),
    ),
    ...[...html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)].map((m) =>
      cfDecode(m[1]),
    ),
    ...(html
      .replace(/<[^>]+>/g, " ")
      .match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []),
  ];
  return [
    ...new Set(
      found.map((e) =>
        e
          .trim()
          .replace(/[.,;:)]+$/, "")
          .toLowerCase(),
      ),
    ),
  ].filter((e) => !JUNK_EMAIL.test(e));
};

/// A Greenhouse posting becomes the embed form the ATS submitter fills.
function atsUrl(u: string): string | null {
  const gh =
    u.match(
      /greenhouse\.io\/embed\/job_app\?[^"'\s]*for=([\w-]+)[^"'\s]*token=(\d+)/,
    ) ?? u.match(/greenhouse\.io\/([\w-]+)\/jobs\/(\d+)/);
  if (gh)
    return `https://job-boards.greenhouse.io/embed/job_app?for=${gh[1]}&token=${gh[2]}`;
  const ashby = u.match(/jobs\.ashbyhq\.com\/[\w.-]+\/[0-9a-f-]{36}/);
  if (ashby) return `https://${ashby[0]}/application`;
  const lever = u.match(/jobs\.lever\.co\/[\w.-]+\/[0-9a-f-]{36}/);
  if (lever) return `https://${lever[0]}/apply`;
  return null;
}

async function get(
  url: string,
): Promise<{ status: number; html: string; url: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30_000),
  });
  return {
    status: res.status,
    html: res.ok ? await res.text() : "",
    url: res.url,
  };
}

/// Where a board's own "apply" redirect lands (MyJobMag's /apply-now/<id>).
async function landing(url: string): Promise<string> {
  try {
    return (
      await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(30_000),
      })
    ).url;
  } catch {
    return url;
  }
}

async function resolve(row: BoardRow): Promise<Route> {
  const jobUrl = row.jobUrl?.primaryLinkUrl;
  if (!jobUrl) return { kind: "none", why: "no job link" };
  if (PLATFORM_HOSTS.test(jobUrl))
    return { kind: "portal", url: jobUrl, platform: true };
  let page;
  try {
    page = await get(jobUrl);
  } catch (e) {
    return {
      kind: "none",
      why: `fetch failed: ${(e as Error).message.slice(0, 60)}`,
    };
  }
  if (!page.html) return { kind: "none", why: `HTTP ${page.status}` };
  // Tenders and consultancies need a bid, not a cover letter.
  if (/tender|consultancy|\bRFP\b|\bbid\b/i.test(row.name)) return { kind: "none", why: "tender — bid, not a letter" };
  if (
    /no longer (accepting|available)|job (has )?expired|position (has been )?filled/i.test(
      page.html,
    )
  )
    return { kind: "none", why: "posting closed" };

  // MyJobMag and most African boards put the route under "Method of Application".
  const i = page.html.search(/Method of Application|How to Apply/i);
  const section = i > -1 ? page.html.slice(i, i + 4000) : "";
  const scope = section || page.html;

  const email = emailsIn(scope)[0];
  if (email) return { kind: "email", email };

  const hrefs = [...scope.matchAll(/href="([^"]+)"/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  const ats = hrefs.map(atsUrl).find(Boolean);
  if (ats) return { kind: "ats", url: ats };

  // A board's own apply redirect, or the employer's careers page.
  const applyLink = hrefs.find((h) =>
    /apply-now|\/apply\b|careers|jobs\.|recruit|workable|bamboohr|smartrecruiters|rippling|breezy|forms\.gle|docs\.google\.com\/forms/i.test(
      h,
    ),
  );
  if (applyLink) {
    const abs = new URL(applyLink, page.url).toString();
    const dest = /apply-now/.test(abs) ? await landing(abs) : abs;
    if (/job_not_found|not[-_]found|expired/i.test(dest)) return { kind: "none", why: "posting closed" };
    const a = atsUrl(dest);
    if (a) return { kind: "ats", url: a };
    if (!BOARD_HOSTS.test(new URL(dest).hostname))
      return { kind: "portal", url: dest, platform: PLATFORM_HOSTS.test(dest) };
  }
  if (!section) {
    const anyAts = [...page.html.matchAll(/href="([^"]+)"/gi)]
      .map((m) => atsUrl(m[1].replace(/&amp;/g, "&")))
      .find(Boolean);
    if (anyAts) return { kind: "ats", url: anyAts };
  }
  return { kind: "none", why: "posting names no address or form" };
}

async function main(): Promise<void> {
  const rows = (await listBoard()).filter(
    (r) =>
      r.applicationStatus === "TO_APPLY" &&
      !r.applyEmail &&
      !r.applyPhone &&
      !r.applyUrl,
  );
  console.log(
    `${APPLY ? "" : "DRY RUN — "}${rows.length} TO_APPLY card(s) without a route\n`,
  );
  const tally: Record<string, number> = {};
  for (const row of rows) {
    const r = await resolve(row);
    tally[r.kind] = (tally[r.kind] ?? 0) + 1;
    const what =
      r.kind === "email"
        ? r.email
        : r.kind === "none"
          ? `— ${r.why}`
          : r.url.slice(0, 90);
    console.log(
      `  ${r.kind.padEnd(6)} ${row.name.slice(0, 55).padEnd(55)} ${what}`,
    );
    if (!APPLY || r.kind === "none") continue;
    const fields =
      r.kind === "email"
        ? { applyEmail: r.email, channel: "EMAIL" }
        : r.kind === "ats"
          ? { applyUrl: r.url, channel: "ATS" }
          : { applyUrl: r.url, channel: r.platform ? "PLATFORM" : "PORTAL" };
    await patchRow(row.id, fields);
    await noteRow(
      row.id,
      `route resolved from the posting: ${r.kind} ${r.kind === "email" ? r.email : r.url}`,
    );
  }
  console.log(
    `\n${Object.entries(tally)
      .map(([k, n]) => `${n} ${k}`)
      .join(" · ")}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
