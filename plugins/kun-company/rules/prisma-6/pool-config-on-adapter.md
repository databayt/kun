---
domain: prisma-6
severity: warn
paths: ["**/db.ts", "**/prisma.ts", "**/.env.example"]
since: "2026-09-26"
---

# With a driver adapter, set pool size and timeouts on the adapter, not in the URL

`connection_limit`, `pool_timeout` and `pgbouncer` are parameters for Prisma's Rust query engine. With a driver adapter the pool belongs to the JS driver instead, and the driver ignores them. That is always the case in Prisma 7, and in Prisma 6 wherever `@prisma/adapter-pg` or `@prisma/adapter-neon` is used. The `pg` defaults then apply: **no connection timeout** (`0`), a 10 s idle timeout, and a 10-connection pool. A Neon compute waking from scale-to-zero takes 0.5 s to a few seconds, and with no timeout a slow wake becomes a hang. Pass the settings as adapter fields: `PrismaPg` and `PrismaNeon` both accept `pg`-style pool config.

## Good

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10, // was connection_limit
  connectionTimeoutMillis: 10_000, // was connect_timeout / pool_timeout (v6: 5 s / 10 s)
  idleTimeoutMillis: 300_000, // v6 kept idle connections for 300 s
});
```

## Bad

```ts
// Ignored by the adapter: the pool still has no timeout
url.searchParams.set("connection_limit", "10");
url.searchParams.set("pool_timeout", "10");
const adapter = new PrismaPg({ connectionString: url.toString() });
```

## Fix

Move pool size and timeouts out of the connection string and into the adapter options (`max`, `connectionTimeoutMillis`, `idleTimeoutMillis`).

> Source: https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool · https://www.prisma.io/docs/orm/v6/more/upgrades/to-v7
