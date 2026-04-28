import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import { BUCKET, REGION, CACHE_CONTROL } from "./config.js";
import type { BlobMeta } from "./types.js";

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({ region: REGION });
  return _client;
}

export async function objectExists(key: string, sha256: string): Promise<boolean> {
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const meta = head.Metadata ?? {};
    if (meta.sha256 === sha256) return true;
    return false;
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function uploadAsset(
  key: string,
  blob: BlobMeta,
  sourceUrl: string,
): Promise<{ uploaded: boolean }> {
  if (await objectExists(key, blob.sha256)) {
    return { uploaded: false };
  }

  const body = await readFile(blob.stagingPath);
  await client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: blob.contentType,
    CacheControl: CACHE_CONTROL,
    Metadata: {
      sourceUrl,
      sha256: blob.sha256,
    },
  }));
  return { uploaded: true };
}

export function hasCredentials(): boolean {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) return true;
  if (process.env.AWS_PROFILE) return true;
  return false;
}
