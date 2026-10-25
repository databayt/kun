// The deployed Worker: OpenNext's handler (the build writes ../.open-next/worker.js) plus a
// `scheduled` handler for the cron triggers in wrangler.jsonc.
import handler from "../.open-next/worker.js"
import crons from "./crons.json"

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js"

export default {
  fetch: handler.fetch,

  // Cron triggers call the app's own routes (through the OpenNext handler, in-process) with the
  // CRON_SECRET bearer — exactly what the container Worker did over its DO stub.
  // NOTE: newly added triggers took ~19 hours to start firing on hogwarts — registered and shown in
  // the dashboard the whole time. Do not assume they are broken on day one.
  async scheduled(controller, env, ctx) {
    const paths = crons.schedules[controller.cron] ?? []
    const run = async (path) => {
      const started = Date.now()
      try {
        const res = await handler.fetch(
          new Request("https://kun.databayt.org" + path, {
            headers: { authorization: "Bearer " + env.CRON_SECRET, "user-agent": "cloudflare-cron/1" },
          }),
          env,
          ctx,
        )
        console.log(JSON.stringify({ cron: controller.cron, path, status: res.status, ms: Date.now() - started }))
      } catch (e) {
        console.error(JSON.stringify({ cron: controller.cron, path, error: String(e) }))
      }
    }
    ctx.waitUntil((async () => { for (const p of paths) await run(p) })())
  },
}
