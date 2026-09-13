// Liveness + database probe for the Cloudflare container lane (scripts/deploy-cloudflare.sh
// smoke, the `watch` skill, the Worker's own checks). Unauthenticated and cheap: one SELECT 1
// through the lazy Prisma client, plus process memory as plain numbers so the instance type can
// be sized from evidence. Never echoes env names, hosts or error text — a failing database
// reports only that it failed.
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const started = Date.now();
  let database: { pass: boolean; ms: number };
  try {
    await db.$queryRaw`SELECT 1`;
    database = { pass: true, ms: Date.now() - started };
  } catch {
    database = { pass: false, ms: Date.now() - started };
  }
  const mem = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1048576);
  return Response.json(
    {
      ok: database.pass,
      checks: { database },
      memory: { rssMb: mb(mem.rss), heapUsedMb: mb(mem.heapUsed), heapTotalMb: mb(mem.heapTotal) },
      uptimeS: Math.round(process.uptime()),
    },
    { status: database.pass ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
