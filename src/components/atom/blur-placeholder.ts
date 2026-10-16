// Blur placeholders for `BlurImage`. Plain module (no "use client"): a server
// component that renders a BlurImage must be able to compute its
// `blurDataURL` — calling a function exported from a client module throws.

/** Neutral 16×10 LQIP for images with no stored blur — reads fine in light + dark. */
export const NEUTRAL_BLUR =
  "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoQAAwAA4BaJaQAA3AA/vEAgAA=";
