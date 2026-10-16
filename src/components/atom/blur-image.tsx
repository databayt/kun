"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";
import { NEUTRAL_BLUR } from "./blur-placeholder";

export type BlurImageProps = ImageProps & {
  /** Skip the blur-up (fade only, no placeholder). Use for tiny icons and logos. */
  plain?: boolean;
};

/**
 * next/image drop-in: the photo arrives blurred (LQIP) and sharpens into
 * focus on load. The parent owns the box — `relative overflow-hidden bg-muted`
 * plus an aspect ratio — so the `scale-105` never spills. Ported from
 * hogwarts `atom/blur-image.tsx`.
 */
export function BlurImage({
  className,
  onLoad,
  plain = false,
  placeholder,
  blurDataURL,
  alt,
  ...props
}: BlurImageProps): React.JSX.Element {
  const [loaded, setLoaded] = React.useState(false);

  // Static imports carry their own blurDataURL; everything else uses the stored one or the neutral.
  const staticBlur =
    typeof props.src === "object" && "blurDataURL" in props.src;
  const blur = blurDataURL ?? (staticBlur ? undefined : NEUTRAL_BLUR);

  return (
    <Image
      {...props}
      alt={alt}
      placeholder={placeholder ?? (plain ? "empty" : "blur")}
      blurDataURL={plain ? undefined : blur}
      data-loaded={loaded ? "" : undefined}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        "transition-[filter,scale,opacity] duration-700 ease-out",
        "motion-reduce:transition-none",
        loaded
          ? "blur-none scale-100 opacity-100"
          : plain
            ? "opacity-0"
            : "scale-105 blur-xl motion-reduce:scale-100 motion-reduce:blur-none",
        className,
      )}
    />
  );
}
