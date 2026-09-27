import { describe, expect, it } from "vitest";

import { decideFollowUp } from "../cadence";
import { classifyReply } from "../reply-classifier";
import { evaluateSendGate, GateInput, numbersIn } from "../send-gate";

const body = (extra = ""): string =>
  `Dear Wicloud team, I am applying for the Technical Support Engineer role. ${extra} ` +
  "I hold a BSc in Electrical Engineering from 2013 and have tested 33/13.8 kV substations since 2022. ".repeat(
    6,
  ) +
  "I document every fix clearly and work well on shift rotation. Kind regards, Osman Abdout, +250 780 984 777";

const base = (over: Partial<GateInput> = {}): GateInput => ({
  letter: {
    to: "jobs@wicloud.rw",
    subject: "Technical Support Engineer Application Osman Abdout",
    body: body(),
  },
  company: "Wicloud",
  role: "Technical Support Engineer",
  postingText:
    "Send your CV to jobs@wicloud.rw before 2026-10-16. Technical Support Engineer.",
  deadline: "2026-10-16",
  today: "2026-09-28",
  recentlyContacted: false,
  allowedNumbers: ["2013", "33", "13.8", "2022"],
  attachment: { exists: true, pages: 1 },
  ...over,
});

describe("send gate", () => {
  it("passes a clean letter", () => {
    const v = evaluateSendGate(base());
    expect(v.hard).toEqual([]);
    expect(v.pass).toBe(true);
  });

  it("holds placeholders", () => {
    const v = evaluateSendGate(
      base({ letter: { ...base().letter, body: body("Salary: [FILL IN]") } }),
    );
    expect(v.pass).toBe(false);
    expect(v.hard.join()).toMatch(/placeholder/);
  });

  it("holds a number the CVs cannot back", () => {
    const v = evaluateSendGate(
      base({
        letter: {
          ...base().letter,
          body: body("I have 15 years of experience."),
        },
      }),
    );
    expect(v.hard.join()).toMatch(/unbacked numbers: 15/);
  });

  it("allows numbers quoted from the posting", () => {
    const v = evaluateSendGate(
      base({
        letter: { ...base().letter, body: body("Deadline 2026-10-16 noted.") },
      }),
    );
    expect(v.hard.join()).not.toMatch(/unbacked/);
  });

  it("holds an expired posting, a stranger address and a repeat", () => {
    expect(
      evaluateSendGate(base({ deadline: "2026-09-01" })).hard.join(),
    ).toMatch(/deadline passed/);
    expect(
      evaluateSendGate(
        base({ letter: { ...base().letter, to: "ceo@elsewhere.com" } }),
      ).hard.join(),
    ).toMatch(/not on the posting/);
    expect(
      evaluateSendGate(base({ recentlyContacted: true })).hard.join(),
    ).toMatch(/already contacted/);
  });

  it("turns an extra-document ask into a need, not a send", () => {
    const v = evaluateSendGate(
      base({
        postingText: `${base().postingText} Include your salary expectation and certified copies.`,
      }),
    );
    expect(v.pass).toBe(false);
    expect(v.needs).toEqual([
      "certified copies of certificates",
      "a salary expectation",
    ]);
  });

  it("splits ratings into checkable parts", () => {
    expect(numbersIn("33/13.8 kV since 2022")).toEqual(["33", "13.8", "2022"]);
  });
});

describe("reply classifier", () => {
  const r = (subject: string, text: string, from = "hr@acme.rw") =>
    classifyReply({ from, subject, body: text });

  it("reads the four common shapes", () => {
    expect(
      r(
        "Application received",
        "Thank you for your application. We will review it.",
      ),
    ).toBe("ack");
    expect(
      r(
        "Interview invitation",
        "We would like to invite you to an interview on Tuesday.",
      ),
    ).toBe("interview");
    expect(
      r("Your application", "Unfortunately we will not be moving forward."),
    ).toBe("rejection");
    expect(r("Offer", "We are pleased to offer you the position.")).toBe(
      "offer",
    );
  });

  it("treats a rejection that mentions interviews as a rejection", () => {
    expect(
      r("Update", "Unfortunately we will not invite you to interview."),
    ).toBe("rejection");
  });

  it("sends a plain human question to RESPONSE and a bounce to ambiguous", () => {
    expect(r("Re: application", "Can you send your degree certificate?")).toBe(
      "response",
    );
    expect(
      r(
        "Undeliverable: application",
        "Delivery failed",
        "mailer-daemon@outlook.com",
      ),
    ).toBe("ambiguous");
  });
});

