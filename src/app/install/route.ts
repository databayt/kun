// Serves the OS-detect bootstrap shim at https://kun.databayt.org/install
//   curl -fsSL https://kun.databayt.org/install | bash
// Single source of truth: web/install.sh (traced into the serverless bundle
// via outputFileTracingIncludes in next.config.ts).

import { readFileSync } from "fs";
import path from "path";

const SHIM = readFileSync(
  path.join(process.cwd(), "web", "install.sh"),
  "utf8",
);

export function GET() {
  return new Response(SHIM, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
