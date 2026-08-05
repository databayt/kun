// Object storage for assets the site itself receives.
//
// scripts/higgs-library.mjs already puts bytes in this bucket through the aws
// CLI, which is fine for a script on a Mac and impossible in a Vercel function.
// Same bucket, same `media/<brand>/` layout, so a render uploaded from a phone
// and one imported from ~/Downloads land beside each other and the library's
// key convention stays one convention.
//
// Reads are served from the S3 origin rather than cdn.databayt.org: the
// distribution 403s on every key in this bucket, a fault that predates the
// library. When it is fixed this is the one line that changes.

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const BUCKET = "hogwarts-databayt";
const PREFIX = "media";
const ORIGIN = `https://${BUCKET}.s3.amazonaws.com`;

export interface StoredObject {
  key: string;
  url: string;
}

/**
 * Null when the machine has no credentials, so a caller can degrade to "upload
 * unavailable" instead of throwing a stack trace at a contributor. A missing
 * key is a configuration state, not an exception.
 */
function client(): S3Client | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  // .trim() throughout: Vercel env vars carry a stray trailing newline often
  // enough that it has broken a shipped feature before.
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: process.env.AWS_REGION?.trim() || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function isStorageConfigured(): boolean {
  return client() !== null;
}

/**
 * Key layout mirrors the library's: media/<brand>/<id>-<slug>.<ext>. The id
 * prefix is what keeps two people uploading "hero.png" on the same day from
 * silently overwriting each other — the bucket has no versioning.
 */
export async function putMedia(
  brand: string,
  id: string,
  filename: string,
  body: Uint8Array,
  contentType: string,
): Promise<StoredObject> {
  const s3 = client();
  if (!s3) throw new Error("Object storage is not configured on this machine.");

  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-64);
  const key = `${PREFIX}/${brand}/${id}-${safe}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { key, url: `${ORIGIN}/${key}` };
}
