// ── ATS answer engine: a form question → Abdout's truthful answer, or null ────
//
// Auto-submitted forms go out under Abdout's name (his decision, 2026-09-27),
// so every answer comes from jobs/profile.json and nothing else. A required
// question no rule answers returns null — the card goes to HOLD with the
// question quoted. Pure: no network, no DOM; the submitter does the typing.

export interface AtsOption {
  label: string;
  value?: string | number;
}

export interface AtsField {
  name: string;
  type: string; // input_text | textarea | input_file | multi_value_single_select | multi_value_multi_select | input_hidden | boolean
  values?: AtsOption[];
}

export interface AtsQuestion {
  label: string;
  required: boolean;
  fields: AtsField[];
}

export interface AtsProfile {
  identity: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    timezone: string;
    passportCountry?: string;
  };
  links: {
    linkedin: string | null;
    github: string;
    githubOrg?: string;
    website: string;
    portfolio: string;
  };
  work: {
    currentTitle: string;
    currentCompany: string;
    yearsSoftwareProfessional: number;
    highestDegree: string;
    strongestLanguages?: string;
    noticePeriod: string;
    startDate: string;
  };
  authorization: {
    authorizedRwanda?: boolean;
    authorizedUS: boolean;
    authorizedUK: boolean;
    authorizedEU: boolean;
    authorizedCanada: boolean;
    needsSponsorshipForCountryBoundRoles: boolean;
    willingToRelocate: string;
  };
  compensation: Record<string, string>;
  sourceAnswer: string;
  skills?: { yes: string[]; no: string[] };
}

export type Answer =
  | { kind: "text"; value: string }
  | { kind: "select"; option: string }
  | { kind: "multi"; options: string[] }
  | { kind: "check"; value: boolean }
  | { kind: "file"; which: "resume" | "cover_letter" }
  | { kind: "prose"; prompt: string } // written per job by the wave, fact-gated
  | { kind: "skip" };

export interface AnswerContext {
  company: string;
  role: string;
}

const pick = (
  values: AtsOption[] | undefined,
  ...patterns: RegExp[]
): string | null => {
  for (const p of patterns) {
    const hit = values?.find((v) => p.test(v.label));
    if (hit) return hit.label;
  }
  return null;
};

const YES = /^yes\b/i;
const NO = /^(no|not yet|never|none)\b/i;

/// A select of numeric ranges ("0-3 years", "4-6", "7 or more") → the one containing n.
export function rangeOption(
  values: AtsOption[] | undefined,
  n: number,
): string | null {
  for (const v of values ?? []) {
    const nums = (v.label.match(/\d+/g) ?? []).map(Number);
    if (nums.length === 0) continue;
    const [lo, hi] =
      nums.length === 1
        ? [nums[0], /\+|more|over|above/i.test(v.label) ? Infinity : nums[0]]
        : [nums[0], nums[1]];
    if (
      /less than|under|fewer/i.test(v.label) ? n < nums[0] : n >= lo && n <= hi
    )
      return v.label;
  }
  return null;
}

function yesNo(field: AtsField, yes: boolean): Answer | null {
  if (field.type === "boolean") return { kind: "check", value: yes };
  if (field.type.startsWith("multi_value")) {
    const o = pick(field.values, yes ? YES : NO);
    return o ? { kind: "select", option: o } : null;
  }
  return { kind: "text", value: yes ? "Yes" : "No" };
}

function countryIn(
  label: string,
): "rwanda" | "us" | "uk" | "eu" | "canada" | "residence" | null {
  if (/rwanda/i.test(label)) return "rwanda";
  if (/\b(us|u\.s\.|usa|united states|america)\b/i.test(label)) return "us";
  if (/\b(uk|united kingdom|britain)\b/i.test(label)) return "uk";
  if (/\b(eu|europe|european)\b/i.test(label)) return "eu";
  if (/canada/i.test(label)) return "canada";
  if (
    /country (of|where you) (residence|reside|live)|where you (currently )?(live|reside)|country you (are|currently) (based|live|reside|located)/i.test(
      label,
    )
  )
    return "residence";
  return null;
}

