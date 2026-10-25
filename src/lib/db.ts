import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 removed the bare `new PrismaClient()` — the client is Rust-free and
// requires a driver adapter. PrismaNeon speaks Neon's serverless protocol over
// HTTP/WebSocket, which is what makes it viable from a serverless function
// where a normal TCP pool would exhaust connections.
//
// Two runtimes, one `db`:
//
// - Cloudflare Workers (production, CF_WORKERS=1): a Worker's socket belongs to
//   the request that opened it — reusing it from a later request hangs — so each
//   request gets its own client, keyed on the per-request ctx object. (Same
//   recipe as food, space, co and codebase.)
// - Node (local dev, scripts): one client cached on globalThis, because dev
//   hot-reload re-evaluates modules on every change; without this each reload
//   opens another client and Neon starts refusing connections.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = (process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — the social queue cannot start without it.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
}

function workerCtx(): object | undefined {
  if (!process.env.CF_WORKERS) return undefined;
  try {
    return getCloudflareContext().ctx;
  } catch {
    return undefined;
  }
}

const perRequest = new WeakMap<object, PrismaClient>();

function getClient(): PrismaClient {
  const ctx = workerCtx();
  if (ctx) {
    let client = perRequest.get(ctx);
    if (!client) {
      client = createClient();
      perRequest.set(ctx, client);
    }
    return client;
  }
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

// Constructed on first *use*, not on import. `next build` imports every route
// module to read its `runtime`/`dynamic` exports, so an eager client turned a
// missing DATABASE_URL into a build failure for the whole site — routes that
// never touch the database included. Lazily, a missing URL fails only the
// request that actually needs a query.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has: (_target, prop) => Reflect.has(getClient(), prop),
  ownKeys: () => Reflect.ownKeys(getClient()),
  getOwnPropertyDescriptor: (_target, prop) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(getClient(), prop);
    // A proxy may only report a non-configurable prop if the target has one,
    // and the target here is an empty object — so soften it.
    return descriptor && { ...descriptor, configurable: true };
  },
});
