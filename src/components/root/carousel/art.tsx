import type { CSSProperties, ReactElement } from "react";
import { CAROUSEL_ART } from "@/generated/kun-bundle";

const CDN_BASE = "https://cdn.databayt.org/anthropic";

const VENDORED = new Set(CAROUSEL_ART);

/**
 * Vendored copy first (deterministic screenshots), live CDN as fallback. Which files are
 * vendored is listed at build time (scripts/gen-bundle.mjs) — Workers can't existsSync.
 */
export function artSrc(name: string): string {
  return VENDORED.has(name) ? `/carousel-art/${name}` : `${CDN_BASE}/${name}`;
}

export function Art({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}): ReactElement {
  // Decorative Anthropic illustration — empty alt by design; plain <img>
  // because these are same-origin SVGs that need no next/image processing.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" className={className} style={style} />;
}
