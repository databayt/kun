import { buildEvidenceKnowledgeProfile } from "./evidence-extractor";
import { DEFAULT_CAMPAIGNS } from "./campaigns";
import { EngineObservabilityStats, EvidenceFreshness } from "./types";

export function getJobEngineObservability(): EngineObservabilityStats {
  const profile = buildEvidenceKnowledgeProfile();
  
  const deepCount = profile.facts.filter((f) => f.evidenceWeight === "deep_production_proof").length;
  const surfaceCount = profile.facts.filter((f) => f.evidenceWeight === "surface_manifest_proof").length;
  const metaCount = profile.facts.filter((f) => f.evidenceWeight === "metadata_proof").length;

  const now = Date.now();
  const updatedTime = new Date(profile.updatedAt).getTime();
  const ageHours = (now - updatedTime) / (1000 * 60 * 60);

  let freshness: EvidenceFreshness = "fresh";
  if (ageHours > 168) {
    freshness = "stale"; // > 7 days
  } else if (ageHours > 24) {
    freshness = "aging"; // > 24 hours
  }

  return {
    repositoriesDiscovered: profile.repositories.length,
    repositoriesAnalyzed: profile.repositories.filter((r) => r.sources.some((s) => s.isAvailable)).length,
    totalFactsExtracted: profile.facts.length,
    factsByWeight: {
      deepProduction: deepCount,
      surfaceManifest: surfaceCount,
      metadata: metaCount,
    },
    evidenceFreshness: freshness,
    lastScannedAt: profile.updatedAt,
    analyzerVersion: profile.analyzerVersion,
    activeCampaignsCount: DEFAULT_CAMPAIGNS.filter((c) => c.isActive).length,
  };
}