describe("follow-up cadence", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const at = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("waits a week, then nudges twice, then archives", () => {
    expect(
      decideFollowUp({ appliedAt: at(6), touchNumber: 1, replied: false, now }),
    ).toBe("none");
    expect(
      decideFollowUp({ appliedAt: at(7), touchNumber: 1, replied: false, now }),
    ).toBe("touch2");
    expect(
      decideFollowUp({
        appliedAt: at(14),
        touchNumber: 2,
        replied: false,
        now,
      }),
    ).toBe("touch3");
    expect(
      decideFollowUp({
        appliedAt: at(21),
        touchNumber: 3,
        replied: false,
        now,
      }),
    ).toBe("archive");
  });

  it("freezes on any reply", () => {
    expect(
      decideFollowUp({ appliedAt: at(30), touchNumber: 1, replied: true, now }),
    ).toBe("none");
  });
});

import { byLane, byVariant, summarizeOutcomes } from "../learn-metrics";

describe("learn metrics", () => {
  const sent = (crmId: string, variant: string, campaign: string, ts = "2026-10-01T08:00:00Z") => ({
    ts,
    kind: "sent",
    crmId,
    variant,
    campaign,
  });
  const reply = (crmId: string, kind: string, ts: string) => ({ ts, kind: "reply", crmId, detail: `${kind}: …` });
  const lines = [
    sent("a", "cv:web@1 letter:x@1", "WEB_DEVELOPER"),
    sent("b", "cv:web@1 letter:x@2", "WEB_DEVELOPER"),
    sent("c", "cv:protection@1 letter:y@1", "ELECTRICAL"),
    reply("a", "interview", "2026-10-03T08:00:00Z"),
    reply("b", "ack", "2026-10-01T09:00:00Z"),
    reply("c", "rejection", "2026-10-05T08:00:00Z"),
  ];

  it("counts replies, not acknowledgements, per variant id", () => {
    const v = summarizeOutcomes(lines, byVariant);
    const web = v.find((o) => o.key === "cv:web@1")!;
    expect(web.sent).toBe(2);
    expect(web.replies).toBe(1);
    expect(web.interviews).toBe(1);
    expect(web.medianDaysToReply).toBe(2);
  });

  it("refuses a rate below the minimum sample", () => {
    const lane = summarizeOutcomes(lines, byLane).find((o) => o.key === "ELECTRICAL")!;
    expect(lane.rejections).toBe(1);
    expect(lane.replyRate).toBeNull();
  });
});

import { similarRole } from "../deduplication";

describe("similar role", () => {
  it("matches the same role worded two ways", () => {
    expect(similarRole("Technical Support Engineers", "Technical Support Engineer (freelance)")).toBe(true);
    expect(similarRole("IT Lead", "IT Lead")).toBe(true);
  });
  it("keeps different roles apart", () => {
    expect(similarRole("Windows Forum Freelancer", "Technical Support Engineer")).toBe(false);
    expect(similarRole("IT Lead", "Finance Lead")).toBe(false);
  });
});

describe("send gate — ATS channel", () => {
  it("does not demand an address or subject for a hosted form", () => {
    const v = evaluateSendGate(
      base({ channel: "ats", letter: { to: "", subject: "", body: base().letter.body }, postingText: "Technical Support Engineer at Wicloud." }),
    );
    expect(v.hard).toEqual([]);
  });
});

describe("reply classifier — acknowledgements that mention interviews", () => {
  it("keeps 'thank you for applying' as ack even when it describes the process", () => {
    expect(
      classifyReply({
        from: "no-reply@us.greenhouse-mail.io",
        subject: "Fingerprint Has Received Your Application - Thank You!",
        body: "Our team will review your application. If selected, you will move to the next steps of our interview process.",
      }),
    ).toBe("ack");
  });
  it("still catches a real invitation", () => {
    expect(
      classifyReply({ from: "recruiter@acme.com", subject: "Re: your application", body: "We'd like to invite you to an interview. Please book a time: https://calendly.com/acme/30min" }),
    ).toBe("interview");
  });
});
