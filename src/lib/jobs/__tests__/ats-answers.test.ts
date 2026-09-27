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
    ).toEqual({ kind: "text", value: "No" });
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
