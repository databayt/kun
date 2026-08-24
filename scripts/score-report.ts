#!/usr/bin/env tsx
// Score every job in a JSON file (or the golden test set) against the current
// profile, and print the 5D breakdown. This is the regression instrument for
// the lane work: run it before and after, diff the software-lane numbers.
//
//   pnpm dlx tsx scripts/score-report.ts --golden
//   pnpm dlx tsx scripts/score-report.ts jobs/kigali-jobs.normalized.json

import { readFileSync } from "node:fs";

import { evaluateCampaignMatches } from "@/lib/jobs/campaigns";
import { CV_TECHNOLOGY_CATEGORIES } from "@/lib/jobs/cv-evidence";
import { buildEvidenceKnowledgeProfile } from "@/lib/jobs/evidence-extractor";
import { resolveJobLane } from "@/lib/jobs/lanes";
import { calculateDeterministicMatch } from "@/lib/jobs/matcher";
import { NormalizedJobInput } from "@/lib/jobs/types";

/// The nine job shapes the vitest suites assert on. Kept here verbatim so the
/// report can prove the software lane did not move without running vitest.
const GOLDEN: NormalizedJobInput[] = [
  {
    title: "Senior Full-Stack AI Engineer", company: "ScaleAI Labs", remoteType: "remote",
    employmentType: "full_time", description: "Build AI products with Next.js and TypeScript.",
    responsibilities: [], requiredSkills: ["Next.js", "React", "TypeScript", "PostgreSQL", "Prisma", "AI"],
    preferredSkills: ["Tailwind CSS", "Docker"], domain: "AI & SaaS",
  },
  {
    title: "Founding Engineer (0 to 1)", company: "Stealth", remoteType: "remote",
    employmentType: "full_time", description: "Own the product end to end from zero.",
    responsibilities: [], requiredSkills: ["Next.js", "TypeScript", "PostgreSQL"],
    preferredSkills: ["React 19", "Tailwind CSS"], domain: "Startup / SaaS",
  },
  {
    title: "Lead SaaS Architect", company: "EduCloud", remoteType: "remote",
    employmentType: "full_time", description: "Architect multi-tenant education SaaS.",
    responsibilities: [], requiredSkills: ["Next.js", "Prisma", "PostgreSQL", "NextAuth"],
    preferredSkills: [], domain: "Education & SaaS",
  },
  {
    title: "Senior Kubernetes & Embedded C++ Graphics Engineer", company: "BareMetal Inc",
    remoteType: "onsite", employmentType: "full_time", description: "Bare-metal graphics work.",
    responsibilities: [], requiredSkills: ["C++", "Vulkan", "Kubernetes", "Embedded Systems", "Security Clearance"],
    preferredSkills: [], domain: "Bare-Metal Systems",
  },
  {
    title: "Defense Systems Software Engineer", company: "DefCorp", remoteType: "onsite",
    employmentType: "full_time", description: "Classified defense systems.",
    responsibilities: [], requiredSkills: ["Security Clearance", "C++"],
    preferredSkills: [], domain: "Defense",
  },
  {
    title: "Product Engineer", company: "WebCo", remoteType: "remote",
    employmentType: "full_time", description: "Ship product features fast.",
    responsibilities: [], requiredSkills: ["Next.js", "React", "TypeScript", "AWS"],
    preferredSkills: [], domain: "Web SaaS",
  },
  {
    title: "C++ Bare-Metal Graphics Systems Engineer", company: "GfxCorp", remoteType: "onsite",
    employmentType: "full_time", description: "Low level graphics.",
    responsibilities: [], requiredSkills: ["C++", "Vulkan", "Embedded Graphics", "Security Clearance"],
    preferredSkills: [], domain: "Gaming & Graphics",
  },
  {
    title: "Full-Stack Engineer", company: "SaaSCo", remoteType: "remote",
    employmentType: "full_time", description: "Full stack SaaS work.",
    responsibilities: [], requiredSkills: ["Next.js", "TypeScript"],
    preferredSkills: [], domain: "SaaS",
  },
  {
    title: "Founding Full-Stack AI Engineer", company: "AIStartup", remoteType: "remote",
    employmentType: "full_time", description: "0 to 1 AI product at an early stage startup.",
    responsibilities: [], requiredSkills: ["Next.js", "React", "TypeScript", "Prisma", "PostgreSQL", "AI"],
    preferredSkills: ["Tailwind CSS", "Docker", "CRM"], domain: "AI & SaaS",
  },
];

const arg = process.argv[2];
const jobs: NormalizedJobInput[] =
  !arg || arg === "--golden"
    ? GOLDEN
    : (JSON.parse(readFileSync(arg, "utf-8")) as NormalizedJobInput[]);

const baseline = process.argv.includes("--baseline");

const full = buildEvidenceKnowledgeProfile();
/// --baseline strips the CV-sourced technologies, reproducing the profile the
/// matcher saw before cv-evidence.ts existed. Diff the two runs to prove the
/// software lane did not drift.
const profile = baseline
  ? { ...full, technologies: full.technologies.filter((t) => !CV_TECHNOLOGY_CATEGORIES.has(t.category)) }
  : full;

console.log(
  `profile: ${profile.technologies.length} technologies · ${profile.capabilities.length} capabilities · ${profile.positioningRoles.length} roles · ${profile.facts.length} facts\n`,
);
console.log("score  recommendation    lane        tech  cap  dom  sen  hard  camp  title");
console.log("-".repeat(110));

for (const job of jobs) {
  const m = calculateDeterministicMatch(job, profile);
  const d = m.dimensions;
  const hard = m.blockers.filter((b) => b.severity === "hard_blocker").length;
  const camps = evaluateCampaignMatches(job).length;
  console.log(
    `${String(m.overallScore).padStart(4)}%  ${m.recommendation.padEnd(16)} ${resolveJobLane(job).padEnd(10)} ` +
      `${String(d.technical.score).padStart(4)} ${String(d.capability.score).padStart(4)} ` +
      `${String(d.domain.score).padStart(4)} ${String(d.seniority.score).padStart(4)} ` +
      `${String(hard).padStart(5)}  ${String(camps).padStart(4)}  ${job.title.slice(0, 44)}`,
  );
}
