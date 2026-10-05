import { describe, expect, it } from "vitest";

import {
  answerQuestion,
  AtsProfile,
  AtsQuestion,
  rangeOption,
  unanswerable,
} from "../ats-answers";

const profile: AtsProfile = {
  identity: {
    firstName: "Osman",
    lastName: "Abdout",
    fullName: "Osman Abdout",
    email: "osmanabdout@hotmail.com",
    phone: "+250780984777",
    city: "Kigali",
    country: "Rwanda",
    timezone: "CAT (UTC+2)",
    nationality: "Sudanese",
  },
  links: {
    linkedin: "https://www.linkedin.com/in/abdout",
    github: "https://github.com/abdout",
    githubOrg: "https://github.com/databayt",
    website: "https://databayt.org",
    portfolio: "https://balqalam.com",
  },
  work: {
    currentTitle: "Founder & Full-stack Engineer",
    currentCompany: "Databayt",
    yearsSoftwareProfessional: 2,
    highestDegree: "BSc Electrical Engineering",
    noticePeriod: "Available immediately",
    startDate: "Immediately",
  },
  authorization: {
    authorizedRwanda: true,
    authorizedUS: false,
    authorizedUK: false,
    authorizedEU: false,
    authorizedCanada: false,
    needsSponsorshipForCountryBoundRoles: true,
    canWorkAsRemoteContractorFromRwanda: true,
    willingToRelocate: "Yes — would need visa sponsorship",
  },
  compensation: {
    remoteExpectedUSDPerYear: "36000-48000",
    remoteExpectedUSDPerHour: "20-25",
  },
  sourceAnswer: "Company careers page",
};
const ctx = {
  company: "Customer.io",
  role: "Senior Software Engineer, Full Stack",
};

const sel = (
  label: string,
  values: string[],
  required = true,
): AtsQuestion => ({
  label,
  required,
  fields: [
    {
      name: "q",
      type: "multi_value_single_select",
      values: values.map((l) => ({ label: l })),
    },
  ],
});
const txt = (
  label: string,
  required = true,
  type = "input_text",
): AtsQuestion => ({ label, required, fields: [{ name: "q", type }] });

describe("ATS answers — the Customer.io form", () => {
  it("fills identity and links from the profile", () => {
    expect(
      answerQuestion(
        txt("What is your preferred first and last name?"),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "text", value: "Osman Abdout" });
    expect(answerQuestion(txt("LinkedIn Profile"), profile, ctx)).toEqual({
      kind: "text",
      value: "https://www.linkedin.com/in/abdout",
    });
    expect(
      answerQuestion(
        txt("What location are you based in? (city, state, and country)"),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "text", value: "Kigali, Rwanda" });
  });

  it("answers experience from ranges truthfully", () => {
    expect(
      answerQuestion(
        sel("Years of Experience", [
          "0-3 years",
          "4-6 years",
          "7 or more years",
        ]),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "0-3 years" });
    expect(
      rangeOption(
        [{ label: "Less than 1" }, { label: "1-2" }, { label: "3+" }],
        2,
      ),
    ).toBe("1-2");
  });

  it("answers authorisation and sponsorship honestly", () => {
    expect(
      answerQuestion(
        sel("Are you authorized to work in country of residence?", [
          "Yes",
          "No",
          "Not Applicable (I do not plan, or currently, reside in the United States)",
        ]),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "Yes" });
    expect(
      answerQuestion(
        sel("Will you require work authorization/visa sponsorship?", [
          "Yes",
          "No",
        ]),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "Yes" });
    expect(
      answerQuestion(
        sel("Are you legally authorized to work in the United States?", [
          "Yes",
          "No",
        ]),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "No" });
  });

  it("handles the former-employee boilerplate and its follow-ups", () => {
    expect(
      answerQuestion(
        sel("Have you previously been employed with Customer.io?", [
          "No, I am not a former employee",
          "Yes, I am a former corporate employee",
        ]),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "No, I am not a former employee" });
    expect(
      answerQuestion(
        txt(
          "If you have previously been employed with Customer.io, please provide the department or role that you had.",
        ),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "text", value: "N/A" });
    expect(
      answerQuestion(
        txt(
          "Were you referred to this position by a current or former team member? If so, please list their name below.",
        ),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "text", value: "N/A" });
    expect(
      answerQuestion(
        sel(
          "Do you currently work for, or have you worked for, a company or partner agency that has a relationship with Customer.io?",
          ["Yes", "No"],
        ),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "No" });
  });

  it("declines voluntary self-identification", () => {
    expect(
      answerQuestion(
        sel("Gender", ["Male", "Female", "Decline To Self Identify"], false),
        profile,
        ctx,
      ),
    ).toEqual({ kind: "select", option: "Decline To Self Identify" });
  });

  it("sends prose questions to the writer and refuses what it cannot know", () => {
    expect(
      answerQuestion(
        txt("Why do you want to work at Customer.io?", true, "textarea"),
        profile,
        ctx,
      )?.kind,
    ).toBe("prose");
    expect(
      answerQuestion(
        txt("Have you ever been convicted of a felony?"),
        profile,
        ctx,
      ),
    ).toBeNull();
    expect(
      unanswerable(
        [
          txt("Have you ever been convicted of a felony?"),
          txt("LinkedIn Profile"),
        ],
        profile,
        ctx,
      ),
    ).toEqual(["Have you ever been convicted of a felony?"]);
  });
});

