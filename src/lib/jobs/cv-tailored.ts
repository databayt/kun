// ── Per-job tailored CV: schema, ATS-safe renderer, fact gate ────────────────
//
// A tailored CV is written by `claude -p` as CONTENT ONLY (cv.json) from the
// verified career record (jobs/evidence/career.json) and the scraped posting,
// then rendered here by a fixed template. The model never writes HTML, so the
// layout stays what an ATS parser reads cleanly: one column, normal flow, real
// headings and lists, contact details in the body, no tables, columns,
// positioned boxes or icons.
//
// The gate is mechanical: every number must be in facts.json or the posting,
// every employer / vessel / certificate must be in the career record, and the
// posting's must-haves the CV claims to cover must actually appear in it.

export type CvProfile = "maritime" | "engineering" | "software";

export interface CvExperience {
  role: string;
  org: string;
  place?: string;
  dates: string;
  bullets: string[];
}

export interface CvSeaService {
  vessel: string;
  type: string;
  company: string;
  dates: string;
  detail?: string;
}

export interface TailoredCv {
  profile: CvProfile;
  headline: string;
  summary: string;
  skills: string[];
  experience: CvExperience[];
  seaService?: CvSeaService[];
  education: { degree: string; school: string; date: string }[];
  certifications: string[];
  /// What the posting demands, in its own words — the coverage denominator.
  mustHave: string[];
  keywordsCovered: string[];
  keywordsMissing: string[];
}

export interface CareerRecord {
  identity: {
    legalName: string;
    brandName: string;
    dateOfBirth: string;
    nationality: string;
    location: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    website: string;
    languages: string[];
    passport?: { validUntil: string };
  };
  seafarerDocuments: { seamansBook: string; seamansBookValidUntil?: string };
  education: { degree: string; school: string; date: string }[];
  certifications: {
    name: string;
    issuer?: string;
    date?: string;
    stale?: boolean;
  }[];
  experience: {
    id: string;
    role: string;
    org: string;
    place?: string;
    start: string;
    end: string;
    bullets: string[];
  }[];
  seaService: {
    vessel: string;
    type: string;
    company: string;
    from: string;
    to: string;
    detail?: string;
  }[];
}

/// Board campaign → which CV the posting gets.
export function profileForCampaign(
  campaign: string | null | undefined,
): CvProfile {
  if (campaign === "MARINE_ETO") return "maritime";
  if (
    ["PROTECTION", "ELECTRICAL", "ENGINEERING_CONTRACT"].includes(
      campaign ?? "",
    )
  )
    return "engineering";
  return "software";
}

/// Maritime CVs carry the legal name so crewing agencies can match it to the
/// passport, CoC and seaman's book; everything else uses the brand name.
export function cvName(
  cv: Pick<TailoredCv, "profile">,
  career: CareerRecord,
): string {
  return cv.profile === "maritime"
    ? career.identity.legalName
    : career.identity.brandName;
}

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const CV_HEADINGS = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  sea: "Sea Service",
  education: "Education",
  certifications: "Certifications",
  personal: "Personal Details",
} as const;

export function renderAtsHtml(cv: TailoredCv, career: CareerRecord): string {
  const id = career.identity;
  const name = cvName(cv, career);
  const contact = [
    id.location,
    id.email,
    id.phone,
    id.linkedin,
    ...(cv.profile === "software" ? [id.github, id.website] : []),
  ];
  const section = (title: string, body: string) =>
    body.trim() ? `<h2>${esc(title)}</h2>\n${body}` : "";
  const list = (items: string[]) =>
    items.length
      ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : "";

  const experience = cv.experience
    .map(
      (e) =>
        `<h3>${esc(e.role)} — ${esc(e.org)}</h3>\n<p class="meta">${esc([e.place, e.dates].filter(Boolean).join(" | "))}</p>\n${list(e.bullets)}`,
    )
    .join("\n");

  const sea = (cv.seaService ?? [])
    .map(
      (s) =>
        `<li>${esc(`${s.dates}: ${s.vessel} (${s.type}) — ${s.company}${s.detail ? `. ${s.detail}` : ""}`)}</li>`,
    )
    .join("");

  const personal =
    cv.profile === "maritime"
      ? list([
          `Date of birth: ${id.dateOfBirth.split("-").reverse().join("/")}`,
          `Nationality: ${id.nationality}`,
          `Seaman's book (Sudan) No.: ${career.seafarerDocuments.seamansBook}${career.seafarerDocuments.seamansBookValidUntil ? `, valid until ${career.seafarerDocuments.seamansBookValidUntil}` : ""}`,
          ...(id.passport ? [`Passport: valid until ${id.passport.validUntil}`] : []),
          `Languages: ${id.languages.join(", ")}`,
        ])
      : list([`Languages: ${id.languages.join(", ")}`]);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(name)} — ${esc(cv.headline)}</title>
