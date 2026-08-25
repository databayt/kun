// The visual register a generated image is asked for.
//
// NOT the same axis as the showroom taxonomy. That names what an asset IS —
// a hero, an OG plate, a reel — and records the ratio and lane it renders at.
// This names how it should LOOK. A hero can be cinematic or minimal; a product
// shot can be luxury or playful. Two questions, two lists.
//
// WHAT THIS CURRENTLY DOES, plainly: it is a directive, not a filter. Nothing
// in `library.json` records a style, so this cannot narrow the ＋ the way the
// format list did — it is the answer a generation brief would carry
// (lib/media-prompt.ts already composes prompts from brand + type + scene, and
// this is the missing adjective). Until that wire exists the choice is
// remembered and shown, and it changes nothing else. Saying so here beats a
// setting that looks like it filters and quietly does not.

export interface ImageStyle {
  id: string;
  en: string;
  ar: string;
}

/**
 * Sixteen registers, ordered from the most restrained to the most stylised,
 * with the two "what is in the frame" answers last — a UGC shot and a product
 * shot are about subject more than treatment, and belong at the end for it.
 */
export const IMAGE_STYLES = [
  { id: "corporate", en: "Corporate", ar: "مؤسسي" },
  { id: "modern", en: "Modern", ar: "عصري" },
  { id: "minimalist", en: "Minimalist", ar: "بسيط" },
  { id: "bold", en: "Bold", ar: "جريء" },
  { id: "luxury", en: "Luxury", ar: "فاخر" },
  { id: "creative", en: "Creative", ar: "إبداعي" },
  { id: "playful", en: "Playful", ar: "مرح" },
  { id: "editorial", en: "Editorial", ar: "تحريري" },
  { id: "cinematic", en: "Cinematic", ar: "سينمائي" },
  { id: "retro", en: "Retro", ar: "كلاسيكي" },
  { id: "futuristic", en: "Futuristic", ar: "مستقبلي" },
  { id: "threeD", en: "3D", ar: "ثلاثي الأبعاد" },
  { id: "illustration", en: "Illustration", ar: "رسم" },
  { id: "abstract", en: "Abstract", ar: "تجريدي" },
  { id: "ugc", en: "UGC / Authentic", ar: "محتوى واقعي" },
  { id: "product", en: "Product-Focused", ar: "مركّز على المنتج" },
] as const satisfies readonly ImageStyle[];

export type ImageStyleId = (typeof IMAGE_STYLES)[number]["id"];

/** No register chosen — the writer has not said, and the brief will not claim. */
export const ANY_STYLE = "any";

export function isImageStyle(value: string): boolean {
  return (
    value === ANY_STYLE || IMAGE_STYLES.some((style) => style.id === value)
  );
}

export function styleLabel(id: string, isRTL: boolean): string {
  const found = IMAGE_STYLES.find((style) => style.id === id);
  if (!found) return id;
  return isRTL ? found.ar : found.en;
}
