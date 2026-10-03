// ── Market of a posting: country, city and track for the board views ────────
//
// `location` stays the posting's own words; these three are what the "Jobs &
// Opportunities" views group by (scripts/lib/crm-markets.mjs holds the option
// lists). Abdout's markets, 2026-10-03: Rwanda, Kenya, Nigeria, Gulf, Sudan.

const COUNTRIES: [string, RegExp, string?][] = [
  ["RWANDA", /\b(rwanda|kigali|musanze|huye|rubavu|gisenyi)\b/i, "Kigali"],
  ["KENYA", /\b(kenya|nairobi|mombasa|kisumu|nakuru|kisii)\b/i, "Nairobi"],
  ["NIGERIA", /\b(nigeria|lagos|abuja|port harcourt|ibadan)\b/i, "Lagos"],
  ["UGANDA", /\b(uganda|kampala)\b/i, "Kampala"],
  ["TANZANIA", /\b(tanzania|dar es salaam|arusha|dodoma)\b/i, "Dar es Salaam"],
  ["SUDAN", /\b(sudan|khartoum|port sudan)\b/i],
  ["SAUDI_ARABIA", /\b(saudi|ksa|riyadh|jeddah|dammam|khobar)\b/i, "Riyadh"],
  ["UAE", /\b(uae|united arab emirates|dubai|abu dhabi|sharjah)\b/i, "Dubai"],
  ["QATAR", /\b(qatar|doha)\b/i, "Doha"],
  ["GULF_OTHER", /\b(bahrain|kuwait|oman|muscat|gcc|gulf)\b/i],
];

const CITY =
  /\b(kigali|nairobi|mombasa|kisumu|lagos|abuja|kampala|dar es salaam|riyadh|jeddah|dammam|dubai|abu dhabi|doha|khartoum|port sudan)\b/i;

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function marketOf(
  location: string | null | undefined,
  remoteType?: string,
): { country: string; city: string | null } {
  const place = location ?? "";
  const hit = COUNTRIES.find(([, re]) => re.test(place));
  if (!hit)
    return {
      country:
        remoteType === "remote" ||
        /remote|anywhere|worldwide|global/i.test(place)
          ? "REMOTE"
          : "OTHER",
      city: null,
    };
  const city = place.match(CITY)?.[1];
  return {
    country: hit[0],
    city: city
      ? titleCase(city.toLowerCase())
      : remoteType === "remote"
        ? null
        : (hit[2] ?? null),
  };
}

/// Who a card earns for: tenders and client projects are Databayt's.
export function trackOf(
  campaign: string | null | undefined,
): "FOUNDER" | "DATABAYT" {
  return campaign === "TENDER" || campaign === "CLIENT_PROJECT"
    ? "DATABAYT"
    : "FOUNDER";
}