describe("ATS answers — the Comet form", () => {
  it("answers named-country authorisation truthfully", () => {
    expect(answerQuestion(sel("Can you legally work in Europe?", ["Yes", "No"]), profile, ctx)).toEqual({ kind: "select", option: "No" });
    expect(answerQuestion(sel("Can you legally work in Israel?", ["Yes", "No"]), profile, ctx)).toEqual({ kind: "select", option: "No" });
    expect(answerQuestion(sel("Can you legally work in Rwanda?", ["Yes", "No"]), profile, ctx)).toEqual({ kind: "select", option: "Yes" });
  });
  it("answers 'at least N years' from the real count", () => {
    expect(answerQuestion(sel("Do you have at least 3+ years of experience with React?", ["Yes", "No"]), profile, ctx)).toEqual({ kind: "select", option: "No" });
    expect(answerQuestion(sel("Do you have at least 2 years of professional experience?", ["Yes", "No"]), profile, ctx)).toEqual({ kind: "select", option: "Yes" });
  });
  it("leaves the location autocomplete to the submitter", () => {
    expect(answerQuestion({ label: "Location (City)", required: true, fields: [{ name: "candidate-location", type: "location" }] }, profile, ctx)).toEqual({ kind: "skip" });
  });
});

describe("ATS answers — Ashby forms", () => {
  const bool = (label: string): AtsQuestion => ({ label, required: true, fields: [{ name: "b", type: "boolean" }] });
  it("fills Ashby system fields", () => {
    expect(answerQuestion({ label: "Name", required: true, fields: [{ name: "_systemfield_name", type: "input_text" }] }, profile, ctx)).toEqual({ kind: "text", value: "Osman Abdout" });
    expect(answerQuestion({ label: "Resume", required: true, fields: [{ name: "_systemfield_resume", type: "input_file" }] }, profile, ctx)).toEqual({ kind: "file", which: "resume" });
  });
  it("answers time-zone and residence questions", () => {
    expect(answerQuestion(bool("Are you in an European time zone?"), profile, ctx)).toEqual({ kind: "check", value: true });
    expect(answerQuestion(bool("Are you legally authorized to work in the country you are based in?"), profile, ctx)).toEqual({ kind: "check", value: true });
    expect(answerQuestion(bool("Can you work US Pacific time zone hours?"), profile, ctx)).toEqual({ kind: "check", value: false });
  });
});

describe("ATS answers — Wikimedia / ZipRecruiter wordings (2026-09-28)", () => {
  const yn = ["Yes", "No"];
  it("reads 'the country which you reside' as residence", () => {
    expect(answerQuestion(sel("Are you legally authorized to work in the country with which you reside? ", yn), profile, ctx)).toEqual({ kind: "select", option: "Yes" });
    expect(answerQuestion(sel("Are you legally authorized to work in the country which you reside? ", yn), profile, ctx)).toEqual({ kind: "select", option: "Yes" });
  });
  it("counts 'five (5) years' against the real years", () => {
    expect(answerQuestion(sel("Do you have five (5) years of experience in full stack software development in a professional/work environment? ", yn), profile, ctx)).toEqual({ kind: "select", option: "No" });
  });
  it("answers first-time applying", () => {
    expect(answerQuestion(sel("Is this your first time applying for this role within the last 12-months? ", yn), profile, ctx)).toEqual({ kind: "select", option: "Yes" });
  });
  it("acknowledges 'confirm your knowledge of this', including the contractor one", () => {
    expect(answerQuestion(sel("Please note this role is a contract position. Contract roles are not eligible for benefits outside of the required, local statutory benefits (as applicable). Please confirm your knowledge of this by selecting 'Yes'.  ", yn), profile, ctx)).toEqual({ kind: "select", option: "Yes" });
    const contractor = sel("Please note that sponsorship is not allowed for this role. Also, if you are an international candidate, please confirm that your work authorization allows you to work as an independent contractor or your own business entity. Please confirm your knowledge of this by selecting 'Yes'.", yn);
    expect(answerQuestion(contractor, profile, ctx)).toEqual({ kind: "select", option: "Yes" });
  });
  it("still holds what the profile does not know", () => {
    expect(answerQuestion(sel("Are you considered a business entity? ", yn), profile, ctx)).toBeNull();
    expect(answerQuestion(sel("Does your current work authorization expire?", ["Yes", "No", "N/A"]), profile, ctx)).toBeNull();
  });
});

