// ── Website Leads: businesses with a missing or tired website ───────────────
//
//   pnpm sales:leads discover [--city kigali|nairobi|lagos|khartoum|port-sudan|all]
//   pnpm sales:leads audit    [--city …] [--limit n]     fetch each site, score the need
//   pnpm sales:leads push     [--city …] [--tier A|B|C] [--apply]   → Twenty "Website Leads"
//   pnpm sales:leads gap                                  what the board holds, by tier/finding
//   pnpm sales:leads draft    [--city …] [--tier A]       first-touch WhatsApp packet → jobs/packets/sales/
//   pnpm sales:leads prune    [--city …] [--apply]         cards that now tier C → stage LOST (never deleted)
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
  /mosque|masjid|مسجد|جامع|church|كنيسة|\(home\)|^home$|maersk|dhl|unicef|undp|\bwfp\b|embassy|سفارة|k\s?va\b|منزل|مزرعة|بنك|bank|ديوان|ضرائب|وزارة|ministry/i;
// Khartoum's OSM carries a generator-installation list ("بنك الجزيرة / J110
// kva", "منزل … / J88kva") tagged tourism=apartment: kva, houses, farms, banks
// and ministries are sites, not customers.

/// A "hotel" with no website and no hotel-like word in its name is usually a
/// private flat or a person ("Marwa", "AHMED BILLIA") — not a buyer.
const HOTELISH = /hotel|فندق|شقق|apartment|suites?|lodge|guest|resort|inn\b|hostel|نزل|استراحة|motel|rooms|stay|chez|residence|b&b|camp|villa/i;

function tierOf(l: Lead): "A" | "B" | "C" {
  // A church or mosque that runs a school is a Hogwarts prospect, not noise.
  if (NOT_A_BUYER.test(l.name) && !/school|academy|nursery|college|primary|secondary|kindergarten|pharmacy|clinic|مدرسة|روضة|أكاديمية|صيدلية/i.test(l.name)) return "C";
  if (l.sector === "HOSPITALITY" && !l.website && !HOTELISH.test(l.name)) return "C";
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

// ── prune: a filter tightened after the push ────────────────────────────────
// Deletes in Twenty are hard and unrecoverable, so a card that no longer
// qualifies is moved to LOST — only from AUDITED, never one a human has worked.

async function prune(city: string, live: Map<string, { id: string; stage: string | null }>, apply: boolean) {
  let n = 0;
  for (const l of Object.values(load(city))) {
    const card = live.get(l.fingerprint);
    if (!card || card.stage !== "AUDITED" || !l.audit || tierOf(l) !== "C") continue;
    n++;
    if (n <= 8 && !apply) console.log(`  - ${l.name}`);
    if (apply) await call(`${PATH}/${card.id}`, { method: "PATCH", body: { stage: "LOST" } });
  }
  console.log(`${CITIES[city].label.padEnd(11)} ${apply ? "moved to LOST" : "would move to LOST"} ${n}`);
}

// ── draft: first-touch WhatsApp packet ───────────────────────────────────────
//
// Writes a packet Abdout sends by hand — one wa.me click-to-chat link per lead,
// message prefilled. Nothing is sent from here (the /funnel rule: a human
// approves every first touch). WhatsApp only to mobiles; Arabic for Sudan,
// English elsewhere. Copy mirrors scripts/sales/outreach.md.

const DIAL: Record<string, string> = { SUDAN: "249", RWANDA: "250", KENYA: "254", NIGERIA: "234" };
/// National mobile ranges: Sudan 9x/1x (0183… is a Khartoum landline),
/// Rwanda 7x, Kenya 7x/1x, Nigeria 7x/8x/9x.
const MOBILE: Record<string, RegExp> = {
  SUDAN: /^(9\d|1[0-25-9])\d{7}$/,
  RWANDA: /^7\d{8}$/,
  KENYA: /^(7|1)\d{8}$/,
  NIGERIA: /^[789][01]\d{8}$/,
};

function mobileOf(phone: string | null, country: string): string | null {
  if (!phone) return null;
  const cc = DIAL[country];
  for (const raw of phone.split(/[;,/]+/)) {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith(cc)) d = d.slice(cc.length);
    d = d.replace(/^0/, "");
    if (MOBILE[country]?.test(d)) return `${cc}${d}`;
  }
  return null;
}

