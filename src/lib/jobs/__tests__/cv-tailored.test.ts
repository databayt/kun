import { describe, expect, it } from "vitest";

import {
  CareerRecord,
  cvName,
  gateTailoredCv,
  profileForCampaign,
  renderAtsHtml,
  TailoredCv,
} from "../cv-tailored";
import { numbersIn } from "../send-gate";

const career: CareerRecord = {
  identity: {
    legalName: "Osman Mohamed Elamin Osman Ali",
    brandName: "Osman Abdout",
    dateOfBirth: "1990-01-01",
    nationality: "Sudanese",
    location: "Kigali, Rwanda",
    email: "osmanabdout@hotmail.com",
    phone: "+250 780 984 777",
    linkedin: "linkedin.com/in/abdout",
    github: "github.com/abdout",
    website: "databayt.org",
    languages: ["Arabic (native)", "English (fluent)"],
    passport: { validUntil: "Dec 2034" },
  },
  seafarerDocuments: { seamansBook: "14148", seamansBookValidUntil: "May 2027" },
  education: [
    {
      degree: "BSc Electrical & Control Engineering",
      school: "Arab Academy (AASTMT)",
      date: "July 2013",
    },
  ],
  certifications: [{ name: "Crowd management — STCW Reg. A-V/2.4" }],
  experience: [
    {
      id: "sea",
      role: "Electro-Technical Officer",
      org: "Massi Shipping",
      start: "Sep 2014",
      end: "Sep 2021",
      bullets: [
        "Kept main switchboards in service (400 V systems, up to 800 kVA alternators).",
      ],
    },
  ],
  seaService: [
    {
      vessel: "MT Candy",
      type: "Chemical / oil products tanker",
      company: "Massi Shipping",
      from: "May 2021",
      to: "Sep 2021",
    },
  ],
};

const cv = (over: Partial<TailoredCv> = {}): TailoredCv => ({
  profile: "maritime",
  headline: "Electro-Technical Officer (ETO)",
  summary:
    "Electro-Technical Officer with seven years at sea keeping main switchboards, generators and alarm systems in service on tankers and ferries.",
  skills: ["Main switchboard", "Alarm & monitoring"],
  experience: [
    {
      role: "Electro-Technical Officer",
      org: "Massi Shipping",
      place: "At sea",
      dates: "Sep 2014 – Sep 2021",
      bullets: [
        "Kept main switchboards in service (400 V systems, up to 800 kVA alternators).",
      ],
    },
  ],
  seaService: [
    {
      vessel: "MT Candy",
      type: "Chemical / oil products tanker",
      company: "Massi Shipping",
      dates: "May 2021 – Sep 2021",
    },
  ],
  education: [
    {
      degree: "BSc Electrical & Control Engineering",
      school: "Arab Academy (AASTMT)",
      date: "July 2013",
    },
  ],
  certifications: ["Crowd management — STCW Reg. A-V/2.4"],
  mustHave: ["main switchboard", "alarm monitoring"],
  keywordsCovered: ["main switchboard", "alarm monitoring"],
  keywordsMissing: [],
  ...over,
});

const ctx = { factNumbers: [], postingText: "", numbersIn };

describe("profileForCampaign", () => {
  it("routes lanes to the right CV", () => {
    expect(profileForCampaign("MARINE_ETO")).toBe("maritime");
    expect(profileForCampaign("PROTECTION")).toBe("engineering");
    expect(profileForCampaign("ELECTRICAL")).toBe("engineering");
    expect(profileForCampaign("REMOTE_WORLDWIDE")).toBe("software");
    expect(profileForCampaign(null)).toBe("software");
  });
});

describe("renderAtsHtml", () => {
  const html = renderAtsHtml(cv(), career);

  it("is a single-column, normal-flow document an ATS can parse", () => {
    expect(html).not.toMatch(/position\s*:\s*absolute/);
    expect(html).not.toMatch(/<table|display\s*:\s*(grid|flex)|columns\s*:/);
    expect(html).toMatch(/<ul><li>/);
    for (const h of [
      "Summary",
      "Skills",
      "Experience",
      "Sea Service",
      "Education",
      "Certifications",
    ])
      expect(html).toContain(`<h2>${h}</h2>`);
  });

  it("uses the legal name and the seafarer block on maritime CVs only", () => {
    expect(cvName(cv(), career)).toBe("Osman Mohamed Elamin Osman Ali");
    expect(html).toContain("No.: 14148, valid until May 2027");
    expect(html).toContain("Passport: valid until Dec 2034");
    expect(html).not.toContain("Certificate of Competency");
    
    const eng = renderAtsHtml(
      cv({ profile: "engineering", seaService: [] }),
      career,
    );
    expect(eng).toContain("<h1>Osman Abdout</h1>");
    expect(eng).not.toContain("Certificate of Competency");
    expect(eng).not.toContain("Sea Service");
  });

  it("never prints a passport number", () => {
    const withNumber = {
      ...career,
      identity: { ...career.identity, passport: { validUntil: "Dec 2034", number: "P12950391" } },
    } as CareerRecord;
    expect(renderAtsHtml(cv(), withNumber)).not.toContain("P12950391");
  });

  it("escapes HTML in content", () => {
    expect(renderAtsHtml(cv({ headline: "ETO <script>" }), career)).toContain(
      "ETO &lt;script&gt;",
    );
  });
});

