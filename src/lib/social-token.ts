// Signed approval tokens for the draft → approve → publish loop.
//
// The cron can't ask a human to log in, and a Slack/Telegram message can't carry
// a session. So the approval link carries its own authority: an HMAC-SHA256
// signature over the payload, keyed by CRON_SECRET. Nothing is stored — the
// draft text rides inside the token, which is why the text is length-capped.
//
// Threat model, stated plainly:
//   - The token is unguessable (HMAC over a server-only secret) and short-lived.
//   - It is single-purpose: it publishes exactly the text it carries, to exactly
//     the (product, channel) pair it carries. It grants nothing else.
//   - It is REPLAYABLE until it expires — clicking twice posts twice. Stateless
//     is the trade; the review channel is private and the window is hours.
//   - Anyone with the link can publish. Keep the review channel private.

import crypto from "node:crypto";

export interface ApprovalPayload {
  /** product id */
  p: string;
  /** channel ids */
  c: string[];
  /** post text */
  t: string;
  /** expiry, epoch seconds */
  e: number;
}

// A 4000-char post base64s into a URL long enough to get truncated by a chat
// client or a proxy. Auto-drafts are short by design; refuse anything that
// wouldn't survive the round trip rather than minting a link that silently 404s.
export const MAX_TOKEN_TEXT = 1200;

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
  payload: Omit<ApprovalPayload, "e">,
  ttlSeconds: number,
): string {
  if (payload.t.length > MAX_TOKEN_TEXT) {
    throw new Error(
      `Draft too long for an approval link (${payload.t.length} > ${MAX_TOKEN_TEXT} chars)`,
    );
  }
  const full: ApprovalPayload = {
    ...payload,
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
  if (!payload.p || !Array.isArray(payload.c) || !payload.t) {
    return { ok: false, error: "Incomplete payload." };
  }

  return { ok: true, payload };
}