describe("ATS answers — Canonical / Affirm / Muck Rack wordings (2026-09-28)", () => {
  it("picks a region-named time zone", () => {
    expect(answerQuestion(sel("What time zone are you in?", ["American Time Zones", "Asia Pacific Time Zones", "Europe, Middle East or Africa Time Zones", "Indian Ocean Time Zones"]), profile, ctx)).toEqual({ kind: "select", option: "Europe, Middle East or Africa Time Zones" });
    expect(answerQuestion(sel("Which Timezone are you based in?", ["APAC", "EMEA", "Americas"]), profile, ctx)).toEqual({ kind: "select", option: "EMEA" });
    expect(answerQuestion(sel("What time zone are you currently based in?", ["Eastern Time (ET)", "Pacific Time (PT)"]), profile, ctx)).toBeNull();
  });
  it("answers location selects and 'presently located'", () => {
    expect(answerQuestion(sel("Where are you located?", ["Bulgaria", "Canada", "United States", "Other"]), profile, ctx)).toEqual({ kind: "select", option: "Other" });
    expect(answerQuestion(txt("Where are you presently located?"), profile, ctx)).toEqual({ kind: "text", value: "Kigali, Rwanda" });
  });
  it("picks the nationality from the profile", () => {
    const q: AtsQuestion = { label: "Please indicate your nationality:", required: true, fields: [{ name: "n", type: "multi_value_multi_select", values: ["Sudanese", "Swazi", "Rwandan"].map((label) => ({ label })) }] };
    expect(answerQuestion(q, profile, ctx)).toEqual({ kind: "multi", options: ["Sudanese"] });
  });
  it("answers first-learned and never-employed selects", () => {
    expect(answerQuestion(sel(" How did you first learn about Affirm as an employer? ", ["Affirm blog", "Affirm’s Career Site", "LinkedIn"]), profile, ctx)).toEqual({ kind: "select", option: "Affirm’s Career Site" });
    expect(answerQuestion(sel("Have you previously been employed at Affirm for any length of time?", ["I have not previously been employed at Affirm", "I have been employed at Affirm as a contractor"]), profile, ctx)).toEqual({ kind: "select", option: "I have not previously been employed at Affirm" });
  });
});

describe("ATS answers — held-card wordings (2026-10-05)", () => {
  const p5: AtsProfile = {
    ...profile,
    work: { ...profile.work, yearsSoftwareProfessional: 5 },
    skills: { yes: ["docker", "typescript"], no: ["kubernetes", "hadoop", "spark", "hive"] },
  } as AtsProfile;
  const multi = (label: string, values: string[]): AtsQuestion => ({
    label,
    required: true,
    fields: [{ name: "q", type: "multi_value_multi_select", values: values.map((l) => ({ label: l })) }],
  });
  it("picks the experience band without over-claiming (5 years, bands 3–5 / 5+)", () => {
    const bands = [
      "Less than 1 year of professional experience",
      "More than 3 years of professional experience but less than 5 years",
      "More than 5 year of professional experience but less than 8 years",
    ];
    expect(rangeOption(bands.map((label) => ({ label })), 5)).toBe(bands[1]);
    expect(rangeOption(bands.map((label) => ({ label })), 4)).toBe(bands[1]);
  });
  it("'X and/or Y' is yes when he has one; unknown big-data stack is no", () => {
    expect(answerQuestion(sel("Do you have experience with containerization technologies like Docker and/or Kubernetes?", ["Yes", "No"]), p5, ctx)).toEqual({ kind: "select", option: "Yes" });
    expect(answerQuestion(sel("Do you have experience with big data technologies such as Hadoop, Spark, and/or Hive?", ["Yes", "No"]), p5, ctx)).toEqual({ kind: "select", option: "No" });
  });
  it("maps a BSc to the Bachelor's option", () => {
    expect(answerQuestion(sel("Education: What is the highest degree or qualification you currently hold?", ["Master's Degree/ Maîtrise (M.A.,M.S, M.Phil)", "Bachelor's/First Degree /Bachelier /Premier cycle  (e.g. BA, BS, B.Com)"]), p5, ctx)).toEqual({ kind: "select", option: "Bachelor's/First Degree /Bachelier /Premier cycle  (e.g. BA, BS, B.Com)" });
  });
  it("declines free-text pronouns; acknowledges an AI use statement; Rwanda for countries of operation", () => {
    expect(answerQuestion(txt("What are your personal pronouns?"), p5, ctx)).toEqual({ kind: "text", value: "Prefer not to say" });
    expect(answerQuestion(multi("AI Use Statement: We expect candidates to engage personally and authentically in interviews.", ["Acknowledge/Confirm"]), p5, ctx)).toEqual({ kind: "multi", options: ["Acknowledge/Confirm"] });
    expect(answerQuestion(multi("In compliance with local law, all persons hired will be required to verify identity and eligibility to work in our countries of operation", ["Kenya", "Rwanda", "Uganda"]), { ...p5, authorization: { ...p5.authorization, authorizedRwanda: true } } as AtsProfile, ctx)).toEqual({ kind: "multi", options: ["Rwanda"] });
  });
  it("still holds work authorization 'in the country where this position is based'", () => {
    expect(answerQuestion(sel("Do you currently have legal work authorization in the country where this position is based?", ["Yes", "No"]), p5, ctx)).toBeNull();
  });
});
