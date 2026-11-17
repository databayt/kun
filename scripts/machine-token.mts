// pnpm machine:token <login> — create or rotate a machine's bearer token. Prints it ONCE; only the
// sha256 is stored (Machine.tokenHash). This WRITES to a database, so it refuses to run unless
// MACHINE_TOKEN_DB_URL is set explicitly — it never falls back to .env (which points at prod Neon).
//   MACHINE_TOKEN_DB_URL=postgres://… pnpm machine:token moed
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

const login = (process.argv[2] ?? "").trim();
const url = (process.env.MACHINE_TOKEN_DB_URL ?? "").trim();
if (!login || !/^[a-z0-9-]{1,32}$/.test(login)) {
  console.error("usage: MACHINE_TOKEN_DB_URL=<url> pnpm machine:token <login>");
  process.exit(1);
}
if (!url) {
  console.error("refusing: set MACHINE_TOKEN_DB_URL explicitly (this script never reads DATABASE_URL).");
  process.exit(1);
}
const file = join(import.meta.dirname, "..", "machines", `${login}.json`);
if (!existsSync(file)) {
  console.error(`no profile: machines/${login}.json`);
  process.exit(1);
}
const profile = JSON.parse(readFileSync(file, "utf8")) as { name: string; os?: string };

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
try {
  await db.machine.upsert({
    where: { login },
    create: { login, name: profile.name, os: profile.os ?? "", tokenHash },
    update: { tokenHash },
  });
} finally {
  await db.$disconnect();
}
console.log(`machine token for ${login} (shown once, store it in the machine's keyring):\n${token}`);
