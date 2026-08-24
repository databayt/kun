"use server";

import { AuthError } from "next-auth";
import * as z from "zod";

import { signIn } from "@/auth";
import { getAuthText } from "../dictionary";
import { createLoginSchema } from "../validation";

export type LoginResult = { error: string } | { success: true };

// Server action mirroring the mature block's login/action.ts: validate, then
// hand off to the credentials provider. The provider's `authorize`
// (auth.config.ts) keeps the timing-equalised, allowlist-only checks — this
// action must NOT re-implement or weaken them.
//
// `redirect: false` so the caller controls navigation; the session cookie is
// still set on this response. Error codes come back translated (the form runs
// on the same lang), so the client just renders the string.
export async function login(
  values: z.infer<ReturnType<typeof createLoginSchema>>,
  lang: string,
): Promise<LoginResult> {
  const t = getAuthText(lang);
  const parsed = createLoginSchema(t).safeParse(values);
  if (!parsed.success) {
    return { error: t.invalidCredentials };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", { email, password, redirect: false });
    return { success: true };
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
}