describe("gateTailoredCv", () => {
  it("passes a CV built only from the record", () => {
    const v = gateTailoredCv(cv(), career, ctx);
    expect(v.problems).toEqual([]);
    expect(v.pass).toBe(true);
    expect(v.coverage).toBe(100);
  });

  it("rejects an invented vessel", () => {
    const v = gateTailoredCv(
      cv({
        seaService: [
          {
            vessel: "MV Ocean Star",
            type: "Container ship",
            company: "Massi Shipping",
            dates: "2020",
          },
        ],
      }),
      career,
      ctx,
    );
    expect(v.pass).toBe(false);
    expect(v.problems.join()).toMatch(
      /vessels not in the record: MV Ocean Star/,
    );
  });

  it("rejects an invented employer and an invented number", () => {
    const v = gateTailoredCv(
      cv({
        experience: [
          {
            role: "ETO",
            org: "Maersk Line",
            dates: "2019",
            bullets: ["Maintained 6.6 kV switchboards on 12 vessels."],
          },
        ],
      }),
      career,
      ctx,
    );
    expect(v.problems.join()).toMatch(
      /employers not in the record: Maersk Line/,
    );
    expect(v.problems.join()).toMatch(/numbers not in the record or posting/);
  });

  it("rejects an invented certificate", () => {
    const v = gateTailoredCv(
      cv({ certifications: ["STCW A-III/6 Electro-Technical Officer CoC"] }),
      career,
      ctx,
    );
    expect(v.problems.join()).toMatch(/certifications not in the record/);
  });

  it("allows a number the posting itself states", () => {
    const v = gateTailoredCv(
      cv({ summary: `${cv().summary} Ready for a 4 month contract.` }),
      career,
      {
        ...ctx,
        postingText: "Contract length 4 months",
      },
    );
    expect(v.problems).toEqual([]);
  });

  it("measures coverage on the CV text, not on the model's claim", () => {
    const v = gateTailoredCv(
      cv({
        mustHave: [
          "main switchboard",
          "dynamic positioning",
          "high voltage 6.6 kV",
        ],
        keywordsCovered: ["dynamic positioning"],
      }),
      career,
      { ...ctx, postingText: "6.6 kV" },
    );
    expect(v.coverage).toBe(33);
    expect(v.missing).toEqual(["dynamic positioning", "high voltage 6.6 kV"]);
  });

  it("accepts the expired medical only with the honest renewal wording", () => {
    const withMedical: CareerRecord = {
      ...career,
      certifications: [...career.certifications, { name: "Seafarer medical certificate (MLC 2006 / STCW)", stale: true }],
    };
    const ok = gateTailoredCv(
      cv({ certifications: ["Seafarer medical certificate (MLC 2006) — renewal on joining"] }),
      withMedical,
      ctx,
    );
    expect(ok.problems).toEqual([]);
    const bad = gateTailoredCv(cv({ summary: `${cv().summary} Seafarer medical certificate valid.` }), withMedical, ctx);
    expect(bad.problems.join()).toMatch(/expired medical as valid/);
  });

  it("accepts expired training only as refresher due, and never a claimed CoC", () => {
    const rec: CareerRecord = {
      ...career,
      certifications: [...career.certifications, { name: "Fire Prevention and Fire Fighting — STCW A-VI/1-2", stale: true }],
    };
    expect(gateTailoredCv(cv({ certifications: ["Fire Prevention and Fire Fighting — STCW A-VI/1-2 — refresher due"] }), rec, ctx).problems).toEqual([]);
    const coc = gateTailoredCv(cv({ summary: `${cv().summary} Holder of an ETO certificate of competency.` }), rec, ctx);
    expect(coc.problems.join()).toMatch(/certificate of competency he does not hold/);
  });

  it("reads BSc as a bachelor's degree", () => {
    const v = gateTailoredCv(cv({ mustHave: ["Bachelor's degree in Electrical Engineering"] }), career, ctx);
    expect(v.missing).toEqual([]);
  });
});
