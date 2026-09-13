// kun on Cloudflare Containers — a thin Worker in front of one always-on
// container running the Next standalone server. Mirrors the hogwarts and mkan
// lanes; every request is forwarded as-is so the app sees the real Host header.
import { Container, getContainer } from "@cloudflare/containers"
import crons from "./crons.json"

export class KunContainer extends Container {
  defaultPort = 3000
  sleepAfter = "24h"

  constructor(ctx, env) {
    super(ctx, env)
    // Every string binding (Worker secrets + vars) becomes container env.
    // Applied at container start only — rotating a secret needs a restart.
    this.envVars = Object.fromEntries(
      Object.entries(env).filter(([, v]) => typeof v === "string")
    )
  }
}

export default {
  async fetch(request, env) {
    return getContainer(env.KUN, "main").fetch(request)
  },

  // Cron triggers call the app's own routes inside the container.
  // NOTE: newly added triggers took ~19 hours to start firing on hogwarts —
  // registered and shown in the dashboard the whole time. Do not assume they
  // are broken on day one.
  async scheduled(controller, env, ctx) {
    const paths = crons.schedules[controller.cron] ?? []
    const run = async (path) => {
      const started = Date.now()
      try {
        const res = await getContainer(env.KUN, "main").fetch(
          new Request("https://kun.databayt.org" + path, {
            headers: {
              authorization: "Bearer " + env.CRON_SECRET,
              "user-agent": "cloudflare-cron/1",
            },
          })
        )
        console.log(JSON.stringify({ cron: controller.cron, path, status: res.status, ms: Date.now() - started }))
      } catch (e) {
        console.error(JSON.stringify({ cron: controller.cron, path, error: String(e) }))
      }
    }
    // Sequential: one container instance, and a tick can fan out to several jobs.
    ctx.waitUntil((async () => { for (const p of paths) await run(p) })())
  },
}
