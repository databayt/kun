import crypto from "node:crypto";
import { NormalizedJobInput } from "./types";

export function generateJobFingerprint(
  title: string,
  company: string,
  remoteType = "remote"
): string {
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  const normCompany = company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  const rawKey = `${normCompany}:${normTitle}:${remoteType.toLowerCase()}`;
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

export function attachJobFingerprint(job: NormalizedJobInput): NormalizedJobInput {
  const fingerprint = generateJobFingerprint(job.title, job.company, job.remoteType);
  return {
    ...job,
    fingerprint,
  };
}