export function answerQuestion(
  q: AtsQuestion,
  profile: AtsProfile,
  ctx: AnswerContext,
): Answer | null {
  const field = q.fields[0];
  if (!field) return { kind: "skip" };
  const label = q.label.replace(/\s+/g, " ").trim();
  const L = label.toLowerCase();
  const isSelect = field.type.startsWith("multi_value");
  const text = (v: string): Answer =>
    (isSelect
      ? pick(field.values, new RegExp(v, "i"))
        ? { kind: "select", option: pick(field.values, new RegExp(v, "i"))! }
        : null
      : { kind: "text", value: v }) as Answer;

  // ── standard fields, by field name ─────────────────────────────────────────
  switch (field.name) {
    // Ashby's system fields
    case "_systemfield_name":
      return { kind: "text", value: profile.identity.fullName };
    case "_systemfield_email":
      return { kind: "text", value: profile.identity.email };
    case "_systemfield_phone":
      return { kind: "text", value: profile.identity.phone };
    case "_systemfield_resume":
      return { kind: "file", which: "resume" };
    case "_systemfield_cover_letter":
      return { kind: "file", which: "cover_letter" };
    case "_systemfield_location":
      return { kind: "skip" }; // typed by the submitter (autocomplete)
  }
  // Abdout (2026-09-27): attach the databayt site and org wherever a form
  // offers a free "other links / portfolio" slot, required or not.
  if (/^(other|other links?|portfolio|website|personal website)$/i.test(label.trim()) && !field.type.startsWith("multi_value")) {
    return { kind: "text", value: [profile.links.website, profile.links.githubOrg, profile.links.portfolio].filter(Boolean).join(" ") };
  }
  switch (field.name) {
    case "first_name":
      return { kind: "text", value: profile.identity.firstName };
    case "last_name":
      return { kind: "text", value: profile.identity.lastName };
    case "preferred_name":
      return { kind: "text", value: profile.identity.firstName };
    case "email":
      return { kind: "text", value: profile.identity.email };
    case "phone":
      return { kind: "text", value: profile.identity.phone };
    case "resume":
      return { kind: "file", which: "resume" };
    case "cover_letter":
      return { kind: "file", which: "cover_letter" };
    case "resume_text":
    case "cover_letter_text":
      return { kind: "skip" }; // the file upload covers it
  }
  if (field.type === "input_hidden") return { kind: "skip" };
  // The location autocomplete is typed by the submitter itself (Google Places).
  if (field.type === "location" || field.name === "candidate-location") return { kind: "skip" };

  // ── voluntary self-identification: always decline ──────────────────────────
  if (
    /gender|race|ethnic|hispanic|latino|veteran|disabilit|pronoun|sexual orientation|transgender/i.test(
      L,
    )
  ) {
    const o = pick(
      field.values,
      /decline|don.?t wish|prefer not|not to (say|answer|disclose)|choose not/i,
    );
    return o
      ? { kind: "select", option: o }
      : q.required
        ? null
        : { kind: "skip" };
  }

  // ── identity & links ───────────────────────────────────────────────────────
  if (/preferred (first and last )?name|full (legal )?name|your name/i.test(L))
    return { kind: "text", value: profile.identity.fullName };
  if (/linkedin/i.test(L))
    return profile.links.linkedin
      ? { kind: "text", value: profile.links.linkedin }
      : q.required
        ? null
        : { kind: "skip" };
  if (/github/i.test(L)) return { kind: "text", value: profile.links.github };
  if (
    /portfolio|website|personal (site|url)|blog|other (links?|urls?)|url/i.test(
      L,
    )
  ) {
    return {
      kind: "text",
      value: [
        profile.links.website,
        profile.links.githubOrg,
        profile.links.portfolio,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  if (/current (company|employer)/i.test(L))
    return { kind: "text", value: profile.work.currentCompany };
  if (/current (title|role|position)/i.test(L))
    return { kind: "text", value: profile.work.currentTitle };
  if (/time ?zone/i.test(L) && !isSelect && field.type !== "boolean" && !/^(are|can|do|will|is)\b/i.test(label))
    return { kind: "text", value: profile.identity.timezone };

  // ── where he lives, asked as "do you reside / are you based in X?" ─────────
  if (/(do you|are you) (currently )?(reside|live|living|located|based)|currently (located|based|residing) in/i.test(L) && !/\b(what|which|where)\b/i.test(L)) {
    return yesNo(field, /rwanda|kigali|africa|emea|worldwide|anywhere/i.test(label));
  }
  if (/citizenship status in|citizen of|permanent(ly)? .*(eligib|resident)|eligibility to work permanently/i.test(L)) {
    if (isSelect) {
      const o = pick(field.values, /^none$|none of|not applicable|no\b|other/i);
      return o ? { kind: "select", option: o } : null;
    }
    return /rwanda/i.test(L) ? null : { kind: "text", value: "Not a citizen or permanent resident; would need sponsorship" };
  }
  if (/require (a )?(visa|work permit|government authori)/i.test(L)) return yesNo(field, profile.authorization.needsSponsorshipForCountryBoundRoles);

  // ── plain facts about him ──────────────────────────────────────────────────
  if (/relationship with any (staff|employee|board)|family relationship.*(staff|employee|board member)|related to (any|an) (employee|staff)/i.test(L)) return yesNo(field, false);
  if (/(been|ever been|previously been) employed by|worked (for|at) [^?]* before|former (employee|contractor) of/i.test(L)) return yesNo(field, false);
  if (/current (job )?(title|role|position)/i.test(L) && !isSelect) return { kind: "text", value: profile.work.currentTitle };
  if (/strongest.*(language|stack)|primary (programming )?language/i.test(L) && !isSelect) return { kind: "text", value: profile.work.strongestLanguages ?? "TypeScript, JavaScript, SQL" };
  if (/time ?zone/i.test(L) && isSelect) {
    const o = pick(field.values, /utc\s*\+\s*0?2\b|gmt\s*\+\s*0?2\b|\+02:?00|\bcat\b|central africa|eastern europe/i);
    return o ? { kind: "select", option: o } : null;
  }

  // ── self-descriptions with one clearly true option ─────────────────────────
  // He builds Claude agents and MCP integrations (the kun engine) and runs
  // Databayt's production alone — these two options are simply what he does.
  if (/how you use ai tools|use of ai tools|ai tools (today|in your work)/i.test(L) && isSelect) {
    const o = pick(field.values, /design or automate|building agents|integrat(e|ing) ai/i);
    return o ? { kind: "select", option: o } : null;
  }
  if (/owned production features|how you have (typically )?owned|production (support|ownership)/i.test(L) && isSelect) {
    const o = pick(field.values, /responsible for building, testing, deploying/i);
    return o ? { kind: "select", option: o } : null;
  }

  // ── "have you worked with / do you have experience in X?" — from the skills lists
  const skillQ = /(have you|do you have|are you (experienced|familiar)).*(experience|worked|written|used|built|familiar)|experience (with|in|using)/i.test(L);
  if (skillQ && !/agency|employ|company|vendor|partner|work(ed)? (for|at)/i.test(L) && profile.skills && (isSelect || field.type === "boolean")) {
    const has = (list: string[]) => list.some((k) => new RegExp(`(^|[^a-z])${k.replace(/[.+#]/g, "\\$&")}([^a-z]|$)`, "i").test(label));
    const yes = has(profile.skills.yes);
    const no = has(profile.skills.no);
    if (yes !== no) {
      if (isSelect && field.values && field.values.length > 2) {
        const o = yes ? pick(field.values, /professional|both|yes/i) : pick(field.values, /^no\b|not written|do not|don.?t|never|less than/i);
        return o ? { kind: "select", option: o } : null;
      }
      return yesNo(field, yes);
    }
    // No skill word matched: let the later rules try ("have you worked remotely").

  }

  // ── more plain facts (Ashby audit, 2026-09-27) ────────────────────────────
  if (/passport country|country of (citizenship|nationality)|nationality/i.test(L) && !isSelect) return { kind: "text", value: profile.identity.passportCountry ?? "Sudan" };
  if (/^phone( number)?$|mobile( number)?|phone number/i.test(L) && !isSelect) return { kind: "text", value: profile.identity.phone };
  if (/where are you (currently )?(located|based)|where do you (currently )?(live|reside)/i.test(L) && !isSelect) return { kind: "text", value: `${profile.identity.city}, ${profile.identity.country}` };
  if (/famil(y|ial) relationships? with (current|any)/i.test(L)) return yesNo(field, false);
  if (/worked remotely|remote (work )?experience|full-time remote/i.test(L) && (field.type === "boolean" || isSelect)) return yesNo(field, true);
  if (/independent contractor|as a contractor|contractor (arrangement|basis)/i.test(L)) {
    if (isSelect) {
      const o = pick(field.values, /^yes$/i, /^yes\b/i);
      return o ? { kind: "select", option: o } : null;
    }
    return yesNo(field, true);
  }
  if (/link to (a |your )?(code sample|project|repo|github|portfolio)|code sample/i.test(L) && !isSelect) return { kind: "text", value: profile.links.githubOrg ?? profile.links.github };
  if (/minimum of (\d+)\+? years/i.test(L) && (isSelect || field.type === "boolean")) {
    const need = Number(L.match(/minimum of (\d+)/)![1]);
    return yesNo(field, profile.work.yearsSoftwareProfessional >= need);
  }
  // Authorisation for a list of named countries that are not Rwanda/Sudan: no.
  if (/(legally )?work (for any employer )?in (either )?/i.test(L) && /\b(france|belgium|spain|germany|netherlands|portugal|italy|poland|israel|india|brazil|mexico|singapore|australia|japan|sweden|norway|denmark|finland|ireland|austria|switzerland|czech|hungary|romania|greece|uk|united kingdom|usa|united states|canada)\b/i.test(L) && !/rwanda|sudan/i.test(L)) {
    return yesNo(field, false);
  }

  // ── conditional follow-ups ("If you answered yes…") — N/A, before any rule
  //    that would read the words inside them
  if (
    /^if (you|yes|so)|if you answered|if applicable|please (provide|list|specify).*(if|former|previous)/i.test(
      L,
    )
  ) {
    return { kind: "text", value: "N/A" };
  }

  // ── "at least N years of …" — answered from the real count, honestly ──────
  const atLeast = L.match(/at least (\d+)\+? years|(\d+)\+ years/);
  if (atLeast && /experience|years/.test(L) && (field.type === "boolean" || isSelect || /^(do|have|are)/i.test(label))) {
    const need = Number(atLeast[1] ?? atLeast[2]);
    return yesNo(field, profile.work.yearsSoftwareProfessional >= need);
  }

  // ── "are you in / can you work in X time zone?" — Kigali is UTC+2 ────────
  if (/time ?zone|working hours|business hours/i.test(L) && (field.type === "boolean" || isSelect || /^(are|can|do|will)/i.test(label))) {
    if (/europe|european|emea|cet|cest|eet|gmt\s*\+|utc\s*\+\s*[0-3]\b|africa/i.test(L)) return yesNo(field, true);
    if (/overlap/i.test(L)) return yesNo(field, true); // he states full EU / partial US-East overlap
    if (/\b(pacific|pst|pt|mountain|central time|cst|eastern|est|et|us|american|apac|asia|australia)\b/i.test(L)) return yesNo(field, false);
  }

  // ── work authorisation & sponsorship ───────────────────────────────────────
  if (/sponsor/i.test(L))
    return yesNo(
      field,
      profile.authorization.needsSponsorshipForCountryBoundRoles,
    );
  if (
    /authori[sz](ed|ation)|legally (eligible|permitted|able|work)|can you (legally )?work in|right to work|eligible to work|work permit/i.test(
      L,
    )
  ) {
    const where = countryIn(label);
    if (where === "rwanda" || where === "residence")
      return profile.authorization.authorizedRwanda ? yesNo(field, true) : null;
    if (where === "us") {
      const na = pick(
        field.values,
        /not applicable|do not (plan|currently).*(reside|live)/i,
      );
      return na
        ? { kind: "select", option: na }
        : yesNo(field, profile.authorization.authorizedUS);
    }
    if (where === "uk") return yesNo(field, profile.authorization.authorizedUK);
    if (where === "eu") return yesNo(field, profile.authorization.authorizedEU);
    if (where === "canada")
      return yesNo(field, profile.authorization.authorizedCanada);
    // Any other named country: authorised only where he is (Rwanda) or a
    // citizen (Sudan) — "Can you legally work in Israel?" is a truthful no.
    const named = label.match(/work in (?:the )?([A-Z][A-Za-z]+(?: [A-Z][a-z]+)?)/)?.[1];
    if (named && !/country|role|location|region|office/i.test(named)) return yesNo(field, /rwanda|sudan/i.test(named));
    return null; // "authorised to work in the country where this role is based" — unknowable
  }
  if (/relocat/i.test(L))
    return isSelect
      ? text("yes")
      : { kind: "text", value: profile.authorization.willingToRelocate };

  // ── location ───────────────────────────────────────────────────────────────
  if (
    /(where|what) (location|city|country).*(based|located|live|reside)|current (location|city)|city.*(country|state)|^location$|country of (legal )?residence|which country|where .*(living|live now|currently live)/i.test(
      L,
    )
  ) {
    if (isSelect) {
      const o = pick(
        field.values,
        /rwanda/i,
        /africa/i,
        /emea/i,
        /^other/i,
        /outside/i,
      );
      return o ? { kind: "select", option: o } : null;
    }
    return {
      kind: "text",
      value: `${profile.identity.city}, ${profile.identity.country}`,
    };
  }

  // ── experience ─────────────────────────────────────────────────────────────
  if (
    /years? of (professional |relevant |related )?(experience|exp)|how many years/i.test(
      L,
    )
  ) {
    const n = profile.work.yearsSoftwareProfessional;
    if (isSelect) {
      const o = rangeOption(field.values, n);
      return o ? { kind: "select", option: o } : null;
    }
    return { kind: "text", value: String(n) };
  }
  if (/highest (level of )?(education|degree)|degree/i.test(L) && !isSelect)
    return { kind: "text", value: profile.work.highestDegree };

  // ── pay, timing ────────────────────────────────────────────────────────────
  if (
    /hourly|per hour|rate/i.test(L) &&
    /(expect|desired|require|rate)/i.test(L) &&
    !isSelect
  ) {
    return {
      kind: "text",
      value: `USD ${profile.compensation.remoteExpectedUSDPerHour}/hour`,
    };
  }
  if (
    /salary|compensation|pay (expectation|range)|expected (pay|comp)|desired (pay|salary)/i.test(
      L,
    )
  ) {
    if (isSelect) return null;
    return {
      kind: "text",
      value: `USD ${profile.compensation.remoteExpectedUSDPerYear} per year (negotiable)`,
    };
  }
  if (
    /notice period|when (can|could) you start|start date|earliest (start|date)|availability to start/i.test(
      L,
    )
  ) {
    return isSelect
      ? pick(field.values, /immediate|asap|now|less than|within 2|2 weeks/i)
        ? {
            kind: "select",
            option: pick(
              field.values,
              /immediate|asap|now|less than|within 2|2 weeks/i,
            )!,
          }
        : null
      : { kind: "text", value: profile.work.startDate };
  }

  // ── the usual yes/no boilerplate ───────────────────────────────────────────
  if (
    /(previously|ever|formerly|currently) (been )?(employed|worked|work) (with|for|at)|former employee|have you (ever )?(applied|interviewed)/i.test(
      L,
    )
  ) {
    const o = pick(field.values, /^no\b|not a former|never/i);
    return isSelect
      ? o
        ? { kind: "select", option: o }
        : null
      : { kind: "text", value: "No" };
  }
  if (/partner agency|staffing agency|work for.*(agency|vendor)/i.test(L))
    return yesNo(field, false);
  if (/referr?(ed|al)|who referred|employee referral/i.test(L))
    return isSelect
      ? pick(field.values, /^no\b|none|not referred/i)
        ? {
            kind: "select",
            option: pick(field.values, /^no\b|none|not referred/i)!,
          }
        : null
      : // Forms that ask "if so, list their name" say "answer N/A" when not.
        { kind: "text", value: /if so|if yes|list (their|the) name/i.test(L) ? "N/A" : "No" };
  if (
    /(at least )?18 years|of legal (working )?age|over the age of 18/i.test(L)
  )
    return yesNo(field, true);
  if (
    /how did you (hear|find|learn|find out)|where did you (hear|find|see)|^source\b|how you heard/i.test(
      L,
    )
  ) {
    if (isSelect) {
      const o = pick(
        field.values,
        /careers? (page|site)|company (web)?site|website/i,
        /job board|online/i,
        /^other/i,
      );
      return o ? { kind: "select", option: o } : null;
    }
    return { kind: "text", value: profile.sourceAnswer };
  }
  if (/english/i.test(L) && /(proficien|fluen|level|speak)/i.test(L)) {
    return isSelect
      ? pick(field.values, /native|fluent|full professional|advanced|c2|c1/i)
        ? {
            kind: "select",
            option: pick(
              field.values,
              /native|fluent|full professional|advanced|c2|c1/i,
            )!,
          }
        : null
      : {
          kind: "text",
          value: "Fluent (professional working proficiency); Arabic native",
        };
  }
  if (
    /privacy|consent|agree|acknowledge|accept|terms|data (processing|retention)|certify|attest|confirm i have read|i understand|have read and/i.test(
      L,
    )
  ) {
    if (field.type === "boolean" || field.type === "multi_value_multi_select") {
      const o = pick(
        field.values,
        /yes|agree|acknowledge|consent|accept|i (have read|understand)/i,
      );
      return field.type === "boolean"
        ? { kind: "check", value: true }
        : o
          ? { kind: "multi", options: [o] }
          : null;
    }
    const o = pick(
      field.values,
      /yes|agree|acknowledge|consent|accept|i (have read|understand)/i,
    );
    return o
      ? { kind: "select", option: o }
      : isSelect
        ? null
        : { kind: "text", value: "Yes" };
  }

  // ── free text a person would write: generated per job, gated like a letter ─
  if (
    !isSelect &&
    (field.type === "textarea" ||
      /why|tell us|describe|what (excites|interests|draws)|motivat|anything else|additional information|cover letter|about yourself|project you|have you built|share (a|an|your)|example of/i.test(
        L,
      ))
  ) {
    return {
      kind: "prose",
      prompt: `${label} (for the ${ctx.role} role at ${ctx.company})`,
    };
  }

  return q.required ? null : { kind: "skip" };
}

/// Every unanswerable required question, quoted — the card's holdReason.
export function unanswerable(
  questions: AtsQuestion[],
  profile: AtsProfile,
  ctx: AnswerContext,
): string[] {
  return questions
    .filter((q) => q.required && answerQuestion(q, profile, ctx) === null)
    .map((q) => q.label.slice(0, 120));
}