const AR_FINDING: Record<string, (l: Lead) => string> = {
  NO_WEBSITE: (l) => `لم أجد موقعاً إلكترونياً لـ ${l.name}، فمن يبحث عنكم في جوجل لا يجدكم.`,
  BROKEN: (l) => `حاولت فتح موقعكم (${linkOf(l.website)?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? l.website}) ولم يفتح.`,
  SOCIAL_ONLY: () => "حضوركم على الإنترنت عبر فيسبوك فقط، فلا تظهرون في نتائج بحث جوجل.",
  NOT_MOBILE: () => "موقعكم لا يظهر بشكل مناسب على شاشة الجوال، ومعظم زواركم يتصفحون من الجوال.",
  NO_HTTPS: () => "المتصفح يعرض موقعكم بعلامة «غير آمن».",
  OUTDATED: () => "موقعكم صُمم قبل سنوات ويبدو عليه القِدم.",
  SLOW: () => "موقعكم يتأخر في الفتح على بيانات الجوال.",
};
const EN_FINDING: Record<string, (l: Lead) => string> = {
  NO_WEBSITE: (l) => `I couldn't find a website for ${l.name}.`,
  BROKEN: () => "Your website isn't loading right now.",
  SOCIAL_ONLY: (l) => `${l.name} is only on Facebook/Instagram, so Google searches don't find you.`,
  NOT_MOBILE: () => "Your site doesn't fit a phone screen, and most visitors are on phones.",
  NO_HTTPS: () => "Browsers mark your site 'Not secure'.",
  OUTDATED: () => "Your site was built a few years ago and is showing its age.",
  SLOW: () => "Your site takes a few seconds to open on mobile data.",
};
const OFFER: Record<string, { ar: string; en: string; proof: string }> = {
  QR_ORDERING: { ar: "نصمم قوائم طعام رقمية بالـ QR مع طلب أونلاين", en: "We build QR menus with online ordering", proof: "bu.databayt.org" },
  BOOKING: { ar: "نصمم مواقع حجز مباشر للفنادق والشقق", en: "We build direct-booking sites for hotels and apartments", proof: "mkan.sd" },
  SCHOOL_SYSTEM: { ar: "لدينا نظام عربي لإدارة المدارس تعمل به مدرسة في الخرطوم", en: "We run a school management system already used by a school in Khartoum", proof: "balqalam.com" },
  NEW_WEBSITE: { ar: "نصمم مواقع سريعة تعمل على الجوال خلال أسبوع", en: "We build fast, mobile-first websites in about a week", proof: "abdoutgroup.com" },
  REBRAND: { ar: "نعيد تصميم المواقع لتكون سريعة وحديثة وتعمل على الجوال", en: "We rebuild websites to be fast, modern and mobile-first", proof: "abdoutgroup.com" },
};

/// The showcase a client opens from WhatsApp (link previews show the first
/// URL, so the sector's best live build goes first; databayt.org — the global
/// portfolio — always follows). Picked 2026-10-03 from mobile screenshots of
/// every live github.com/databayt build; dead ones (ed., zi., hc., wa.) and
/// off-message ones (nmbd — political) are excluded. Re-check before a big
/// wave: `curl -sIL <url>` must be 200.
const SHOWCASE: Record<string, { sd?: string; any: string }> = {
  FOOD: { any: "bu.databayt.org" }, // live QR ordering, Charles Burgers Kigali
  HOSPITALITY: { any: "mkan.sd" }, // booking marketplace
  EDUCATION: { sd: "moalimee.com", any: "balqalam.com" },
  RETAIL: { sd: "sijillee.com", any: "ec.databayt.org" }, // POS/accounting · e-commerce
  PROFESSIONAL: { any: "abdoutgroup.com" }, // corporate, Port Sudan logistics
  // No live health build yet (shifa is down): Sudanese pharmacies get Sijillee
  // (stock + sales), everyone else the global portfolio itself.
  HEALTH: { sd: "sijillee.com", any: "databayt.org" },
  NGO: { any: "mr.databayt.org" }, // visual storytelling
  TOURISM: { any: "mkan.sd" },
  OTHER: { any: "mr.databayt.org" },
};
const PORTFOLIO = "databayt.org";

function showcaseOf(l: Lead): string {
  // A school keeps its system proof even in Sudan; balqalam is the live one.
  if (offerOf(l) === "SCHOOL_SYSTEM") return "balqalam.com";
  const s = SHOWCASE[l.sector] ?? SHOWCASE.OTHER;
  return (l.country === "SUDAN" && s.sd) || s.any;
}

