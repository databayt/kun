// ── Website Leads: businesses with a missing or tired website ───────────────
//
//   pnpm sales:leads discover [--city kigali|nairobi|lagos|khartoum|port-sudan|all]
//   pnpm sales:leads audit    [--city …] [--limit n]     fetch each site, score the need
//   pnpm sales:leads push     [--city …] [--tier A|B|C] [--apply]   → Twenty "Website Leads"
//   pnpm sales:leads gap                                  what the board holds, by tier/finding
//
// Databayt's outbound lane (Abdout, 2026-10-03). Discovery is OpenStreetMap
// through Overpass — open data, ODbL, no scraping of anyone's ToS. Google Maps
// is deliberately absent: its terms forbid it. Data lives in jobs/leads/
// (gitignored); the board is the working surface. Push is dry-run unless
// --apply, dedups on `osm:<type>/<id>`, and never overwrites a card a human
// has moved past AUDITED.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { call } from "../jobs/board";

const DIR = "jobs/leads";
const MIRRORS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const UA = "databayt-leads/1.0 (+https://databayt.org)";

/// south, west, north, east
const CITIES: Record<
  string,
  { bbox: [number, number, number, number]; country: string; label: string }
> = {
  kigali: {
    bbox: [-2.05, 29.95, -1.85, 30.25],
    country: "RWANDA",
    label: "Kigali",
  },
  nairobi: {
    bbox: [-1.45, 36.65, -1.16, 37.1],
    country: "KENYA",
    label: "Nairobi",
  },
  lagos: { bbox: [6.39, 3.1, 6.7, 3.7], country: "NIGERIA", label: "Lagos" },
  khartoum: {
    bbox: [15.4, 32.4, 15.75, 32.7],
    country: "SUDAN",
    label: "Khartoum",
  },
  "port-sudan": {
    bbox: [19.5, 37.1, 19.7, 37.3],
    country: "SUDAN",
    label: "Port Sudan",
  },
};

/// The businesses that buy websites. Government, embassies, banks and
/// multinationals are out: they tender, and a cold message never lands.
const KINDS = `["amenity"~"^(restaurant|cafe|fast_food|bar|school|college|kindergarten|clinic|dentist|doctors|pharmacy|driving_school|language_school)$"]`;
const TOURISM = `["tourism"~"^(hotel|guest_house|hostel|apartment|motel)$"]`;

interface Lead {
  fingerprint: string;
  name: string;
  city: string;
  country: string;
  sector: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  audit?: Audit;
  pushedId?: string;
}

interface Audit {
  at: string;
  finding: string;
  score: number;
  notes: string[];
  email?: string;
}

const args = process.argv.slice(2);
const verb = args[0] ?? "gap";
const opt = (f: string) =>
  args.includes(f) ? args[args.indexOf(f) + 1] : undefined;
const cityArg = opt("--city") ?? "all";
const cities = cityArg === "all" ? Object.keys(CITIES) : cityArg.split(",");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fileOf = (city: string) => `${DIR}/${city}.json`;
function load(city: string): Record<string, Lead> {
  return existsSync(fileOf(city))
    ? JSON.parse(readFileSync(fileOf(city), "utf-8"))
    : {};
}
function save(city: string, leads: Record<string, Lead>) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(fileOf(city), JSON.stringify(leads, null, 2) + "\n");
}

// ── discover ─────────────────────────────────────────────────────────────────

async function overpass(
  q: string,
): Promise<{ type: string; id: number; tags: Record<string, string> }[]> {
  for (const m of MIRRORS) {
    try {
      const res = await fetch(m, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(150_000),
      });
      const text = await res.text();
      if (!text.startsWith("{")) continue; // busy mirror answers HTML
      return JSON.parse(text).elements ?? [];
    } catch {
      // next mirror
    }
  }
  throw new Error("every Overpass mirror refused — try again later");
}

function sectorOf(t: Record<string, string>): string {
  const a = t.amenity ?? "";
  if (t.tourism) return "HOSPITALITY";
  if (/restaurant|cafe|fast_food|bar/.test(a)) return "FOOD";
  if (/school|college|kindergarten/.test(a)) return "EDUCATION";
  if (/clinic|dentist|doctors|pharmacy/.test(a)) return "HEALTH";
  if (t.office === "ngo") return "NGO";
  if (t.shop) return "RETAIL";
  if (t.office) return "PROFESSIONAL";
  return "OTHER";
}

