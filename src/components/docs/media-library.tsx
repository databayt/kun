// A compact sample of the media showroom for docs pages — the CdnAssets
// pattern over the marketing-media registries. Renders the first rows of the
// generated library plus the reference count, and points at the full
// showroom at /social/media (auth-guarded — docs stay public, assets don't
// need to).

import Link from "next/link";
import { getShowroomData } from "@/components/root/social/showroom/data";
import { ILLUSTRATION_COLORS } from "@/components/root/anthropic/data";

const SAMPLE_SIZE = 8;

export function MediaShowroom({ className }: { className?: string }) {
  const { assets, generatedCount, referenceCount } = getShowroomData();
  const sample = assets
    .filter((a) => a.kind === "generated" && a.imageUrl)
    .slice(0, SAMPLE_SIZE);

  return (
    <div className={`my-6 space-y-4 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <code className="bg-transparent px-0 text-sm font-semibold">
          content/media/
        </code>
        <span className="text-muted-foreground text-xs tracking-wider uppercase">
          {generatedCount} generated · {referenceCount} references
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {sample.map((asset, i) => (
          <a
            key={asset.id}
            href={asset.href}
            target="_blank"
            rel="noopener noreferrer"
            title={asset.title}
            className="group block"
          >
            <div
              className="flex aspect-square w-full items-center justify-center overflow-hidden p-5 transition-opacity group-hover:opacity-90"
              style={{
                backgroundColor:
                  ILLUSTRATION_COLORS[i % ILLUSTRATION_COLORS.length],
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.imageUrl as string}
                alt={asset.title}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <p className="text-muted-foreground mt-1.5 truncate font-mono text-[11px]">
              {asset.brand}/{asset.title}
            </p>
          </a>
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        Rendered from <code className="bg-transparent px-0">library.json</code>{" "}
        + <code className="bg-transparent px-0">references.json</code> — the
        same registries as the full showroom at{" "}
        <Link href="/en/social/media" className="underline">
          /social/media
        </Link>
        .
      </p>
    </div>
  );
}
