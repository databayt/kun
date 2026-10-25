// Serves the OS-detect bootstrap shim at https://kun.databayt.org/install
//   curl -fsSL https://kun.databayt.org/install | bash
// Single source of truth: web/install.sh, bundled as a string at build time by
// scripts/gen-bundle.mjs (src/generated/kun-bundle.ts) — Workers have no filesystem.

import { INSTALL_SH as SHIM } from "@/generated/kun-bundle";

export function GET() {
  return new Response(SHIM, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