async function discover(city: string) {
  const c = CITIES[city];
  if (!c)
    throw new Error(
      `unknown city ${city} — one of ${Object.keys(CITIES).join(", ")}`,
    );
  const bb = c.bbox.join(",");
  // With a site (to audit) and without one but reachable (NO_WEBSITE leads).
  const q = `[out:json][timeout:120];(
    nwr["name"]${KINDS}(${bb}); nwr["name"]${TOURISM}(${bb});
    nwr["name"]["office"~"^(company|ngo|lawyer|accountant|estate_agent|travel_agent|insurance|consulting)$"](${bb});
    nwr["name"]["shop"]["website"](${bb});
  ); out tags center 4000;`;
  const els = await overpass(q);
  const leads = load(city);
  let added = 0;
  for (const e of els) {
    const t = e.tags;
    const website = t.website ?? t["contact:website"] ?? null;
    const phone = t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? null;
    const email = t.email ?? t["contact:email"] ?? null;
    if (!website && !phone && !email) continue; // nobody to talk to
    // Chains and multinationals (OSM `brand`) buy from head office, never from
    // a cold message — Shoprite, DHL and Spur were the first false "leads".
    if (t.brand || t["brand:wikidata"] || /\b(plc|group|international)\b/i.test(t.operator ?? "")) {
      delete leads[`osm:${e.type}/${e.id}`];
      continue;
    }
    const fp = `osm:${e.type}/${e.id}`;
    const prev = leads[fp];
    leads[fp] = {
      ...prev,
      fingerprint: fp,
      name: t.name,
      city: c.label,
      country: c.country,
      sector: sectorOf(t),
      website,
      phone,
      email: email ?? prev?.email ?? null,
      address:
        [t["addr:street"], t["addr:suburb"] ?? t["addr:district"]]
          .filter(Boolean)
          .join(", ") || null,
    };
    if (!prev) added++;
  }
  save(city, leads);
  const all = Object.values(leads);
  console.log(
    `${c.label.padEnd(11)} ${String(els.length).padStart(4)} osm · ${all.length} leads (+${added}) · ${all.filter((l) => l.website).length} with site · ${all.filter((l) => !l.website).length} without`,
  );
}

// ── audit ────────────────────────────────────────────────────────────────────

const SOCIAL =
  /(facebook|fb|instagram|linkedin|twitter|x|tiktok|wa\.me|whatsapp)\.(com|me)/i;

