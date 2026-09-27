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
const REJECTION =
  /unfortunately|regret to inform|not (be )?moving forward|not to proceed|will not be proceeding|other candidates|not been (selected|successful|shortlisted)|position has (been|now been) filled|decided to pursue|no longer (being )?considered/i;
const INTERVIEW =
  /\binterview\b|shortlisted|next (stage|step|round)|schedule (a|an)? ?(call|meeting|chat)|your availability|available (for|to) (a )?(call|meeting|chat)|calendly\.com|technical (test|assessment)|assessment link|take[- ]home/i;
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
  if (interview) return "interview";
  if (ack || NOREPLY_SENDER.test(from)) return "ack";
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
