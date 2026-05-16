import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const RAW = "https://raw.githubusercontent.com/databayt/kun/main/.claude/scripts";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async redirects() {
    return [
      // Canonical paste: `irm https://kun.databayt.org/install | iex`
      { source: "/install", destination: `${RAW}/bootstrap.ps1`, permanent: false },
      { source: "/finish",  destination: `${RAW}/bootstrap.ps1`, permanent: false },
      { source: "/doctor",  destination: `${RAW}/doctor.ps1`,    permanent: false },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
