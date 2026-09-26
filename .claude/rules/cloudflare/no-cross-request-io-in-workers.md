---
domain: cloudflare
severity: error
paths:
  [
    "**/cf/*worker*.js",
    "**/cf/*worker*.ts",
    "**/src/worker.ts",
    "**/lib/db.ts",
    "**/lib/prisma.ts",
  ]
since: "2026-09-26"
---

# On workerd, create DB clients inside the request — never at module scope

A Worker isolate serves many requests and its module scope survives between them. I/O objects — a DB client's connection, streams, `Request`/`Response` bodies — belong to the request that created them: reusing one in the next request throws `Cannot perform I/O on behalf of a different request` or simply hangs, and opening one at module scope fails with `Disallowed operation called within global scope`. Request-derived values (user, tenant) in module variables leak across requests. So on the **workerd lanes** (plain Worker, OpenNext `co`, vinext sites) build the Prisma/pg client per request — Hyperdrive or the Neon adapter make that cheap. **Not the Containers lane:** there Next runs as a long-lived Node process and the `globalThis` singleton in `lib/db.ts` is correct. Tell them apart in `wrangler.jsonc`: a `containers` block = Node; `main: ".open-next/worker.js"` or a vinext entry = workerd.

## Good

```ts
export default {
  async fetch(request: Request, env: Env) {
    // new client per request; Hyperdrive pools the real connection
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: env.HYPERDRIVE.connectionString,
      }),
    });
    return Response.json(await prisma.school.findMany({ take: 10 }));
  },
} satisfies ExportedHandler<Env>;
// co's src/lib/db.ts memoises one client per getCloudflareContext().ctx (WeakMap) — same rule.
```

## Bad

```ts
// Node singleton on workerd — request 2 reuses request 1's socket, then hangs
const prisma = globalThis.prisma ?? new PrismaClient({ adapter });
// request-derived value at module scope — leaks one tenant into the next request
let tenant: string | null = null;
export default {
  async fetch(req: Request) {
    tenant = req.headers.get("x-tenant");
  },
};
```

## Fix

Move client construction and every request-derived value into the handler (or a per-`ctx` memo); keep only immutable config at module scope.

> Source: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#do-not-store-request-scoped-state-in-global-scope · https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/ · https://developers.cloudflare.com/workers/observability/errors/#cannot-perform-io-on-behalf-of-a-different-request
