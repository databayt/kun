import { describe, expect, it } from "vitest";
import { heartbeatSchema, poolCreateSchema, shareSchema } from "./contract";
import { claimJob, meetsNeeds, poolKey, requeueStale, recordProgress } from "./pool";
import type { JobRow, PoolStore } from "./pool";

const row = (o: Partial<JobRow> = {}): JobRow => ({
  id: "j1", kind: "encode", params: { preset: "proxy" }, requester: "ali", target: null, donor: null,
  status: "queued", inputs: [{ name: "a.mov", key: "pool/j1/in/0-a.mov", size: 1, contentType: "video/quicktime" }],
  outputs: null, needs: null, progress: 0, log: "", claims: 0, lastProgressAt: null,
  createdAt: new Date(0), updatedAt: new Date(0), finishedAt: null, ...o,
});

/** In-memory store with the same compare-and-swap semantics as updateMany; one await per call yields. */
function memStore(initial: JobRow): PoolStore & { row: JobRow } {
  const s = {
    row: initial,
    async findUnique() {
      await Promise.resolve();
      return { ...s.row };
    },
    async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      await Promise.resolve();
      const r = s.row as unknown as Record<string, unknown>;
      if (where.id !== undefined && where.id !== r.id) return { count: 0 };
      if (where.status !== undefined && where.status !== r.status) return { count: 0 };
      if (where.donor !== undefined && where.donor !== r.donor) return { count: 0 };
      const lt = (where.claims as { lt?: number } | undefined)?.lt;
      if (lt !== undefined && !((r.claims as number) < lt)) return { count: 0 };
      if (where.OR) {
        const cutoff = ((where.OR as { lastProgressAt?: { lt: Date } }[])[0].lastProgressAt as { lt: Date }).lt;
        const last = (s.row.lastProgressAt ?? s.row.updatedAt) as Date;
        if (!(last < cutoff)) return { count: 0 };
      }
      for (const [k, v] of Object.entries(data)) {
        r[k] = v && typeof v === "object" && "increment" in v ? (r[k] as number) + (v as { increment: number }).increment : v;
      }
      return { count: 1 };
    },
  };
  return s;
}

const share = { enabled: true, kinds: ["encode" as const], idleMinutes: 10 };
const sign = async (key: string) => `https://s3/${key}`;
const claim = (st: PoolStore, login: string, sh = share) => claimJob(st, { id: "j1", login, share: sh, resources: null }, sign);

describe("claim", () => {
  it("two concurrent claims: exactly one wins", async () => {
    const st = memStore(row());
    const [a, b] = await Promise.all([claim(st, "moed"), claim(st, "sara")]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const loser = a.ok ? b : a;
    expect(loser).toEqual({ ok: false, error: "taken" });
    expect(st.row.status).toBe("running");
    expect(st.row.claims).toBe(1);
  });
  it("returns presigned input links to the winner", async () => {
    const r = await claim(memStore(row()), "moed");
    expect(r.ok && r.inputs[0].getUrl).toBe("https://s3/pool/j1/in/0-a.mov");
  });
  it("refuses when sharing is off, the kind is not accepted, or the target differs", async () => {
    expect(await claim(memStore(row()), "moed", { ...share, enabled: false })).toEqual({ ok: false, error: "share" });
    expect(await claim(memStore(row({ kind: "render" })), "moed")).toEqual({ ok: false, error: "kind" });
    expect(await claim(memStore(row({ target: "sara" })), "moed")).toEqual({ ok: false, error: "target" });
    expect(await claim(memStore(row({ requester: "moed" })), "moed")).toEqual({ ok: false, error: "own" });
  });
  it("stops after two claims", async () => {
    const st = memStore(row({ claims: 2 }));
    expect(await claim(st, "moed")).toEqual({ ok: false, error: "taken" });
  });
  it("refuses when the donor's reported resources are short", async () => {
    const st = memStore(row({ needs: { ramBytes: 10, gpu: true } }));
    const r = await claimJob(st, { id: "j1", login: "moed", share, resources: { ramFree: 5 } }, sign);
    expect(r).toEqual({ ok: false, error: "needs" });
    expect(meetsNeeds({ gpu: true }, { gpu: [] })).toBe(false);
    expect(meetsNeeds({ gpu: true }, {})).toBe(true);
  });
});

describe("stale requeue and progress", () => {
  it("re-queues a running job silent for 15+ minutes, keeps claims", async () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const st = memStore(row({ status: "running", donor: "moed", claims: 1, lastProgressAt: new Date(now.getTime() - 16 * 60_000) }));
    expect(await requeueStale(st, now)).toBe(1);
    expect(st.row).toMatchObject({ status: "queued", donor: null, claims: 1 });
  });
  it("leaves a fresh job alone", async () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const st = memStore(row({ status: "running", donor: "moed", lastProgressAt: new Date(now.getTime() - 60_000) }));
    expect(await requeueStale(st, now)).toBe(0);
  });
  it("only the donor's progress counts, and the log keeps its last 4 KB", async () => {
    const st = memStore(row({ status: "running", donor: "moed" }));
    expect(await recordProgress(st, "j1", "sara", 0.5, "x")).toBe(false);
    expect(await recordProgress(st, "j1", "moed", 0.5, "a".repeat(5000) + "END")).toBe(true);
    expect(st.row.log.length).toBe(4096);
    expect(st.row.log.endsWith("END")).toBe(true);
  });
});