async function auditOne(l: Lead): Promise<Audit> {
  const at = new Date().toISOString();
  if (!l.website)
    return {
      at,
      finding: "NO_WEBSITE",
      score: 90,
      notes: ["no website on record"],
    };
  if (SOCIAL.test(l.website))
    return {
      at,
      finding: "SOCIAL_ONLY",
      score: 85,
      notes: [`web presence is a social page: ${l.website}`],
    };
  const url = /^https?:\/\//i.test(l.website)
    ? l.website
    : `http://${l.website}`;
  const notes: string[] = [];
  let score = 0;
  const findings: [string, number][] = [];
  const t0 = Date.now();
  let res: Response;
  let html = "";
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    html = await res.text();
  } catch (err) {
    return {
      at,
      finding: "BROKEN",
      score: 80,
      notes: [`unreachable: ${(err as Error).message.slice(0, 80)}`],
    };
  }
  const ms = Date.now() - t0;
  const kb = Math.round(html.length / 1024);
  notes.push(`HTTP ${res.status} in ${ms} ms, ${kb} KB HTML → ${res.url}`);
  // 401/403/429/503 is a bot wall (Cloudflare, WAF), not a dead site — a real
  // visitor gets through. Only 404/410/5xx-other count as broken.
  if ([401, 403, 406, 429, 503].includes(res.status)) {
    notes.push("blocked the automated check — judge by hand");
    return { at, finding: "OK", score: 5, notes };
  }
  if (res.status >= 400) return { at, finding: "BROKEN", score: 80, notes };
  if (
    /domain (is )?for sale|parked|this domain|account suspended|default web page|coming soon|under construction/i.test(
      html.slice(0, 20_000),
    )
  ) {
    notes.push("parked / suspended / placeholder page");
    return { at, finding: "BROKEN", score: 80, notes };
  }
  if (!res.url.startsWith("https://"))
    (findings.push(["NO_HTTPS", 25]), notes.push("served without HTTPS"));
  if (!/<meta[^>]+name=["']?viewport/i.test(html))
    (findings.push(["NOT_MOBILE", 30]),
      notes.push("no viewport meta — not mobile-ready"));
  const years = [
    ...html.matchAll(
      /(?:©|&copy;|copyright)\s*(?:[^<]{0,40}?)((?:19|20)\d\d)(?:\s*[-–]\s*((?:19|20)\d\d))?/gi,
    ),
  ].map((m) => Number(m[2] ?? m[1]));
  const year = years.length ? Math.max(...years) : null;
  if (year) notes.push(`copyright ${year}`);
  const stale = year !== null && year <= new Date().getFullYear() - 3;
  const gen = html.match(
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i,
  )?.[1];
  if (gen) notes.push(`generator: ${gen}`);
  const jq = html.match(/jquery[.-]?(\d)\.(\d+)/i);
  if (jq) notes.push(`jQuery ${jq[1]}.${jq[2]}`);
  const oldStack =
    (jq && Number(jq[1]) < 3) ||
    /WordPress [1-4]\.|Joomla! [1-3]\.|Drupal [5-7]|FrontPage|Dreamweaver|iWeb/i.test(
      gen ?? "",
    ) ||
    /<table[^>]+(width|bgcolor)=|<font\b|<marquee|\.swf\b/i.test(html);
  if (stale || oldStack) findings.push(["OUTDATED", 20]);
  if (ms > 4000)
    (findings.push(["SLOW", 15]), notes.push("slow first response"));
  if (kb < 3) notes.push("almost empty page");
  score = Math.min(
    100,
    findings.reduce((s, [, w]) => s + w, 0) + (stale ? 10 : 0),
  );
  const email = html.match(
    /mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  )?.[1];
  const order = ["NOT_MOBILE", "NO_HTTPS", "OUTDATED", "SLOW"];
  const finding =
    findings.sort(
      (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
    )[0]?.[0] ?? "OK";
  return { at, finding, score, notes, ...(email ? { email } : {}) };
}

async function audit(city: string, limit: number) {
  const leads = load(city);
  // --reaudit BROKEN,OK re-runs those findings after an audit-rule change.
  const again = new Set((opt("--reaudit") ?? "").split(",").filter(Boolean));
  const todo = Object.values(leads)
    .filter((l) => !l.audit || again.has(l.audit.finding))
    .slice(0, limit);
  const tally: Record<string, number> = {};
  for (const l of todo) {
    l.audit = await auditOne(l);
    if (l.audit.email && !l.email) l.email = l.audit.email;
    tally[l.audit.finding] = (tally[l.audit.finding] ?? 0) + 1;
    if (l.website) await sleep(500);
  }
  save(city, leads);
  console.log(
    `${CITIES[city].label.padEnd(11)} audited ${todo.length} · ${Object.entries(
      tally,
    )
      .map(([k, n]) => `${k} ${n}`)
      .join(" · ")}`,
  );
}

// ── tier + offer ─────────────────────────────────────────────────────────────

/// Not a buyer: places of worship, private homes, and multinationals OSM
/// carries without a brand tag (Maersk in Port Sudan, 2026-10-03).
const NOT_A_BUYER =
  /mosque|masjid|مسجد|جامع|church|كنيسة|\(home\)|\bhome\)|maersk|dhl|unicef|undp|\bwfp\b|embassy|سفارة/i;

function tierOf(l: Lead): "A" | "B" | "C" {
  // A church or mosque that runs a school is a Hogwarts prospect, not noise.
  if (NOT_A_BUYER.test(l.name) && !/school|academy|nursery|college|مدرسة|روضة|أكاديمية/i.test(l.name)) return "C";
  const s = l.audit?.score ?? 0;
  const reachable = Boolean(l.phone || l.email);
  if (s >= 60 && reachable) return "A";
  if (s >= 30 && reachable) return "B";
  return "C";
}

function offerOf(l: Lead): string {
  if (l.sector === "FOOD") return "QR_ORDERING";
  if (l.sector === "EDUCATION") return "SCHOOL_SYSTEM";
  if (l.sector === "HOSPITALITY") return "BOOKING";
  if (!l.website || l.audit?.finding === "SOCIAL_ONLY") return "NEW_WEBSITE";
  return "REBRAND";
}

// ── push ─────────────────────────────────────────────────────────────────────

const PATH = "/rest/websiteLeads";

function linkOf(website: string | null): string | null {
  if (!website) return null;
  const first = website.split(/[;\s,]+/).find(Boolean) ?? "";
  try {
    const u = new URL(/^https?:/i.test(first) ? first : `http://${first}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

async function boardFingerprints(): Promise<
  Map<string, { id: string; stage: string | null }>
> {
  const out = new Map<string, { id: string; stage: string | null }>();
  let cursor: string | undefined;
  for (;;) {
    const page = await call<{
      data: {
        websiteLeads: {
          id: string;
          fingerprint: string | null;
          stage: string | null;
        }[];
      };
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
    }>(`${PATH}?limit=60${cursor ? `&starting_after=${cursor}` : ""}`);
    for (const r of page.data.websiteLeads)
      if (r.fingerprint) out.set(r.fingerprint, { id: r.id, stage: r.stage });
    if (!page.pageInfo?.hasNextPage || page.data.websiteLeads.length === 0)
      break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
}

async function push(
  city: string,
  tiers: Set<string>,
  apply: boolean,
  live: Map<string, { id: string; stage: string | null }>,
) {
  const leads = load(city);
  let created = 0;
  let skipped = 0;
  for (const l of Object.values(leads)) {
    if (!l.audit) continue;
    const tier = tierOf(l);
    if (!tiers.has(tier)) continue;
    if (live.has(l.fingerprint)) {
      skipped++;
      continue;
    }
    if (!apply) {
      created++;
      if (created <= 12)
        console.log(
          `  + [${tier} · ${l.audit.finding} · ${l.audit.score}] ${l.name} — ${l.sector} · ${l.website ?? l.phone}`,
        );
      continue;
    }
    const res = await call<{ data: { createWebsiteLead?: { id: string } } }>(
      PATH,
      {
        method: "POST",
        body: {
          name: l.name,
          stage: "AUDITED",
          sector: l.sector,
          country: l.country,
          city: l.city,
          // OSM website tags are free text ("www.x.com; www.y.com", spaces):
          // Twenty rejects an invalid link, so a bad one rides in the notes.
          ...(linkOf(l.website)
            ? {
                website: {
                  primaryLinkUrl: linkOf(l.website),
                  primaryLinkLabel: "",
                  secondaryLinks: [],
                },
              }
            : {}),
          auditFinding: l.audit.finding,
          auditScore: l.audit.score,
          auditNotes: {
            markdown: l.audit.notes.map((n) => `- ${n}`).join("\n"),
            blocknote: null,
          },
          offer: offerOf(l),
          tier,
          phone: l.phone,
          email: l.email,
          streetAddress: l.address,
          touchNumber: 0,
          source: "osm",
          fingerprint: l.fingerprint,
        },
      },
    );
    l.pushedId = res.data.createWebsiteLead?.id;
    live.set(l.fingerprint, { id: l.pushedId ?? "", stage: "AUDITED" });
    created++;
  }
  if (apply) save(city, leads);
  console.log(
    `${CITIES[city].label.padEnd(11)} ${apply ? "created" : "would create"} ${created} · ${skipped} already on the board`,
  );
}

// ── gap ──────────────────────────────────────────────────────────────────────

function gap() {
  for (const city of Object.keys(CITIES)) {
    const all = Object.values(load(city));
    if (!all.length) continue;
    const audited = all.filter((l) => l.audit);
    const by = (f: (l: Lead) => string) =>
      Object.entries(
        audited.reduce<Record<string, number>>(
          (a, l) => ((a[f(l)] = (a[f(l)] ?? 0) + 1), a),
          {},
        ),
      )
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(" · ");
    console.log(
      `${CITIES[city].label}: ${all.length} leads, ${audited.length} audited`,
    );
    if (audited.length) {
      console.log(`  tier    ${by(tierOf)}`);
      console.log(`  finding ${by((l) => l.audit!.finding)}`);
      console.log(`  pushed  ${all.filter((l) => l.pushedId).length}`);
    }
  }
}

async function main() {
  if (verb === "discover") for (const c of cities) await discover(c);
  else if (verb === "audit")
    for (const c of cities) await audit(c, Number(opt("--limit") ?? 400));
  else if (verb === "push") {
    const live = await boardFingerprints();
    const tiers = new Set((opt("--tier") ?? "A,B").split(","));
    for (const c of cities)
      await push(c, tiers, args.includes("--apply"), live);
    if (!args.includes("--apply"))
      console.log("\nDRY RUN — re-run with --apply.");
  } else gap();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
