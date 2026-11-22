// The shared compute pool: job rows, the claim compare-and-swap, stale requeue and presigned links.
// Pure of Next/HTTP so tests drive it with an in-memory store; routes pass the Prisma delegate.
import {
  POOL_GET_SECONDS,
  POOL_LOG_MAX,
  POOL_MAX_CLAIMS,
  POOL_STALE_MS,
  poolParamsSchemas,
} from "./contract";
import type {
  PoolClaimError,
  PoolClaimResponse,
  PoolFile,
  PoolJob,
  PoolKind,
  PoolNeeds,
  PoolStatus,
  PoolUpload,
  Resources,
  Share,
} from "./contract";
import { sanitizeFileName } from "./tasks";
import { defaultGetSigner, defaultSigner } from "./upload";
import type { GetSigner, Signer } from "./upload";

export interface JobRow {
  id: string;
  kind: string;
  params: unknown;
  requester: string;
  target: string | null;
  donor: string | null;
  status: string;
  inputs: unknown;
  outputs: unknown;
  needs: unknown;
  progress: number;
  log: string;
  claims: number;
  lastProgressAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

/** The slice of the Prisma `computeJob` delegate the pool uses. */
export interface PoolStore {
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  findUnique(args: { where: { id: string } }): Promise<JobRow | null>;
}

const keyBase = (id: string, dir: "in" | "out") => `pool/${id}/${dir}/`;

/** Server-built key; the name is sanitised, and a leading index keeps duplicate names apart. */
export function poolKey(id: string, dir: "in" | "out", name: string, index: number): string | null {
  const clean = sanitizeFileName(name)?.replace(/[^\p{L}\p{N}._ -]/gu, "_");
  return clean ? `${keyBase(id, dir)}${index}-${clean}` : null;
}

export function validParams(kind: PoolKind, params: unknown): boolean {
  return poolParamsSchemas[kind].safeParse(params).success;
}

export function toJob(r: JobRow, outputs?: PoolJob["outputs"]): PoolJob {
  return {
    id: r.id,
    kind: r.kind as PoolKind,
    params: (r.params ?? {}) as Record<string, unknown>,
    requester: r.requester,
    target: r.target,
    donor: r.donor,
    status: r.status as PoolStatus,
    inputs: (r.inputs ?? []) as PoolFile[],
    outputs: outputs ?? ((r.outputs ?? null) as PoolFile[] | null),
    needs: (r.needs ?? null) as PoolNeeds | null,
    progress: r.progress,
    log: r.log,
    claims: r.claims,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

/** Running jobs silent for POOL_STALE_MS go back to the queue (claims are kept, so the cap still holds). */
export async function requeueStale(store: PoolStore, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - POOL_STALE_MS);
  const { count } = await store.updateMany({
    where: { status: "running", OR: [{ lastProgressAt: { lt: cutoff } }, { lastProgressAt: null, updatedAt: { lt: cutoff } }] },
    data: { status: "queued", donor: null, progress: 0 },
  });
  return count;
}

/** Does the donor's last report cover the job's needs? Unknown resources never block a claim. */
export function meetsNeeds(needs: PoolNeeds | null, r: Resources | null): boolean {
  if (!needs || !r) return true;
  if (needs.ramBytes && r.ramFree !== undefined && r.ramFree < needs.ramBytes) return false;
  if (needs.diskBytes && r.diskFree !== undefined && r.diskFree < needs.diskBytes) return false;
  if (needs.gpu && r.gpu !== undefined && r.gpu.length === 0) return false;
  return true;
}

export interface ClaimInput {
  id: string;
  login: string;
  share: Share | null;
  resources: Resources | null;
}

/** Atomic claim: exactly one concurrent caller flips queued → running. */
export async function claimJob(
  store: PoolStore,
  input: ClaimInput,
  sign: GetSigner = defaultGetSigner,
  now = new Date(),
): Promise<PoolClaimResponse> {
  const refuse = (error: PoolClaimError): PoolClaimResponse => ({ ok: false, error });
  if (!input.share?.enabled) return refuse("share");
  await requeueStale(store, now);
  const row = await store.findUnique({ where: { id: input.id } });
  if (!row) return refuse("not-found");
  if (row.requester === input.login && row.target !== input.login) return refuse("own");
  if (row.target && row.target !== input.login) return refuse("target");
  if (!input.share.kinds.includes(row.kind as PoolKind)) return refuse("kind");
  if (!meetsNeeds((row.needs ?? null) as PoolNeeds | null, input.resources)) return refuse("needs");
  const won = await store.updateMany({
    where: { id: input.id, status: "queued", claims: { lt: POOL_MAX_CLAIMS } },
    data: {
      status: "running",
      donor: input.login,
      claims: { increment: 1 },
      lastProgressAt: now,
      progress: 0,
    },
  });
  if (won.count !== 1) return refuse("taken");
  const fresh = (await store.findUnique({ where: { id: input.id } }))!;
  const inputs = await Promise.all(
    ((fresh.inputs ?? []) as PoolFile[]).map(async (f) => ({ ...f, getUrl: await sign(f.key, POOL_GET_SECONDS) })),
  );
  return { ok: true, job: toJob(fresh), inputs };
}

/** Last 4 KB of a log, cut on the tail. */
export const tailLog = (s: string): string => (s.length > POOL_LOG_MAX ? s.slice(s.length - POOL_LOG_MAX) : s);

/** Progress update; only the donor of a running job. `owned` false tells the donor to stop. */
export async function recordProgress(
  store: PoolStore,
  id: string,
  login: string,
  progress: number,
  log: string | undefined,
  now = new Date(),
): Promise<boolean> {
  const { count } = await store.updateMany({
    where: { id, donor: login, status: "running" },
    data: { progress, lastProgressAt: now, ...(log !== undefined ? { log: tailLog(log) } : {}) },
  });
  return count === 1;
}

export async function presignOutputs(
  id: string,
  files: { name: string; contentType: string; size: number }[],
  sign: Signer = defaultSigner,
): Promise<{ uploads: PoolUpload[]; outputs: PoolFile[] } | null> {
  const r = await presignFiles(id, "out", files, sign);
  return r && { uploads: r.uploads, outputs: r.files };
}

export async function presignInputs(
  id: string,
  files: { name: string; contentType: string; size: number }[],
  sign: Signer = defaultSigner,
): Promise<{ uploads: PoolUpload[]; inputs: PoolFile[] } | null> {
  const r = await presignFiles(id, "in", files, sign);
  return r && { uploads: r.uploads, inputs: r.files };
}

async function presignFiles(
  id: string,
  dir: "in" | "out",
  files: { name: string; contentType: string; size: number }[],
  sign: Signer,
) {
  const keys = files.map((f, i) => poolKey(id, dir, f.name, i));
  if (keys.some((k) => k === null)) return null;
  const uploads = await Promise.all(
    files.map(async (f, i) => ({
      name: f.name,
      key: keys[i]!,
      putUrl: await sign(keys[i]!, f.contentType),
      contentType: f.contentType,
    })),
  );
  return { uploads, files: files.map((f, i) => ({ name: f.name, key: keys[i]!, size: f.size, contentType: f.contentType })) };
}
