import { COLORS } from "@/components/root/anthropic/data";
import kit from "../../../../content/media/brand-kit.json";
import type { SlideTheme } from "./schema";

function hex(name: string): string {
  const token = COLORS.find((c) => c.name === name);
  if (!token)
    throw new Error(`carousel palette: unknown Anthropic color "${name}"`);
  return token.hex;
}

export interface ThemeColors {
  bg: string;
  ink: string;
  accent: string;
  muted: string;
  hairline: string;
}

/**
 * Slide palettes drawn from the Anthropic color catalog (root/anthropic/data.ts).
 * Applied as inline styles on purpose: slides are fixed print-like artifacts,
 * immune to the site theme and dark mode.
 */
export const THEMES: Record<SlideTheme, ThemeColors> = {
  ivory: {
    bg: hex("Ivory Light"),
    ink: hex("Slate Dark"),
    accent: hex("Clay"),
    muted: hex("Slate 550"),
    hairline: hex("Slate 250"),
  },
  oat: {
    bg: hex("Oat"),
    ink: hex("Slate Dark"),
    accent: hex("Clay"),
    muted: hex("Slate 600"),
    hairline: hex("Slate 350"),
  },
  dark: {
    bg: hex("Slate Dark"),
    ink: hex("Ivory Light"),
    accent: hex("Clay"),
    muted: hex("Slate 400"),
    hairline: hex("Slate 700"),
  },
  clay: {
    bg: hex("Clay"),
    ink: hex("Ivory Light"),
    accent: hex("Slate Dark"),
    muted: "rgba(250, 249, 245, 0.78)",
    hairline: "rgba(250, 249, 245, 0.35)",
  },
};

/**
 * Anthropic's own section-theming trick: illustrations sit on soft tinted
 * plates, cycled from the accent family (see ILLUSTRATION_COLORS in
 * root/anthropic/data.ts). Cycled by slide index; a plate that matches the
 * canvas skips to its neighbor.
 */
const PLATE_CYCLE: string[] = [
  hex("Oat"),
  hex("Coral"),
  hex("Cactus"),
  hex("Heather"),
  hex("Tag Tan"),
  hex("Tag Periwinkle"),
];

export function plateColor(index: number, canvasBg: string): string {
  const plate = PLATE_CYCLE[index % PLATE_CYCLE.length];
  if (plate.toLowerCase() === canvasBg.toLowerCase()) {
    return PLATE_CYCLE[(index + 1) % PLATE_CYCLE.length];
  }
  return plate;
}

type ProductionVideo = { accent?: string };
const PRODUCTION = (kit as unknown as { production?: Record<string, { video?: ProductionVideo }> }).production ?? {};

/**
 * The theme in a brand's own accent (content/media/brand-kit.json → production[brand].video.accent):
 * mkan's slides wear mkan Clay #e05638, the balqalam/hogwarts/databayt family keeps Clay #d97757.
 * A draft brand (accent "TODO") or an unknown one keeps the base theme rather than a guessed colour.
 */
export function themeFor(theme: SlideTheme, brand?: string): ThemeColors {
  const base = THEMES[theme];
  const accent = brand ? PRODUCTION[brand]?.video?.accent : undefined;
  if (!accent || !/^#[0-9a-f]{6}$/i.test(accent)) return base;
  if (accent.toLowerCase() === hex("Clay").toLowerCase()) return base;
  return theme === "clay" ? { ...base, bg: accent } : { ...base, accent };
}