function messageFor(l: Lead): string {
  const o = { ...OFFER[offerOf(l)], proof: showcaseOf(l) };
  const f = l.audit!.finding;
  if (l.country === "SUDAN") {
    // The ask follows the offer: a school wants a demo, a restaurant a sample
    // menu, everyone else a free mock-up or a one-page review.
    const offer = offerOf(l);
    const ask =
      offer === "SCHOOL_SYSTEM"
        ? `هل تودون عرضاً مجانياً للنظام على بيانات ${l.name}؟`
        : offer === "QR_ORDERING"
          ? `هل تودون أن نرسل لكم نموذجاً مجانياً لقائمة ${l.name} الرقمية؟`
          : f === "NO_WEBSITE" || f === "SOCIAL_ONLY"
            ? `هل تودون أن نرسل لكم تصوراً مجانياً لموقع ${l.name}؟`
            : "هل تودون مراجعة مجانية لموقعكم من صفحة واحدة فيها ٣ تحسينات عملية؟";
    return `السلام عليكم، معكم عثمان عبدوت من داتابايت، شركة برمجيات سودانية. ${AR_FINDING[f]?.(l) ?? ""} ${o.ar}، ومن أعمالنا: ${o.proof}${o.proof === PORTFOLIO ? "" : ` — وباقي أعمالنا على ${PORTFOLIO}`}. ${ask} بدون أي التزام.`;
  }
  const offer = offerOf(l);
  const ask =
    offer === "SCHOOL_SYSTEM"
      ? `Would you like a free demo of the system for ${l.name}?`
      : offer === "QR_ORDERING"
        ? `Would you like us to send a free sample of a digital menu for ${l.name}?`
        : f === "NO_WEBSITE" || f === "SOCIAL_ONLY"
          ? `Would you like a free mock-up of a website for ${l.name}?`
          : "Would you like a free 1-page review with 3 concrete fixes?";
  return `Hello ${l.name} team, I'm Osman from Databayt, a software studio in Kigali. ${EN_FINDING[f]?.(l) ?? ""} ${o.en}. ${o.proof === PORTFOLIO ? `Our work: ${PORTFOLIO}.` : `Here's one we built: ${o.proof} (more of our work: ${PORTFOLIO}).`} ${ask} No obligation.`;
}

function draft(city: string, tiers: Set<string>) {
  const c = CITIES[city];
  const leads = Object.values(load(city)).filter((l) => l.audit && tiers.has(tierOf(l)));
  const wa: string[] = [];
  const other: string[] = [];
  const order = ["BROKEN", "NOT_MOBILE", "NO_HTTPS", "OUTDATED", "SLOW", "SOCIAL_ONLY", "NO_WEBSITE"];
  // Broken sites first, then by how likely the sector is to buy — Kigali's OSM
  // is 85% pharmacies, the weakest website buyer, so they go last.
  const buyer = ["FOOD", "HOSPITALITY", "EDUCATION", "PROFESSIONAL", "RETAIL", "TOURISM", "NGO", "OTHER", "HEALTH"];
  leads.sort(
    (a, b) =>
      order.indexOf(a.audit!.finding) - order.indexOf(b.audit!.finding) ||
      buyer.indexOf(a.sector) - buyer.indexOf(b.sector),
  );
  // OSM often maps one business as several nodes (APEDDH ×3 in Kigali): one
  // message per number, never the same pitch twice to the same phone.
  const sent = new Set<string>();
  for (const l of leads) {
    const m = mobileOf(l.phone, l.country);
    if (m && sent.has(m)) continue;
    if (m) sent.add(m);
    const text = messageFor(l);
    const head = `### ${l.name} — ${l.sector.toLowerCase()} · ${l.audit!.finding}`;
    if (m) wa.push(`${head}\n\n[Send on WhatsApp → +${m}](https://wa.me/${m}?text=${encodeURIComponent(text)})\n\n> ${text}\n`);
    else other.push(`- **${l.name}** (${l.audit!.finding}) — ${l.phone ?? ""} ${l.email ?? ""} ${l.website ?? ""}`.trim());
  }
  const date = new Date().toISOString().slice(0, 10);
  const out = `jobs/packets/sales/${date}-${city}-whatsapp.md`;
  mkdirSync("jobs/packets/sales", { recursive: true });
  writeFileSync(
    out,
    `# ${c.label} — first WhatsApp touch (${date})\n\n` +
      `${wa.length} drafts to send by hand: open each link on the phone that holds Databayt's WhatsApp, read, send.\n` +
      `Then move the card on sales.databayt.org → Website Leads to **Contacted** (touch 1). Nothing here was sent.\n` +
      `Broken/old sites first (the pitch shows the problem), then no-website leads.\n\n` +
      wa.join("\n") +
      (other.length ? `\n## No WhatsApp number — call or email (${other.length})\n\n${other.join("\n")}\n` : ""),
  );
  console.log(`${c.label.padEnd(11)} ${wa.length} WhatsApp drafts · ${other.length} without a mobile → ${out}`);
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
  } else if (verb === "prune") {
    const live = await boardFingerprints();
    for (const c of cities) await prune(c, live, args.includes("--apply"));
  } else if (verb === "draft") for (const c of cities) draft(c, new Set((opt("--tier") ?? "A").split(",")));
  else gap();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
