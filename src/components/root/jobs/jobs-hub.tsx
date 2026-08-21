"use client";

import { useState } from "react";
import { EngineeringKnowledgeProfile, FullJobWithAssessment } from "@/lib/jobs/types";
import { ingestAndAnalyzeJob } from "@/actions/jobs";
import { JobCard } from "./job-card";
import { ProfileDossier } from "./profile-dossier";
import { getJobsDict } from "./dictionary";
import { type Locale } from "@/components/local/config";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Search,
  Briefcase,
  Layers,
  Send,
  PlusCircle,
  TrendingUp,
  Filter,
  CheckCircle2,
  Cpu,
} from "lucide-react";

interface JobsHubProps {
  initialJobs: FullJobWithAssessment[];
  profile: EngineeringKnowledgeProfile;
  lang: string;
}

const SAMPLE_JOB_PRESET = `Senior Full-Stack AI Engineer
Company: ScaleAI Labs (Remote - Global)
Employment: Full-time
Salary: $110,000 - $140,000 / year

About the Role:
We are looking for a Founding-level Full-Stack AI Engineer to build, architect, and scale our AI-driven web applications. You will be responsible for creating modern interfaces in Next.js/React, engineering serverless backends and database architectures with PostgreSQL/Prisma, integrating LLM APIs (Claude, Gemini, OpenAI) with structured schemas, and deploying scalable SaaS infrastructure.

Responsibilities:
- Build high-performance, accessible web applications using Next.js 15+, React 19, TypeScript, and Tailwind CSS.
- Architect multi-tenant database models and authentication workflows using PostgreSQL and Prisma ORM.
- Design and integrate structured AI workflows, prompt engineering pipelines, and agent systems.
- Build internal automation tools, scraping pipelines, and CRM integrations for lead workflows.

Requirements:
- Proven experience shipping production-grade full-stack web applications.
- Deep expertise in Next.js App Router, React, TypeScript, and modern component systems (Radix / Tailwind).
- Hands-on experience with PostgreSQL, relational database schemas, and modern ORMs (Prisma).
- Experience integrating LLM APIs and structured data extraction.
- Strong product engineering mindset and ability to move from idea to production independently.`;

