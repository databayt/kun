---
domain: neon
severity: error
paths:
  [
    "**/prisma.config.ts",
    "**/schema.prisma",
    "**/db.ts",
    "**/prisma.ts",
    "**/.env.example",
  ]
since: "2026-09-26"
---

# Pooled URL for the app, direct URL for the Prisma CLI

Neon's `-pooler` host is PgBouncer in transaction mode. Serverless and per-request clients must go through it, or they exhaust `max_connections`. Prisma's schema engine (`migrate`, `db push`, `db pull`) needs a single session connection and breaks through the pooler: you get `prepared statement "s0" already exists`, and the session-level advisory locks `migrate deploy` relies on are not supported there. So keep two URLs. **Prisma 7:** `url` and `directUrl` are gone from `schema.prisma`, and `datasource.directUrl` is gone from `prisma.config.ts`. The CLI reads only `datasource.url`, so that value must be the **direct** host; the adapter gets the pooled one. **Prisma 6:** `url` is pooled and `directUrl` is direct. Remove `pgbouncer=true`: Neon's PgBouncer supports protocol-level prepared statements, and Prisma advises against the flag on PgBouncer 1.21 and later.

**workerd caveat:** on Worker, OpenNext or vinext lanes, build the client per request (see `cloudflare/no-cross-request-io-in-workers.md`). A `globalThis` singleton is correct only on the Node Containers lane.

## Good

```ts
// .env: DATABASE_URL = ep-x-pooler…neon.tech · DIRECT_URL = ep-x…neon.tech (Neon: DATABASE_URL_UNPOOLED)
// prisma.config.ts (Prisma 7): the CLI migrates over the direct host
export default defineConfig({ datasource: { url: env("DIRECT_URL") } });

// lib/db.ts: the app queries through the pooler
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
// Prisma 6 schema.prisma instead: url = env("DATABASE_URL") · directUrl = env("DIRECT_URL")
```

## Bad

```ts
// Prisma 7: CLI pointed at the pooler, so migrate runs through PgBouncer
export default defineConfig({ datasource: { url: process.env.DATABASE_URL } }); // -pooler host

// Legacy flag: not needed on Neon's PgBouncer, and driver adapters never read it
// DATABASE_URL=postgresql://…-pooler.neon.tech/db?sslmode=require&pgbouncer=true
```

## Fix

Runtime adapter → pooled `DATABASE_URL`. Prisma CLI → unpooled `DIRECT_URL` (v7 `datasource.url`, v6 `directUrl`). Delete `pgbouncer=true`.

> Source: https://neon.com/docs/guides/prisma · https://neon.com/docs/connect/connection-pooling · https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer · https://www.prisma.io/docs/orm/reference/prisma-config-reference
