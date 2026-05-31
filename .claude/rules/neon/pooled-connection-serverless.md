---
domain: neon
severity: warn
applies-to: ["**/db.ts", "**/prisma.ts", "**/lib/db.ts", "**/actions.ts"]
since: "Neon"
---

# Use the pooled connection string in serverless/edge runtimes

Serverless functions and edge runtimes spin up many short-lived instances; each direct connection ties up a real Postgres backend and exhausts Neon's direct-connection ceiling. Use the PgBouncer-pooled host (`-pooler`) for runtime queries and reserve the direct URL for migrations only.

## Good

```ts
// lib/db.ts — pooled host for app runtime
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// DATABASE_URL points at ...-pooler.neon.tech?sslmode=require&pgbouncer=true
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
export const db = globalThis.prisma ?? new PrismaClient({ adapter });
// schema.prisma: directUrl = env("DIRECT_URL")  // non-pooled, migrations only
```

## Bad

```ts
// Direct (non-pooled) host used per-request from a serverless action
// DATABASE_URL = ...ep-cool-name.neon.tech  (no -pooler)
const db = new PrismaClient(); // each cold start opens a direct backend
export async function listStudents(schoolId: string) {
  return db.student.findMany({ where: { schoolId } }); // exhausts connections under load
}
```

## Fix

Point `DATABASE_URL` at the `-pooler` host with `pgbouncer=true` and keep the direct host only in `directUrl` for migrations.