export function JobsHub({ initialJobs, profile, lang }: JobsHubProps) {
  const locale = lang as Locale;
  const t = getJobsDict(locale);
  const isAr = lang === "ar";

  const [jobs, setJobs] = useState<FullJobWithAssessment[]>(initialJobs);
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "high" | "remote" | "crm">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim() || rawText.trim().length < 20) {
      setErrorMsg(isAr ? "يرجى كتابة أو لصق وصف الوظيفة كاملاً (20 حرفاً على الأقل)." : "Please paste a complete job description (at least 20 characters).");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg("");

    try {
      const res = await ingestAndAnalyzeJob(rawText, sourceUrl);
      if (res.ok && res.job) {
        setJobs([res.job, ...jobs]);
        setRawText("");
        setSourceUrl("");
      } else {
        setErrorMsg(res.error || "Failed to analyze job.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error analyzing job.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUsePreset = () => {
    setRawText(SAMPLE_JOB_PRESET);
    setSourceUrl("https://example.com/careers/senior-fullstack-ai-engineer");
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.requiredSkills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === "high") {
      return (job.assessment?.overallScore ?? 0) >= 80;
    }
    if (filter === "remote") {
      return job.remoteType === "remote";
    }
    if (filter === "crm") {
      return Boolean(job.twentyOpportunityId);
    }
    return true;
  });

  const highPriorityCount = jobs.filter((j) => (j.assessment?.overallScore ?? 0) >= 80).length;
  const crmCount = jobs.filter((j) => Boolean(j.twentyOpportunityId)).length;

  return (
    <div className="container-wrapper py-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card/60 p-4 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            {isAr ? "إجمالي الفرص المقيمة" : "Total Opportunities"}
          </div>
          <div className="text-2xl font-bold">{jobs.length}</div>
        </div>

        <div className="rounded-xl border bg-card/60 p-4 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            {isAr ? "أولوية قصوى (80%+)" : "High Priority (80%+)"}
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {highPriorityCount}
          </div>
        </div>

        <div className="rounded-xl border bg-card/60 p-4 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-purple-500" />
            {isAr ? "مزامنة إلى Twenty CRM" : "In Twenty CRM"}
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {crmCount}
          </div>
        </div>

        <div className="rounded-xl border bg-card/60 p-4 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            {isAr ? "مستودعات موثقة" : "Verified Repos"}
          </div>
          <div className="text-2xl font-bold">{profile.repositories.length}</div>
        </div>
      </div>

      <Tabs defaultValue="opportunities" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="opportunities" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {t.opportunitiesTab} ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t.profileTab}
            </TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUsePreset}
            className="text-xs font-normal"
          >
            <Sparkles className="h-3.5 w-3.5 me-1.5 text-amber-500" />
            {isAr ? "تحميل نموذج وظيفة للتجربة" : "Load Sample Full-Stack AI Job"}
          </Button>
        </div>

        {/* Tab 1: Opportunities & Ingestion */}
        <TabsContent value="opportunities" className="space-y-8 mt-0">
          {/* Job Intake Form */}
          <div className="rounded-2xl border bg-card p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  {t.analyzeNewJob}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "يقوم المحرك بتطبيع متطلبات الوظيفة ومقارنتها فوراً بالأدلة الهندسية من مستودعاتك."
                    : "The engine extracts requirements and matches them directly against verified evidence from your repos."}
                </p>
              </div>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-3">
              <Textarea
                placeholder={t.inputPlaceholder}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
                className="font-sans text-sm resize-y"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder={t.urlPlaceholder}
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="text-sm sm:flex-1"
                />

                <Button
                  type="submit"
                  disabled={isAnalyzing || !rawText.trim()}
                  className="sm:w-auto font-medium"
                >
                  <Sparkles className="h-4 w-4 me-2 text-amber-300" />
                  {isAnalyzing ? t.analyzingText : t.analyzeButton}
                </Button>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-500 font-medium bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {errorMsg}
                </p>
              )}
            </form>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isAr ? "بحث في الوظائف أو الشركات أو المهارات..." : "Search jobs, companies, skills..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                className="h-8 text-xs font-normal"
              >
                {t.filterAll}
              </Button>
              <Button
                size="sm"
                variant={filter === "high" ? "default" : "outline"}
                onClick={() => setFilter("high")}
                className="h-8 text-xs font-normal"
              >
                {t.filterHighPriority}
              </Button>
              <Button
                size="sm"
                variant={filter === "remote" ? "default" : "outline"}
                onClick={() => setFilter("remote")}
                className="h-8 text-xs font-normal"
              >
                {t.filterRemote}
              </Button>
              <Button
                size="sm"
                variant={filter === "crm" ? "default" : "outline"}
                onClick={() => setFilter("crm")}
                className="h-8 text-xs font-normal"
              >
                Twenty CRM ({crmCount})
              </Button>
            </div>
          </div>

          {/* Jobs List */}
          <div className="space-y-4">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} lang={lang} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-12 text-center space-y-3">
                <Briefcase className="h-10 w-10 text-muted-foreground mx-auto" />
                <h4 className="font-semibold text-base">
                  {isAr ? "لم يتم العثور على فرص تطابق الفلتر" : "No job opportunities match this filter"}
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isAr
                    ? "الصق إعلان وظيفة جديد في الصندوق أعلاه لتحليله فوراً ومطابقته بالأدلة."
                    : "Paste a job description in the box above to immediately analyze and match against your evidence profile."}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Candidate Knowledge Profile Dossier */}
        <TabsContent value="profile" className="mt-0">
          <ProfileDossier profile={profile} lang={lang} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
