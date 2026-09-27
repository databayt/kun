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

/// Two postings for the same role often arrive worded differently from two
/// sources ("Technical Support Engineers" vs "Technical Support Engineer
/// (freelance)"). Fingerprints differ; this catches them. Word-set overlap on
/// the significant words, parentheticals and plural endings ignored.
export function similarRole(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/\(.*?\)/g, " ")
        .split(/[^a-z0-9]+/)
        .map((w) => w.replace(/s$/, ""))
        .filter((w) => w.length >= 2 && !["and", "the", "for", "with", "senior", "junior", "fixed", "term"].includes(w)),
    );
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return false;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / Math.min(A.size, B.size) >= 0.75;
}
