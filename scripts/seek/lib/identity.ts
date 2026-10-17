// Who the loop works for — read from the private profile, never hardcoded.
// Every prompt, signature, file name and brief takes the person from here, so
// a fresh clone with its own profile.json writes letters in its own name.
//
// profile.json shape (see scripts/seek/profile.example.json):
//   identity  name, email, phone, city, country, utcOffsetHours, bio
//   seek      strategy (the weekly planner's brief), tailorRules (how the CV
//             may present this record), sweep (the daily search)

import { existsSync, readFileSync } from "node:fs";
import { DATA } from "./paths.mjs";

export interface Sweep {
  // Who and what to search for, in prose: families of roles, places, example
  // queries. The truth rules and the output format stay in the code.
  brief: string;
  // Campaign ids a sweep row may carry; anything else is dropped.
  campaigns: string[];
  // One line on which campaign to choose when.
  campaignGuide?: string;
  // Default location for a row that names none.
  location?: string;
  // Campaigns that are bids (tenders, RFPs): applied through the portal with a
  // proposal packet, never a cover letter by email.
  bidCampaigns?: string[];
}

interface Profile {
  identity?: {
    fullName?: string;
    firstName?: string;
    email?: string;
    phoneDisplay?: string;
    phone?: string;
    utcOffsetHours?: number;
    bio?: string;
    // A distinct legal name some CV families must carry (e.g. a seafarer's
    // book), keyed by CV profile.
    cvNames?: Record<string, string>;
  };
  seek?: { strategy?: string; tailorRules?: string; sweep?: Sweep };
}

function load(): Profile {
  const path = `${DATA}/profile.json`;
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Profile;
  } catch {
    return {};
  }
}

const profile = load();
const id = profile.identity ?? {};
const name = id.fullName ?? "the candidate";

export const ME = {
  name,
  firstName: id.firstName ?? name.split(" ")[0],
  email: id.email ?? "",
  phone: id.phoneDisplay ?? id.phone ?? "",
  bio: id.bio ?? "",
  utcOffsetHours: id.utcOffsetHours ?? 0,
  signature: [name, id.phoneDisplay ?? id.phone, id.email].filter(Boolean).join(", "),
  // File-name stem for a CV or letter: "Jane_Doe", or a per-profile legal name.
  fileStem(cvProfile?: string): string {
    const n = (cvProfile && id.cvNames?.[cvProfile]) || name;
    return n.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  },
};

export const STRATEGY = profile.seek?.strategy ?? "";
export const TAILOR = profile.seek?.tailorRules ?? "";
export const SWEEP: Sweep | null = profile.seek?.sweep ?? null;
