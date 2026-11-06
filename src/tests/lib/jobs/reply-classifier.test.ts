import { describe, expect, it } from "vitest";

import { classifyReply } from "@/lib/jobs/reply-classifier";

// Real replies from 2026-09/10, trimmed. Each one was misread as an ack — the
// card stayed APPLIED, the step went unseen, follow-ups went to a "no".
describe("reply classifier — the replies it used to miss", () => {
  it("a platform's 'next steps' is a response, not a receipt", () => {
    expect(
      classifyReply({
        from: "Meridial Expert Network <expert-network@talent.meridial.ai>",
        subject:
          "Thank You for Your Interest in the Meridial Expert Network - Next Steps",
        body: "You've already taken the first step! All that's left: uploading your resume, which will auto-populate your profile. Sign up to Meridial today (It takes less than 5 minutes!)",
      }),
    ).toBe("response");
  });

  it("a receipt-shaped subject still surfaces an AI-interview step", () => {
    expect(
      classifyReply({
        from: "no-reply@platform.ai",
        subject: "Thank you for applying",
        body: "Next, take the AI interview — it takes about 20 minutes.",
      }),
    ).toBe("response");
  });

  it("'decided not to move forward' is a rejection", () => {
    expect(
      classifyReply({
        from: "no-reply@customerio.com",
        subject:
          "Customer.io: Senior Software Engineer, Full Stack Application Update",
        body: "After reviewing your application, we've decided not to move forward at this time.",
      }),
    ).toBe("rejection");
  });

  it("a closed role is a rejection", () => {
    expect(
      classifyReply({
        from: "no-reply@us.greenhouse-mail.io",
        subject: "Information regarding your application to Zipline",
        body: "At this time, we've made the decision to close the Senior Full Stack Software Engineer role. While we won't be moving forward, we were grateful for the opportunity.",
      }),
    ).toBe("rejection");
  });

  it("'added to our consultant database' stays an ack", () => {
    expect(
      classifyReply({
        from: "trainingjobs@indepthresearch.co.ke",
        subject: "Re: Consultant Trainer – Electrical Engineering",
        body: "Thank you for your application and for expressing your interest in working with us. We have received your CV and added it to our consultant database for future consideration.",
      }),
    ).toBe("ack");
  });

  it("an ATS security code is never a reply", () => {
    expect(
      classifyReply({
        from: "Greenhouse <no-reply@us.greenhouse-mail.io>",
        subject: "Security code for your application to Meridial",
        body: "Copy and paste this code into the security code field on your application.",
      }),
    ).toBe("ack");
  });

  it("an invitation still wins over a call to action", () => {
    expect(
      classifyReply({
        from: "recruiter@acme.com",
        subject: "Next steps",
        body: "We'd like to invite you to an interview. Please book a time: https://calendly.com/acme/30min",
      }),
    ).toBe("interview");
  });
});
