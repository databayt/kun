-- CreateEnum
CREATE TYPE "JobOpportunityStatus" AS ENUM ('discovered', 'analyzed', 'needs_review', 'qualified', 'high_priority', 'preparing', 'ready_to_apply', 'applied', 'response', 'screen', 'interview', 'technical_round', 'final_round', 'offer', 'rejected', 'withdrawn', 'ghosted', 'archived');

-- CreateEnum
CREATE TYPE "RemoteType" AS ENUM ('remote', 'hybrid', 'onsite');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'freelance');

-- CreateTable
CREATE TABLE "JobOpportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyUrl" TEXT,
    "location" TEXT,
    "remoteType" "RemoteType" NOT NULL DEFAULT 'remote',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'full_time',
    "salary" TEXT,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" TEXT,
    "domain" TEXT,
    "sourceUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" "JobOpportunityStatus" NOT NULL DEFAULT 'discovered',
    "twentyOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssessment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "technicalMatch" DOUBLE PRECISION NOT NULL,
    "capabilityMatch" DOUBLE PRECISION NOT NULL,
    "domainMatch" DOUBLE PRECISION NOT NULL,
    "experienceMatch" DOUBLE PRECISION NOT NULL,
    "recommendation" TEXT NOT NULL,
    "whySummary" TEXT NOT NULL,
    "strongEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticalMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "niceToHaveMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "talkingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceProfileSnapshot" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOpportunity_status_createdAt_idx" ON "JobOpportunity"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobOpportunity_company_idx" ON "JobOpportunity"("company");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssessment_jobId_key" ON "JobAssessment"("jobId");

-- CreateIndex
CREATE INDEX "JobAssessment_overallScore_idx" ON "JobAssessment"("overallScore");

-- CreateIndex
CREATE INDEX "EvidenceProfileSnapshot_scannedAt_idx" ON "EvidenceProfileSnapshot"("scannedAt");

-- AddForeignKey
ALTER TABLE "JobAssessment" ADD CONSTRAINT "JobAssessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

