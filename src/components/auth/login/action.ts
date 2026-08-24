"use server";

import { AuthError } from "next-auth";
import * as z from "zod";

import { signIn } from "@/auth";
import { DEFAULT_LOGIN_REDIRECT, safeCallbackUrl } from "@/routes";
import { getAuthText } from "../dictionary";
import { createLoginSchema } from "../validation";

export interface LoginOptions {
  /** Where the caller wanted to go before the login wall interrupted them. */
  callbackUrl?: string | null;
  /** Locale for messages and for the default landing path. */
  locale?: string;
}

export type LoginResult =
  { error: string } | { success: true; redirectUrl: string };

// Server action mirroring the mature block's login/action.ts: validate, sign
// in, and decide where the browser goes next. The provider's `authorize`
// (auth.config.ts) keeps the timing-equalised, allowlist-only checks — this
// action must NOT re-implement or weaken them.
//
// The destination is resolved HERE rather than in the form, which is what makes
// the callback trustworthy: every entry point (the /login route, the header
// dialog, a proxy bounce) funnels through one `safeCallbackUrl` gate, so a
// hostile `?callbackUrl=` cannot become an open redirect by finding a caller
// that forgot to check.
//
// `redirect: false` so the caller controls navigation; the session cookie is
// still set on this response. Error codes come back translated (the form runs
// on the same lang), so the client just renders the string.
export async function login(
  values: z.infer<ReturnType<typeof createLoginSchema>>,
  options: LoginOptions = {},
): Promise<LoginResult> {
  const locale = options.locale === "ar" ? "ar" : "en";
  const t = getAuthText(locale);

  const parsed = createLoginSchema(t).safeParse(values);
  if (!parsed.success) {
    return { error: t.invalidCredentials };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // CredentialsSignin is the only expected failure — a wrong email or
      // password. Everything else is genuinely unexpected.
      return {
        error:
          error.type === "CredentialsSignin"
            ? t.invalidCredentials
            : t.somethingWrong,
      };
    }
    throw error;
  }

  // A callback already carries its own locale prefix (it is a path the user was
  // heading to), so it is never re-prefixed — only the default is.
  const redirectUrl =
    safeCallbackUrl(options.callbackUrl) ??
    `/${locale}${DEFAULT_LOGIN_REDIRECT}`;

  return { success: true, redirectUrl };
}
