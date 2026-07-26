import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 removed the bare `new PrismaClient()` — the client is Rust-free and
// requires a driver adapter. PrismaNeon speaks Neon's serverless protocol over
// HTTP/WebSocket, which is what makes it viable from a serverless function
// where a normal TCP pool would exhaust connections.
//
// Cached on globalThis because dev hot-reload re-evaluates modules on every
// change; without this each reload opens another client and Neon starts
// refusing connections.

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

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
