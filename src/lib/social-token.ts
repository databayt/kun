// Signed approval tokens for the draft → approve → publish loop.
//
// The cron cannot ask a human to log in, and a Slack or Telegram message cannot
// carry a session. So the approval link carries its own authority: an HMAC-SHA256
// signature over the payload, keyed by CRON_SECRET.
//
// The token references a SocialVariant by id; it does not carry the copy. That
// change buys two things the previous stateless design could not have:
//
//   - **Single use.** Publishing is a conditional status transition, so the
//     second click finds the variant no longer `pending` and refuses. Before
//     persistence the link was replayable until it expired — clicking twice
//     posted twice, and that was a documented, unavoidable flaw.
//   - **No length cap.** The copy used to ride inside the URL, so a draft over
//     ~1200 characters minted a link that chat clients silently truncated into
//     a 404. An id is 25 characters whatever the post says.
//
// Still true: anyone holding a live link can publish it once. Keep the review
// channel private.

import crypto from "node:crypto";

export interface ApprovalPayload {
  /** SocialVariant id. */
  v: string;
  /** Expiry, epoch seconds. */
  e: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function secret(): string {
  const value = (process.env.CRON_SECRET ?? "").trim();
  if (!value)
    throw new Error("CRON_SECRET not set — approval links are unsigned");
  return value;
}

function sign(body: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(body).digest());
}

export function createApprovalToken(
  variantId: string,
  ttlSeconds: number,
): string {
  const full: ApprovalPayload = {
    v: variantId,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(Buffer.from(JSON.stringify(full), "utf8"));
  return `${body}.${sign(body)}`;
}

export type VerifyResult =
  { ok: true; payload: ApprovalPayload } | { ok: false; error: string };

export function verifyApprovalToken(token: string): VerifyResult {
  const [body, signature] = token.split(".");
  if (!body || !signature) return { ok: false, error: "Malformed token." };

  let expected: string;
  try {
    expected = sign(body);
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Cannot verify token.",
    };
  }

  // Constant-time: a length mismatch alone already tells us it's invalid, and
  // timingSafeEqual throws on unequal lengths.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "Bad signature." };
  }

  let payload: ApprovalPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Malformed payload." };
  }

  if (
    typeof payload?.e !== "number" ||
    payload.e < Math.floor(Date.now() / 1000)
  ) {
    return { ok: false, error: "This approval link has expired." };
  }
  if (typeof payload?.v !== "string" || !payload.v) {
    return { ok: false, error: "Incomplete payload." };
  }

  return { ok: true, payload };
}
