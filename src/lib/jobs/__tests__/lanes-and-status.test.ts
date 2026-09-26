import { describe, expect, it } from "vitest";

import { DEFAULT_CAMPAIGNS, evaluateCampaignMatches } from "../campaigns";
import { crmStatusFor } from "../twenty-crm";
import { NormalizedJobInput } from "../types";

const job = (over: Partial<NormalizedJobInput>): NormalizedJobInput => ({
  title: "",
  company: "Acme",
  remoteType: "remote",
  employmentType: "freelance",
  description: "",
  responsibilities: [],
  requiredSkills: [],
  preferredSkills: [],
  ...over,
});

describe("the four low-hanging-fruit lanes", () => {
  it("are registered and active", () => {
    const ids = DEFAULT_CAMPAIGNS.filter((c) => c.isActive).map((c) => c.id);
    for (const id of [
      "ai-training-gigs",
      "freelance-contracts",
      "rwanda-tenders-databayt",
      "engineering-contracts",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("routes an Arabic AI-trainer gig to ai-training-gigs", () => {
    const hit = evaluateCampaignMatches(
      job({
        title: "Arabic Writer — AI Training",
        description: "Evaluate LLM responses as a native Arabic speaker.",
      }),
    );
    expect(hit).toContain("ai-training-gigs");
  });

  it("routes a software tender in Rwanda to rwanda-tenders-databayt", () => {
    const hit = evaluateCampaignMatches(
      job({
        title: "Request for Proposal: School Management System",
        description: "Tender for the development of a web platform.",
        location: "Kigali, Rwanda",
        remoteType: "onsite",
        employmentType: "contract",
      }),
    );
    expect(hit).toContain("rwanda-tenders-databayt");
  });

  it("routes a relay-testing contract to engineering-contracts", () => {
    const hit = evaluateCampaignMatches(
      job({
        title: "Commissioning Engineer (Protection)",
        description:
          "Substation relay testing with OMICRON CMC on a 132kV project.",
        location: "Nairobi, Kenya",
        remoteType: "onsite",
        employmentType: "contract",
      }),
    );
    expect(hit).toContain("engineering-contracts");
  });
});

describe("engine status → CRM applicationStatus", () => {
  it("collapses pre-application states to TO_APPLY", () => {
    for (const s of [
      "discovered",
      "analyzed",
      "qualified",
      "high_priority",
      "preparing",
      "ready_to_apply",
    ]) {
      expect(crmStatusFor(s)).toBe("TO_APPLY");
    }
  });

  it("maps the post-application states", () => {
    expect(crmStatusFor("applied")).toBe("APPLIED");
    expect(crmStatusFor("screen")).toBe("RESPONSE");
    expect(crmStatusFor("technical_round")).toBe("INTERVIEW");
    expect(crmStatusFor("offer")).toBe("OFFER");
    expect(crmStatusFor("rejected")).toBe("REJECTED");
    expect(crmStatusFor("withdrawn")).toBe("ARCHIVED");
  });

  it("has no mapping for an unknown status", () => {
    expect(crmStatusFor("nope")).toBeUndefined();
  });
});
