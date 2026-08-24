import * as z from "zod";

import type { AuthText } from "./dictionary";

// i18n-aware factory — the canonical pattern from the mature auth block:
//   const schema = createLoginSchema(getAuthText(lang))
// Messages come from the auth dictionary so validation errors are translated at
// the same source as the form labels.
export function createLoginSchema(t: AuthText) {
  return z.object({
    email: z
      .string()
      .min(1, { message: t.emailRequired })
      .email({ message: t.emailInvalid }),
    password: z.string().min(1, { message: t.passwordRequired }),
  });
}

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;
