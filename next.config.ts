import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
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
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
