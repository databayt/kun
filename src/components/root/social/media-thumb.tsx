"use client";

// One thumbnail for a library or tray item, whatever the bytes are. The media
// team uploads video now, and every <img> pointed at an .mp4 drew a broken
// tile — a muted, inline <video> on its first frame is the honest preview.

import { mediaKind } from "@/lib/media-kind";

export function MediaThumb({
  src,
  alt = "",
  className,
  lazy = true,
}: {
  src: string;
  alt?: string;
  className?: string;
  lazy?: boolean;
}) {
  if (mediaKind(src) === "video") {
    return (
      <video
        src={`${src}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        aria-label={alt || undefined}
        className={className}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={lazy ? "lazy" : undefined}
      className={className}
    />
  );
}