<style>
@page { size: A4; margin: 16mm 16mm 16mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.38; color: #111; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 2pt; }
.headline { font-size: 12pt; font-weight: bold; margin: 0 0 4pt; }
.contact { margin: 0 0 6pt; }
h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: .5pt; border-bottom: 1px solid #444; padding-bottom: 2pt; margin: 10pt 0 4pt; }
h3 { font-size: 10.5pt; margin: 7pt 0 0; }
.meta { margin: 0 0 2pt; color: #333; }
ul { margin: 2pt 0 0 14pt; padding: 0; }
li { margin: 0 0 2pt; }
p { margin: 0 0 3pt; }
h2, h3 { break-after: avoid; }
li { break-inside: avoid; }
</style></head>
<body>
<h1>${esc(name)}</h1>
<p class="headline">${esc(cv.headline)}</p>
<p class="contact">${contact.map(esc).join(" | ")}</p>
${section(CV_HEADINGS.summary, `<p>${esc(cv.summary)}</p>`)}
${section(CV_HEADINGS.skills, `<p>${cv.skills.map(esc).join(" • ")}</p>`)}
${section(CV_HEADINGS.experience, experience)}
${sea ? section(CV_HEADINGS.sea, `<ul>${sea}</ul>`) : ""}
${section(CV_HEADINGS.education, list(cv.education.map((e) => `${e.degree} — ${e.school}, ${e.date}`)))}
${section(CV_HEADINGS.certifications, list(cv.certifications))}
${section(CV_HEADINGS.personal, personal)}
</body></html>
`;
}

// ── gate ─────────────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function cvText(cv: TailoredCv): string {
  return [
    cv.headline,
    cv.summary,
    ...cv.skills,
    ...cv.experience.flatMap((e) => [
      e.role,
      e.org,
      e.place ?? "",
      e.dates,
      ...e.bullets,
    ]),
    ...(cv.seaService ?? []).flatMap((s) => [
      s.vessel,
      s.type,
      s.company,
      s.dates,
      s.detail ?? "",
    ]),
    ...cv.education.flatMap((e) => [e.degree, e.school, e.date]),
    ...cv.certifications,
  ].join("\n");
}

export interface CvGateVerdict {
  pass: boolean;
  problems: string[];
  coverage: number;
  missing: string[];
}

/// numbersIn is passed in (send-gate.ts) so this module stays dependency-free.
export function gateTailoredCv(
  cv: TailoredCv,
  career: CareerRecord,
  ctx: {
    factNumbers: string[];
    postingText: string;
    numbersIn: (t: string) => string[];
  },
): CvGateVerdict {
  const problems: string[] = [];
  const text = cvText(cv);

  // 1. Numbers: facts.json or the posting, nothing else.
  const allowed = new Set([
    ...ctx.factNumbers,
    ...ctx.numbersIn(ctx.postingText),
  ]);
  const careerNumbers = new Set(ctx.numbersIn(JSON.stringify(career)));
  const invented = [...new Set(ctx.numbersIn(text))].filter(
    (n) => !allowed.has(n) && !careerNumbers.has(n),
  );
  if (invented.length)
    problems.push(
      `numbers not in the record or posting: ${invented.slice(0, 6).join(", ")}`,
    );

  // 2. Employers, vessels, schools and certificates must exist in the career
  //    record — each checked against its own part of it, so a name cannot pass
  //    on words borrowed from a job title or a JSON key.
  const orgBlob = norm(
    [
      ...career.experience.flatMap((e) => [e.org, e.place ?? ""]),
      ...career.seaService.map((s) => s.company),
    ].join(" "),
  );
  const unknownOrg = cv.experience.map((e) => e.org).filter((o) => !orgKnown(o, orgBlob));
  if (unknownOrg.length) problems.push(`employers not in the record: ${unknownOrg.join("; ")}`);
  const vesselBlob = norm(career.seaService.map((s) => s.vessel).join(" | "));
  const unknownVessel = (cv.seaService ?? []).map((s) => s.vessel).filter((v) => !vesselBlob.includes(norm(v)));
  if (unknownVessel.length) problems.push(`vessels not in the record: ${unknownVessel.join("; ")}`);
  const schoolBlob = norm(career.education.flatMap((e) => [e.degree, e.school]).join(" "));
  const unknownSchool = cv.education.map((e) => e.school).filter((s) => !orgKnown(s, schoolBlob));
  if (unknownSchool.length) problems.push(`schools not in the record: ${unknownSchool.join("; ")}`);
  const certBlob = norm(
    career.certifications.flatMap((c) => [c.name, c.issuer ?? "", c.date ?? ""]).join(" "),
  );
  // "— renewal on joining" / "— refresher due" are the contract's honest
  // wording for expired documents (tailor.ts); the certificate itself must
  // still be in the record.
  const unknownCert = cv.certifications.filter(
    (c) => !orgKnown(c.replace(/\s*[—-]\s*(renewal on joining|refresher due)\s*$/i, ""), certBlob),
  );
  if (unknownCert.length) problems.push(`certifications not in the record: ${unknownCert.join("; ")}`);

  // 3. A stale document is never presented as current.
  if (/medical[^.\n]{0,60}\b(valid|current|in date)\b/i.test(text))
    problems.push("presents the expired medical as valid");
  if (/\b(holds?|holder of|certified)\b[^.\n]{0,40}\b(eto )?(coc|certificate of competency)\b/i.test(text))
    problems.push("claims a certificate of competency he does not hold");

  // 4. Coverage — counted on the rendered text, not on the model's own claim.
  // Postings say "Bachelor's degree"; CVs say "BSc" — same thing.
  const lower = `${norm(text)}${/\bb\.?\s?sc\b|\bb\.?e\.?\b|\bb\.?tech\b|bachelor/i.test(text) ? " bachelor bachelors degree" : ""}`;
  const covered = cv.mustHave.filter((k) => termIn(k, lower));
  const missing = cv.mustHave.filter((k) => !termIn(k, lower));
  const coverage = cv.mustHave.length
    ? Math.round((covered.length / cv.mustHave.length) * 100)
    : 100;

  if (cv.experience.length === 0) problems.push("no experience entries");
  if (!cv.summary || cv.summary.length < 60) problems.push("summary too short");

  return { pass: problems.length === 0, problems, coverage, missing };
}

/// Significant words of a name all appear in the record ("Meramar Shipping &
/// Trading Co., Dubai" ⊂ the record even if punctuation differs).
function orgKnown(name: string, careerBlob: string): boolean {
  const words = norm(name)
    .split(" ")
    .filter(
      (w) =>
        w.length >= 3 && !["the", "and", "for", "ltd", "inc", "co"].includes(w),
    );
  if (words.length === 0) return true;
  const hits = words.filter((w) => careerBlob.includes(w)).length;
  return hits / words.length >= 0.75;
}

/// A must-have counts as covered when most of its significant words appear.
function termIn(term: string, lowerText: string): boolean {
  const words = norm(term)
    .split(" ")
    .filter(
      (w) =>
        w.length >= 3 &&
        ![
          "and",
          "with",
          "the",
          "for",
          "experience",
          "years",
          "knowledge",
          "ability",
        ].includes(w),
    );
  if (words.length === 0) return true;
  const hits = words.filter((w) => lowerText.includes(w)).length;
  return hits / words.length >= 0.6;
}
