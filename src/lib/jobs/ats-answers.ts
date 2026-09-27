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
const NO = /^no\b/i;

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
    /country (of|where you) (residence|reside|live)|where you (currently )?(live|reside)/i.test(
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
  if (/time ?zone/i.test(L) && !isSelect)
    return { kind: "text", value: profile.identity.timezone };

  // ── conditional follow-ups ("If you answered yes…") — N/A, before any rule
  //    that would read the words inside them
  if (
    /^if (you|yes|so)|if you answered|if applicable|please (provide|list|specify).*(if|former|previous)/i.test(
      L,
    )
  ) {
    return { kind: "text", value: "N/A" };
  }

  // ── work authorisation & sponsorship ───────────────────────────────────────
  if (/sponsor/i.test(L))
    return yesNo(
      field,
      profile.authorization.needsSponsorshipForCountryBoundRoles,
    );
  if (
    /authori[sz]ed|legally (eligible|permitted|able)|right to work|eligible to work|work permit/i.test(
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
    return null; // "authorised to work in the country where this role is based" — unknowable
  }
  if (/relocat/i.test(L))
    return isSelect
      ? text("yes")
      : { kind: "text", value: profile.authorization.willingToRelocate };

  // ── location ───────────────────────────────────────────────────────────────
  if (
    /(where|what) (location|city|country).*(based|located|live|reside)|current (location|city)|city.*(country|state)|^location$|country of residence|which country/i.test(
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
      : { kind: "text", value: "No" };
  if (
    /(at least )?18 years|of legal (working )?age|over the age of 18/i.test(L)
  )
    return yesNo(field, true);
  if (
    /how did you (hear|find|learn)|where did you (hear|find|see)|source/i.test(
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
    /privacy|consent|agree|acknowledge|terms|data (processing|retention)|certify|attest/i.test(
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
      /why|tell us|describe|what (excites|interests|draws)|motivat|anything else|additional information|cover letter|about yourself|project you/i.test(
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
