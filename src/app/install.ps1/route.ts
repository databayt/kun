// Serves the Windows bootstrap shim at https://kun.databayt.org/install.ps1
//   iwr https://kun.databayt.org/install.ps1 | iex
// Single source of truth: web/install.ps1, bundled as a string at build time by
// scripts/gen-bundle.mjs (src/generated/kun-bundle.ts) — Workers have no filesystem.

import { INSTALL_PS1 as SHIM } from "@/generated/kun-bundle";

export function GET() {
  return new Response(SHIM, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
