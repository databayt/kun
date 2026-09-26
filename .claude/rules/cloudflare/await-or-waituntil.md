---
domain: cloudflare
severity: warn
paths: ["**/cf/*worker*.js", "**/cf/*worker*.ts", "**/src/worker.ts"]
since: "2026-09-26"
---

# Every promise in a Worker handler is awaited, returned, or given to `ctx.waitUntil`

The runtime may end an invocation as soon as `fetch()` returns its response or `scheduled()` resolves; a floating promise is then dropped with no error. In the Containers lane that failure looks exactly like "the cron is not firing": `scheduled()` fans out to `/api/cron/*` inside the container, and an un-awaited fan-out never lands. Use `await` (or `return`) when the result must exist before the response is correct; use `ctx.waitUntil()` for work that may finish after it (cache puts, cron fan-out, telemetry), within the `waitUntil` time limit. Call it as `ctx.waitUntil(...)` — destructuring loses the receiver. Catch leftovers with the `@typescript-eslint/no-floating-promises` lint rule.

## Good

```js
async scheduled(controller, env, ctx) {
  const paths = CRONS[controller.cron] ?? [];
  // kept alive until every call settles; failures show up in Workers Logs
  ctx.waitUntil(Promise.all(paths.map((p) => hitContainer(env, p))));
}
```

## Bad

```js
async scheduled(controller, env) {
  for (const p of CRONS[controller.cron]) hitContainer(env, p); // floating — may never reach the container
}
// and: const { waitUntil } = ctx; waitUntil(p);                // detached from ctx — loses its receiver
```

## Fix

`await` the promise or wrap it in `ctx.waitUntil(...)`, and enable `@typescript-eslint/no-floating-promises` for Worker code.

> Source: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#always-await-or-waituntil-your-promises · https://github.com/cloudflare/skills/blob/main/skills/workers-best-practices/SKILL.md
