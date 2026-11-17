import { z } from "zod"

// Mirrors settings/rust.rs; Rust re-validates every save.
export const settingsSchema = z.object({
  person: z
    .string()
    .trim()
    .max(80)
    .refine((s) => !/\p{Cc}/u.test(s)),
  department: z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/).refine((s) => !s.includes("..")),
  driver: z.enum(["claude", "codex", "opencode"]),
})

export type SettingsInput = z.infer<typeof settingsSchema>
