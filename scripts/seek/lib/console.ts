// ── Which instance this loop pushes as (push.ts, pull.ts) ────────────────────
//
// SEEK_INSTANCE wins; otherwise the profile's first name, lowercased — so a
// fresh clone with its own profile.json never writes into someone else's rows.

import { ME } from "./identity";

export const INSTANCE = (
  process.env.SEEK_INSTANCE?.trim() ||
  ME.firstName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
).slice(0, 40);
