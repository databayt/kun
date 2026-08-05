import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  // Barrel entry points re-export thousands of modules, so importing three
  // icons pulls the whole library into the graph. Next rewrites these to
  // direct imports at build time — ergonomic imports, without the cold-start tax.
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // A media brief comes back as an image through a Server Action, and the
    // 1MB default rejects them. The client re-encodes to WebP before sending
    // (a 1792x1024 PNG lands around 300KB), so this is headroom for an
    // uncooperative file rather than the expected size.
    serverActions: { bodySizeLimit: "4mb" },
  },
  reactStrictMode: true,
  // The carousel render route is screenshotted by Playwright — the dev
  // indicator badge would land inside the captured slides.
  devIndicators: false,
  // The install routes read web/install.{sh,ps1} at runtime; trace them into
  // the serverless bundle so the read works on Vercel, not just locally.
  outputFileTracingIncludes: {
    "/install": ["./web/install.sh"],
    "/install.ps1": ["./web/install.ps1"],
    // The Second Brain graph derives its notes layer by reading the docs
    // corpus at runtime; trace it into the serverless bundle.
    "/[lang]/graph": ["./content/docs/**/*"],
    // Deck JSONs are fs-read at request time (content.ts readDeck/listDecks);
    // trace them so kun-owned decks render on Vercel — brand-repo deckDirs
    // stay local-only by design.
    "/[lang]/carousel/[brand]/[slug]": ["./content/carousels/**/*"],
    "/[lang]/social/media": ["./content/carousels/**/*"],
  },
  // Locale-less docs URLs (e.g. shared links like /docs/onboarding) redirect
  // to the default locale. The docs render under /[lang]/docs/[[...slug]], so
  // without this a bare /docs/<slug> 404s.
  async redirects() {
    return [
      {
        source: "/docs/:path*",
        destination: "/en/docs/:path*",
        permanent: false,
      },
      // The Social Hub moved up out of /engine — keep old links alive.
      {
        source: "/:lang/engine/social",
        destination: "/:lang/social",
        permanent: true,
      },
      {
        source: "/engine/social",
        destination: "/en/social",
        permanent: true,
      },
      // Same locale-less courtesy as /docs — the Hub renders under
      // /[lang]/social, so a bare /social (shared link, docs cross-ref) 404s
      // without this.
      {
        source: "/social",
        destination: "/en/social",
        permanent: false,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
