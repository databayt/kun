"use client";

import { useState } from "react";
import { FullJobWithAssessment } from "@/lib/jobs/types";
import { syncJobToCRM, updateJobStatusAction, deleteJobAction } from "@/actions/jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  MapPin,
  Clock,
  DollarSign,
  Trash2,
  Check,
  Briefcase,
  Copy,
  BookOpen,
  FileText,
  Target,
  Hammer,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

interface JobCardProps {
  job: FullJobWithAssessment;
  lang: string;
}

export function JobCard({ job, lang }: JobCardProps) {
  const isAr = lang === "ar";
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "problem" | "strategy" | "assets" | "interview">("overview");
  const [isSyncing, setIsSyncing] = useState(false);
  const [synced, setSynced] = useState(Boolean(job.twentyOpportunityId));
  const [status, setStatus] = useState(job.status);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [copiedAsset, setCopiedAsset] = useState<string | null>(null);

  const assessment = job.assessment;
  const problemMatch = job.problemMatch;
  const strategy = job.strategy;
  const overallScore = assessment?.overallScore ?? 0;
  const builderFitScore = problemMatch?.builderFitScore ?? 85;
  const readinessScore = strategy?.applicationReadinessScore ?? overallScore;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 70) return "text-blue-500 bg-blue-500/10 border-blue-500/30";
    if (score >= 50) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-rose-500 bg-rose-500/10 border-rose-500/30";
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAsset(key);
    setTimeout(() => setCopiedAsset(null), 2500);
  };

  const handleSyncToCRM = async () => {
    setIsSyncing(true);
    try {
      const res = await syncJobToCRM(job.id);
      if (res.ok) {
        setSynced(true);
        setStatus("high_priority");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذه الفرصة؟" : "Are you sure you want to remove this job?")) return;
    setIsDeleting(true);
    const res = await deleteJobAction(job.id);
    if (res.ok) {
      setDeleted(true);
    }
    setIsDeleting(false);
  };

  if (deleted) return null;

  return (
    <div className="rounded-xl border bg-card hover:border-primary/40 transition-all shadow-xs overflow-hidden">
      {/* Main Header Row */}
      <div className="p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight hover:text-primary transition-colors">
                {job.title}
              </h3>
              {assessment?.recommendation && (
                <Badge
                  variant="outline"
                  className={`font-semibold text-xs px-2.5 py-0.5 rounded-full ${getScoreColor(
                    overallScore
                  )}`}
                >
                  {assessment.recommendation}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                <Hammer className="h-3 w-3 me-1" />
                {isAr ? "توافق البناء:" : "Builder Fit:"} {builderFitScore}%
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                <Target className="h-3 w-3 me-1" />
                {isAr ? "جاهزية التقديم:" : "Readiness:"} {readinessScore}%
              </Badge>
              {synced && (
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                  <Check className="h-3 w-3 me-1" />
                  Twenty CRM
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Building className="h-3.5 w-3.5" />
                {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {job.remoteType.toUpperCase()} • {job.employmentType.replace("_", " ")}
              </span>
              {job.salary && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <DollarSign className="h-3.5 w-3.5" />
                  {job.salary}
                </span>
              )}
            </div>
          </div>

          {/* Overall Match Score Gauge */}
          <div className="flex items-center gap-3 self-end sm:self-start shrink-0">
            <div className="text-end">
              <div className="text-2xl font-black tracking-tight">{overallScore}%</div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                {isAr ? "التوافق الإجمالي" : "Match Score"}
              </div>
            </div>
          </div>
        </div>

        {/* Short Why Summary */}
        {assessment?.whySummary && (
          <p className="text-sm text-muted-foreground/90 bg-muted/30 p-3 rounded-lg border leading-relaxed">
            {assessment.whySummary}
          </p>
        )}

        {/* Key Required Skills Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {job.requiredSkills.map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs font-normal">
              {skill}
            </Badge>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs gap-1.5"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  {isAr ? "إخفاء التفاصيل والاستراتيجية" : "Collapse Strategy & Proof"}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  {isAr ? "استعراض الاستراتيجية والأدلة" : "View Strategy & Assets"}
                </>
              )}
            </Button>

            {job.sourceUrl && (
              <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {isAr ? "رابط الإعلان" : "Job Link"}
                </a>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncToCRM}
              disabled={isSyncing || synced}
              className="text-xs gap-1.5 bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400"
            >
              {isSyncing ? (
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
              ) : synced ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {synced ? (isAr ? "تم الربط مع CRM" : "Synced to CRM") : (isAr ? "مزامنة إلى Twenty" : "Push to Twenty CRM")}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Strategy, Problem Matching & Asset Panel */}
      {expanded && (
        <div className="border-t bg-muted/10 p-5 md:p-6 space-y-6">
          {/* Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <Button
              variant={activeTab === "overview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("overview")}
              className="text-xs"
            >
              {isAr ? "التقييم خماسي الأبعاد" : "5D Match Breakdown"}
            </Button>
            <Button
              variant={activeTab === "problem" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("problem")}
              className="text-xs gap-1"
            >
              <Hammer className="h-3.5 w-3.5" />
              {isAr ? "تطابق المشكلات والبناء" : "Problem & Builder Fit"}
            </Button>
            <Button
              variant={activeTab === "strategy" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("strategy")}
              className="text-xs gap-1"
            >
              <Target className="h-3.5 w-3.5" />
              {isAr ? "استراتيجية التقديم" : "Application Strategy"}
            </Button>
            <Button
              variant={activeTab === "assets" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("assets")}
              className="text-xs gap-1"
            >
              <FileText className="h-3.5 w-3.5" />
              {isAr ? "المستندات الجاهزة" : "Tailored Assets"}
            </Button>
            <Button
              variant={activeTab === "interview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("interview")}
              className="text-xs gap-1"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {isAr ? "ملف المقابلة (STAR)" : "Interview Dossier"}
            </Button>
          </div>

          {/* TAB 1: 5D Match Breakdown */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground">{isAr ? "التطابق التقني (40%)" : "Technical Match (40%)"}</div>
                  <div className="text-xl font-bold">{assessment?.technicalMatch ?? 0}%</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground">{isAr ? "القدرات والمعمارية (30%)" : "Capability & Scope (30%)"}</div>
                  <div className="text-xl font-bold">{assessment?.capabilityMatch ?? 0}%</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground">{isAr ? "نطاق المنتج (15%)" : "Domain Fit (15%)"}</div>
                  <div className="text-xl font-bold">{assessment?.domainMatch ?? 0}%</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="text-[11px] text-muted-foreground">{isAr ? "واقعية المنصب (15%)" : "Seniority Realism (15%)"}</div>
                  <div className="text-xl font-bold">{assessment?.experienceMatch ?? 0}%</div>
                </div>
              </div>

              {/* Strongest Evidence */}
              {assessment?.strongEvidence && assessment.strongEvidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    {isAr ? "أقوى الأدلة من مستودعات Databayt" : "Verified Proof from Databayt Repositories"}
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground/90 font-mono bg-card p-3 rounded-lg border">
                    {assessment.strongEvidence.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blocker & Gaps */}
              {assessment?.criticalMissing && assessment.criticalMissing.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    {isAr ? "الفجوات الحرجة والمخاطر" : "Critical Blocker Gaps & Prep Risks"}
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground/90 font-mono bg-card p-3 rounded-lg border">
                    {assessment.criticalMissing.map((gap, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold">!</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Problem Matching & Builder Fit */}
          {activeTab === "problem" && problemMatch && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {isAr ? "ما تحاول الشركة بناؤه وحله فعلياً:" : "Underlying Company Problems & Role Core Need:"}
                  </span>
                  <Badge variant="default" className="text-xs bg-amber-600">
                    {isAr ? "ملاءمة البناء:" : "Builder Fit:"} {problemMatch.builderFitScore}%
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{problemMatch.roleCoreNeed}</p>
                <div className="space-y-1">
                  {problemMatch.companyUnderlyingProblems.map((prob, i) => (
                    <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary font-bold">→</span>
                      <span>{prob}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Databayt Proven Solutions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Hammer className="h-4 w-4 text-amber-500" />
                  {isAr ? "حلول هندسية سابقة من Databayt تطابق هذه المشكلة:" : "Relevant Past Solutions Shipped by Candidate:"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {problemMatch.relevantDatabaytSolutions.map((sol) => (
                    <div key={sol.repoId} className="rounded-lg border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-primary">{sol.projectName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          [{sol.repoId}]
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{sol.architecturalSolution}</p>
                      <div className="text-[11px] text-foreground/80 font-mono bg-muted/40 p-2 rounded">
                        {sol.verifiedProofs.map((p, idx) => (
                          <div key={idx}>✓ {p}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Application Strategy & Narrative */}
          {activeTab === "strategy" && strategy && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                    <Target className="h-4 w-4" />
                    {isAr ? "زاوية التموضع والقصة الحقيقية:" : "Positioning Angle & Truthful Narrative:"}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {strategy.strategicCareerValue}
                  </Badge>
                </div>
                <div className="text-sm font-bold text-foreground">{strategy.positioningAngle}</div>
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border">
                  {strategy.truthfulNarrative}
                </p>
              </div>

              {/* Pre-Application Study Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  {isAr ? "خطة التحضير قبل التقديم والمقابلة (1-3 أيام):" : "Pre-Application Study & Prep Checklist:"}
                </h4>
                <div className="space-y-2">
                  {strategy.studyChecklist.map((task, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-foreground block">{task.topic}</span>
                        <span className="text-muted-foreground">{task.whyNeeded}</span>
                      </div>
                      <Badge
                        variant={task.urgency === "critical" ? "destructive" : "secondary"}
                        className="text-[10px] shrink-0"
                      >
                        {task.estimatedHours}h • {task.urgency}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Tailored Assets (Cover Letter, DMs) */}
          {activeTab === "assets" && strategy?.tailoredAssets && (
            <div className="space-y-6">
              {/* Cover Letter */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    {isAr ? "خطاب التقديم المخصص (Evidence-Grounded Cover Letter)" : "Tailored Evidence Cover Letter"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(strategy.tailoredAssets.coverLetter, "cl")}
                    className="text-xs gap-1"
                  >
                    {copiedAsset === "cl" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedAsset === "cl" ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ الخطاب" : "Copy Letter")}
                  </Button>
                </div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-muted/30 p-3.5 rounded-lg border leading-relaxed">
                  {strategy.tailoredAssets.coverLetter}
                </pre>
              </div>

              {/* Recruiter DM */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    {isAr ? "رسالة التواصل المباشر مع المستقطب (Recruiter / Founder DM)" : "Recruiter / Founder LinkedIn DM"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(strategy.tailoredAssets.recruiterDM, "dm")}
                    className="text-xs gap-1"
                  >
                    {copiedAsset === "dm" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedAsset === "dm" ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ الرسالة" : "Copy DM")}
                  </Button>
                </div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-muted/30 p-3.5 rounded-lg border leading-relaxed">
                  {strategy.tailoredAssets.recruiterDM}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: Interview Dossier (STAR) */}
          {activeTab === "interview" && strategy?.interviewDossier && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {isAr ? "بنك قصص المقابلة المعمارية (STAR Stories):" : "Architectural Interview Stories (STAR Method):"}
              </h4>

              <div className="space-y-4">
                {strategy.interviewDossier.map((star, idx) => (
                  <div key={idx} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-primary">{star.questionType}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {star.projectProof}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1 bg-muted/20 p-2.5 rounded border">
                        <strong className="text-foreground block">{isAr ? "السياق والمشكلة:" : "Context & Problem:"}</strong>
                        <p className="text-muted-foreground">{star.problem}</p>
                      </div>
                      <div className="space-y-1 bg-muted/20 p-2.5 rounded border">
                        <strong className="text-foreground block">{isAr ? "القرار والمفاضلة:" : "Decision & Tradeoff:"}</strong>
                        <p className="text-muted-foreground">{star.decision} ({star.tradeoff})</p>
                      </div>
                    </div>
                    <div className="text-xs bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded text-foreground/90">
                      <strong>{isAr ? "النتيجة المثبتة في الإنتاج:" : "Verified Outcome:"}</strong> {star.outcome}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
