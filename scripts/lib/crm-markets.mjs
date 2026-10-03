// ── Markets shared by the Databayt-workspace boards ──────────────────────────
//
// One country list for "Jobs & Opportunities" (kigaliOpportunity) and
// "Funding & Programs" (fundingProgram), so a view grouped by country reads the
// same on both. Abdout's markets (2026-10-03): Rwanda, Kenya, Nigeria, the Gulf
// and Sudan. SELECT options only grow — append, never reorder or rename.

const sel = (value, label, color, position) => ({
  value,
  label,
  color,
  position,
});

export const COUNTRY_OPTIONS = [
  sel("RWANDA", "Rwanda", "blue", 0),
  sel("KENYA", "Kenya", "green", 1),
  sel("NIGERIA", "Nigeria", "turquoise", 2),
  sel("UGANDA", "Uganda", "yellow", 3),
  sel("TANZANIA", "Tanzania", "sky", 4),
  sel("SUDAN", "Sudan", "red", 5),
  sel("SAUDI_ARABIA", "Saudi Arabia", "purple", 6),
  sel("UAE", "UAE", "pink", 7),
  sel("QATAR", "Qatar", "orange", 8),
  sel("GULF_OTHER", "Gulf — other", "orange", 9),
  sel("REMOTE", "Remote", "gray", 10),
  sel("OTHER", "Other", "gray", 11),
  sel("PAN_AFRICA", "Pan-Africa", "green", 12),
  sel("GLOBAL", "Global", "gray", 13),
];

export const TRACK_OPTIONS = [
  sel("FOUNDER", "Founder — Abdout", "blue", 0),
  sel("DATABAYT", "Databayt — company", "purple", 1),
];
