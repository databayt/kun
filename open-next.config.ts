// OpenNext adapter config for Cloudflare Workers.
//
// kun is an internal tool: docs, the Social Hub, the seek console. Pages are mostly dynamic or
// build-time static, so the cache is the OpenNext default set, all on the Workers Paid plan:
//   incremental cache → KV (NEXT_INC_CACHE_KV)
//   tag cache         → Durable Object, sharded (NEXT_TAG_CACHE_DO_SHARDED) — revalidatePath/Tag
//   queue             → in-memory
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache"
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue"
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache"

const config = {
  ...defineCloudflareConfig({
    incrementalCache: kvIncrementalCache,
    tagCache: doShardedTagCache({ baseShardSize: 4 }),
    queue: memoryQueue,
  }),
  // Webpack, not Turbopack: Turbopack wraps Prisma 7's query-compiler .wasm in a Node loader that
  // reads it off disk, and workerd has no filesystem. gen-bundle first, so the files the app used
  // to read at request time (install shims, docs graph, decks) are bundled fresh.
  buildCommand: "node scripts/gen-bundle.mjs && next build --webpack && node scripts/cf-trace-otel.mjs",
}

export default config
