import { existsSync } from "fs";
import path from "path";
import type { CSSProperties, ReactElement } from "react";

const CDN_BASE = "https://cdn.databayt.org/anthropic";

/** Vendored copy first (deterministic screenshots), live CDN as fallback. */
export function artSrc(name: string): string {
  const local = path.join(process.cwd(), "public", "carousel-art", name);
  return existsSync(local) ? `/carousel-art/${name}` : `${CDN_BASE}/${name}`;
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
