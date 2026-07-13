import { z } from "zod";

/**
 * Deck contract for the carousel engine.
 * Every text field carries BOTH languages — AR/EN parity is structural,
 * not a convention someone can forget.
 */
export const bilingualSchema = z.object({
  ar: z.string().min(1),
  en: z.string().min(1),
});

export const slideThemeSchema = z.enum(["ivory", "dark", "clay", "oat"]);

/** Bare filename resolved against public/carousel-art/ then cdn.databayt.org/anthropic/. */
const artSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9._-]+\.svg$/,
    "art must be a bare .svg filename from the Anthropic mirror",
  );

const slideBase = {
  art: artSchema.optional(),
  theme: slideThemeSchema.default("ivory"),
};

export const slideSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("cover"),
    eyebrow: bilingualSchema.optional(),
    headline: bilingualSchema,
    sub: bilingualSchema.optional(),
    ...slideBase,
  }),
  z.object({
    type: z.literal("point"),
    kicker: bilingualSchema.optional(),
    headline: bilingualSchema,
    body: bilingualSchema.optional(),
    ...slideBase,
  }),
  z.object({
    type: z.literal("stat"),
    value: z.string().min(1),
    label: bilingualSchema,
    support: bilingualSchema.optional(),
    ...slideBase,
  }),
  z.object({
    type: z.literal("quote"),
    text: bilingualSchema,
    attribution: bilingualSchema.optional(),
    ...slideBase,
  }),
  z.object({
    type: z.literal("steps"),
    headline: bilingualSchema,
    items: z.array(bilingualSchema).min(2).max(4),
    ...slideBase,
  }),
  z.object({
    type: z.literal("cta"),
    headline: bilingualSchema,
    action: bilingualSchema,
    url: z.url(),
    ...slideBase,
  }),
]);

export const deckSchema = z.object({
  brand: z.enum(["hogwarts", "databayt", "mkan", "moallimee", "sijillee"]),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: bilingualSchema,
  /** Feature-block scope for the later per-block carousels (hogwarts blocks.json). */
  block: z.string().optional(),
  /** Max 10 — the Telegram album cap, the lowest limit across target channels. */
  slides: z.array(slideSchema).min(3).max(10),
  captions: z.object({
    base: bilingualSchema,
    hashtags: z.array(z.string().startsWith("#")),
    link: z.url(),
  }),
  createdAt: z.string(),
  status: z.enum(["draft", "staged", "approved", "published"]).default("draft"),
});

export type Bilingual = z.infer<typeof bilingualSchema>;
export type SlideTheme = z.infer<typeof slideThemeSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type Deck = z.infer<typeof deckSchema>;
export type DeckLang = "ar" | "en";