describe("poolKey", () => {
  it("builds server-side keys and strips path tricks", () => {
    expect(poolKey("j1", "in", "../../etc/passwd", 0)).toBe("pool/j1/in/0-passwd");
    expect(poolKey("j1", "out", "a b?.srt", 2)).toBe("pool/j1/out/2-a b_.srt");
    expect(poolKey("j1", "in", "..", 0)).toBeNull();
  });
});

const file = { name: "a.mov", size: 10, contentType: "video/quicktime" };
describe("poolCreateSchema", () => {
  const ok = { kind: "encode", params: { preset: "proxy" }, files: [file] };
  it("accepts valid params per kind", () => {
    expect(poolCreateSchema.safeParse(ok).success).toBe(true);
    expect(poolCreateSchema.safeParse({ kind: "transcribe", params: { format: "srt", language: "ar", model: "small" }, files: [file] }).success).toBe(true);
    expect(poolCreateSchema.safeParse({ kind: "render", params: { engine: "eevee", frameStart: 1, frameEnd: 50, format: "png" }, files: [file] }).success).toBe(true);
  });
  it("rejects an unknown preset, raw args, bad frames, bad kinds and file counts", () => {
    expect(poolCreateSchema.safeParse({ ...ok, params: { preset: "x264-custom" } }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ kind: "claude", params: {}, files: [file] }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ kind: "render", params: { engine: "eevee", frameStart: 10, frameEnd: 5, format: "png" }, files: [file] }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ kind: "render", params: { engine: "eevee", frameStart: 0, frameEnd: 9_000_000, format: "png" }, files: [file] }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ kind: "transcribe", params: { format: "srt", language: "arabic" }, files: [file] }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ ...ok, files: [] }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ ...ok, files: Array(11).fill(file) }).success).toBe(false);
    expect(poolCreateSchema.safeParse({ ...ok, files: [{ ...file, size: 3 * 1024 ** 3 }] }).success).toBe(false);
  });
});

describe("heartbeat additions", () => {
  const base = { appVersion: "1", os: "mac", health: { checkedAt: "x", items: [] }, repos: [], currentTask: null };
  it("accepts resources and share, both optional", () => {
    expect(heartbeatSchema.safeParse(base).success).toBe(true);
    expect(
      heartbeatSchema.safeParse({
        ...base,
        resources: { cpu: { model: "M4", cores: 12 }, ramFree: 1, gpu: [{ name: "g" }], power: { onAc: true }, idleSecs: 3 },
        share: { enabled: true, kinds: ["encode"], idleMinutes: 10 },
      }).success,
    ).toBe(true);
  });
  it("rejects a bad share kind", () => {
    expect(shareSchema.safeParse({ enabled: true, kinds: ["claude"], idleMinutes: 10 }).success).toBe(false);
  });
});
