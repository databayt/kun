// Serves the Windows bootstrap shim at https://kun.databayt.org/install.ps1
//   iwr https://kun.databayt.org/install.ps1 | iex
// Single source of truth: web/install.ps1 (traced into the serverless bundle
// via outputFileTracingIncludes in next.config.ts).

import { readFileSync } from "fs";
import path from "path";

const SHIM = readFileSync(
  path.join(process.cwd(), "web", "install.ps1"),
  "utf8",
);

export function GET() {
  return new Response(SHIM, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
