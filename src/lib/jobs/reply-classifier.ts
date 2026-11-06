// ── Reply classifier: rules first, a model only for what rules can't call ────
//
// Funnel doctrine: a reply freezes the cadence and goes to a human. Here the
// "human" for routine replies is this function — acknowledgements, rejections
// and interview invitations have unmistakable wording in every HR system — and
// anything it can't call confidently is returned as `ambiguous` for the
// evening `claude -p` pass, never guessed.

export type ReplyKind =
  "ack" | "interview" | "rejection" | "offer" | "response" | "ambiguous";

export interface ReplyInput {
  from: string;
  subject: string;
  body: string;
}

const OFFER =
  /(pleased|happy|delighted) to offer|offer letter|job offer|we would like to offer you|formal offer/i;
// Customer.io's "we've decided not to move forward" and Zipline's "we've made
// the decision to close the role … we won't be moving forward" were both read
// as acks on 2026-10 — the cards stayed APPLIED and got follow-ups after a no.
const REJECTION =
  /unfortunately|regret to inform|not (be )?moving forward|not to (move forward|proceed)|(decided|chosen) not to (move|proceed|continue)|won.?t be (moving|proceeding) forward|will not be proceeding|other candidates|not been (selected|successful|shortlisted)|position has (been|now been) filled|(have|has) filled the (position|role)|no longer considering|decided to pursue|no longer (being )?considered|decision to close the .{0,60}(role|position)/i;
// A platform asking him to finish a step — "all that's left: upload your
// resume", "take the AI interview". Meridial's 2026-10-21 "Next Steps" read
// as an ack and sat 17 days. It is a RESPONSE: it needs Abdout, and it
// moves the card off APPLIED.
const CALL_TO_ACTION =
  /all that.s left|complete (your|the) (profile|application|registration|sign[- ]?up|onboarding)|upload (your|a) (resume|cv)|finish (your|the) (application|profile|onboarding|sign[- ]?up)|take (the|your|an?) .{0,25}(assessment|interview|test|screening)|start (your|the) .{0,20}(assessment|interview)|ai interview|sign up to [a-z]+ today|(create|activate) your (account|profile) to (continue|apply)/i;
// Codes the ATS submitter reads itself (ats.ts codeFetcher) — never a reply.
const SECURITY_CODE =
  /security code|verification code|one[- ]time (pass)?code/i;
// An invitation, not a mention: acknowledgements routinely describe "our
// interview process" and "next steps" (three were misread on 2026-09-27).
const INTERVIEW =
  /invite you (to|for) (an? |the )?(interview|call|chat|conversation|screen|meeting)|(like|love|want) to (schedule|set up|book|arrange) (an? )?(interview|call|time|chat|meeting)|please (book|schedule|pick|select) (a )?(time|slot)|calendly\.com|cal\.com\/|goodtime\.io|your availability (for|to)|(like|love) to (speak|talk|chat|meet) with you|move (you )?forward to the next (stage|step|round)|technical (test|assessment|challenge) (link|invitation)|take[- ]home (assignment|challenge) (is )?attached/i;
const ACK =
  /received your application|thank you for (applying|your application|your interest)|application (has been|was) received|we will review your application|auto(matic|mated)?[- ]?(reply|response)|out of (the )?office|do not reply to this/i;
const NOREPLY_SENDER =
  /no-?reply|do-?not-?reply|notifications?@|mailer-daemon|postmaster/i;

export function classifyReply({ from, subject, body }: ReplyInput): ReplyKind {
  const text = `${subject}\n${body}`;
  const offer = OFFER.test(text);
  const rejection = REJECTION.test(text);
  const interview = INTERVIEW.test(text);
  const ack = ACK.test(text);
  // An application-received subject is an acknowledgement unless the body
  // actually invites him to something.
  const ackSubject =
    /thank you for (applying|your application)|received your application|application (received|confirmation)|we.ve received|has received your application/i.test(
      subject,
    );

  if (
    /mailer-daemon|postmaster|delivery status notification|undeliverable/i.test(
      `${from} ${subject}`,
    )
  )
    return "ambiguous";
  if (offer && rejection) return "ambiguous";
  if (offer) return "offer";
  // "we will not invite you to interview" is a rejection that says interview.
  if (rejection) return "rejection";
  if (SECURITY_CODE.test(subject)) return "ack";
  if (interview) return "interview";
  // Before every ack rule, the receipt-shaped subject included: platforms
  // send "Thank you for applying — next, take the AI interview". A false
  // positive costs one human glance; a miss cost Meridial 17 days.
  if (CALL_TO_ACTION.test(text)) return "response";
  if (ackSubject || ack || NOREPLY_SENDER.test(from)) return "ack";
  // A person wrote back and said none of the above — a question, a request
  // for documents. That is a RESPONSE, and it needs Abdout.
  return body.trim().length > 0 ? "response" : "ambiguous";
}

/// The board status each kind moves a card to; ack moves nothing.
export const REPLY_STATUS: Record<ReplyKind, string | null> = {
  ack: null,
  interview: "interview",
  rejection: "rejected",
  offer: "offer",
  response: "response",
  ambiguous: null,
};
