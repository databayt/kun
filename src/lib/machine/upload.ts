// Presigned PUT links for a work order's deliverables: `work/<film>/<issue>/<file>` on the CDN bucket.
// The signer is injectable so tests never touch AWS.
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Task, UploadRequest, UploadResponse } from "./contract";
import { uploadKey } from "./tasks";

export const CDN_BUCKET = "databayt-cdn";
export const CDN_HOST = "cdn.databayt.org";
export const PRESIGN_SECONDS = 900;

export type Signer = (key: string, contentType: string) => Promise<string>;

function s3(): S3Client {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) throw new Error("AWS credentials are not set");
  return new S3Client({
    region: process.env.AWS_REGION?.trim() || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
  });
}

export const defaultSigner: Signer = (key, contentType) =>
  getSignedUrl(s3(), new PutObjectCommand({ Bucket: CDN_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: PRESIGN_SECONDS,
  });

/** One presigned PUT per file; null when any file name is empty after sanitising. */
export async function presignUploads(
  task: Pick<Task, "repo" | "number" | "kun">,
  files: UploadRequest["files"],
  sign: Signer = defaultSigner,
): Promise<UploadResponse["uploads"] | null> {
  const keys = files.map((f) => uploadKey(task, f.name));
  if (keys.some((k) => k === null)) return null;
  return Promise.all(
    files.map(async (f, i) => ({
      name: f.name,
      key: keys[i]!,
      putUrl: await sign(keys[i]!, f.contentType),
      publicUrl: `https://${CDN_HOST}/${keys[i]}`,
      contentType: f.contentType,
    })),
  );
}
