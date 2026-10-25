import path from "node:path";

import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

// Cloudflare Workers lane (scripts/deploy-cloudflare.sh sets CF_WORKERS=1): OpenNext bundles the
// server into one Worker, so there is no disk at request time. Everything the app used to read
// off disk (web/install.*, the docs graph, carousel decks, the art list) is bundled by
// scripts/gen-bundle.mjs into src/generated/kun-bundle.ts instead.
const CF_WORKERS = Boolean(process.env.CF_WORKERS);

const nextConfig: NextConfig = {
  // The image optimizer would need Cloudflare Images (paid) on Workers: serve originals.
  ...(CF_WORKERS ? { images: { unoptimized: true } } : {}),
  // Workers can't compile WebAssembly from bytes, so Prisma's workerd runtime imports its query
  // compiler as `./query_compiler_fast_bg.wasm?module`. Keep that a runtime import with an
  // absolute path so OpenNext marks it external and wrangler uploads the .wasm as a module.
  ...(CF_WORKERS
    ? {
        webpack: (config: { externals?: unknown }, { isServer }: { isServer: boolean }) => {
          if (!isServer) return config;
          const existing = config.externals ? (Array.isArray(config.externals) ? config.externals : [config.externals]) : [];
          config.externals = [
            ...existing,
            ({ request, context }: { request?: string; context?: string }, callback: (err?: Error | null, result?: string) => void) => {
              if (request?.endsWith(".wasm?module") && context) {
                const file = path.resolve(context, request.slice(0, -"?module".length));
                return callback(null, `import ${file}?module`);
              }
              callback();
            },
          ];
          return config;
        },
      }
    : {}),
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
      // The job engine became /seek — a generic opportunity workflow with the
      // personal board behind the login. Temporary until the old links age out.
      {
        source: "/:lang(en|ar)/jobs/profile",
        destination: "/:lang/seek/profile",
        permanent: false,
      },
      {
        source: "/:lang(en|ar)/jobs/:path+",
        destination: "/:lang/seek/board",
        permanent: false,
      },
      {
        source: "/:lang(en|ar)/jobs",
        destination: "/:lang/seek",
        permanent: false,
      },
      {
        source: "/jobs",
        destination: "/en/seek",
        permanent: false,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
