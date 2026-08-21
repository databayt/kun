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
} from "lucide-react";

interface JobCardProps {
  job: FullJobWithAssessment;
  lang: string;
}

export function JobCard({ job, lang }: JobCardProps) {
  const isAr = lang === "ar";
  const [expanded, setExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [synced, setSynced] = useState(Boolean(job.twentyOpportunityId));
  const [status, setStatus] = useState(job.status);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const assessment = job.assessment;
  const overallScore = assessment?.overallScore ?? 0;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 70) return "text-blue-500 bg-blue-500/10 border-blue-500/30";
    if (score >= 50) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-rose-500 bg-rose-500/10 border-rose-500/30";
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
              {synced && (
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                  <Check className="h-3 w-3 me-1" />
                  Twenty CRM
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
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
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <DollarSign className="h-3.5 w-3.5" />
                  {job.salary}
                </span>
              )}
            </div>
          </div>

          {/* Overall Match Gauge Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-end">
                <div className="text-3xl font-black tracking-tight">{overallScore}%</div>
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                  {isAr ? "نسبة التوافق" : "Match Score"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={synced ? "outline" : "default"}
                onClick={handleSyncToCRM}
                disabled={isSyncing}
                className="h-8 text-xs font-medium"
              >
                <Send className="h-3 w-3 me-1" />
                {synced
                  ? isAr
                    ? "في Twenty CRM"
                    : "In Twenty CRM"
                  : isSyncing
                  ? isAr
                    ? "جارٍ الإرسال..."
                    : "Syncing..."
                  : isAr
                  ? "إرسال إلى CRM"
                  : "Push to CRM"}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Required skills tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {job.requiredSkills.map((sk) => (
            <span
              key={sk}
              className="text-xs font-medium bg-muted px-2 py-0.5 rounded border border-border/50 text-foreground/80"
            >
              {sk}
            </span>
          ))}
        </div>

        {/* High-level narrative why */}
        {assessment?.whySummary && (
          <div className="text-sm bg-muted/40 rounded-lg p-3.5 border text-foreground/90 leading-relaxed">
            <p>
              <strong className="text-primary font-semibold">{isAr ? "التقييم المشروح: " : "Assessment: "}</strong>
              {assessment.whySummary}
            </p>
          </div>
        )}

        {/* Expand / Collapse Button */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary flex items-center gap-1 underline underline-offset-2"
              >
                {isAr ? "رابط الإعلان الأصلي" : "Original Job Posting"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span>{isAr ? "تاريخ التحليل:" : "Analyzed:"} {new Date(job.createdAt).toLocaleDateString()}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-xs gap-1 font-medium hover:bg-muted"
          >
            {expanded ? (isAr ? "إخفاء التفاصيل الهندسية" : "Hide Detailed Breakdown") : (isAr ? "عرض الأدلة الكاملة والفجوات" : "View Evidence & Gaps")}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Expanded Deep Evidence Section */}
      {expanded && assessment && (
        <div className="bg-muted/20 border-t p-5 md:p-6 space-y-6 animate-in fade-in-50 duration-200">
          {/* Detailed Score Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-card border p-3">
              <span className="text-xs text-muted-foreground block">{isAr ? "التوافق التقني" : "Technical Stack"}</span>
              <span className="text-lg font-bold text-foreground">{assessment.technicalMatch}%</span>
              <div className="w-full bg-muted h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${assessment.technicalMatch}%` }} />
              </div>
            </div>

            <div className="rounded-lg bg-card border p-3">
              <span className="text-xs text-muted-foreground block">{isAr ? "توافق القدرات والمعمارية" : "Architecture & Scope"}</span>
              <span className="text-lg font-bold text-foreground">{assessment.capabilityMatch}%</span>
              <div className="w-full bg-muted h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${assessment.capabilityMatch}%` }} />
              </div>
            </div>

            <div className="rounded-lg bg-card border p-3">
              <span className="text-xs text-muted-foreground block">{isAr ? "توافق النطاق والمنتج" : "Domain Alignment"}</span>
              <span className="text-lg font-bold text-foreground">{assessment.domainMatch}%</span>
              <div className="w-full bg-muted h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${assessment.domainMatch}%` }} />
              </div>
            </div>

            <div className="rounded-lg bg-card border p-3">
              <span className="text-xs text-muted-foreground block">{isAr ? "واقعية الخبرة" : "Seniority Realism"}</span>
              <span className="text-lg font-bold text-foreground">{assessment.experienceMatch}%</span>
              <div className="w-full bg-muted h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${assessment.experienceMatch}%` }} />
              </div>
            </div>
          </div>

          {/* Strongest Evidence from Repositories */}
          {assessment.strongEvidence.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {isAr ? "أقوى الأدلة المباشرة من مشاريعك لمطابقة هذا المنصب:" : "Strongest Repository Evidence For This Role:"}
              </h4>
              <div className="space-y-1.5">
                {assessment.strongEvidence.map((ev, i) => (
                  <div key={i} className="text-xs bg-emerald-500/5 border border-emerald-500/20 rounded p-2.5 text-foreground leading-relaxed">
                    {ev}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Gaps & Nice-to-Have Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Critical Blocker Gaps */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {isAr ? "الفجوات الحرجة الحقيقية:" : "Critical Blocker Gaps:"}
              </h4>
              {assessment.criticalMissing.length > 0 ? (
                <div className="space-y-1">
                  {assessment.criticalMissing.map((gap, i) => (
                    <div key={i} className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded p-2 border border-rose-500/20">
                      • {gap}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-card p-2 rounded border">
                  {isAr ? "لا توجد فجوات حرجة مانعة في المتطلبات الأساسية." : "No critical blocker skill gaps detected."}
                </p>
              )}
            </div>

            {/* Talking Points for Interviews */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                {isAr ? "نقاط القوة للحديث في المقابلة والتقديم:" : "Evidence-Grounded Talking Points:"}
              </h4>
              <div className="space-y-1">
                {assessment.talkingPoints.map((tp, i) => (
                  <div key={i} className="text-xs bg-primary/5 text-foreground rounded p-2 border border-primary/20 leading-relaxed">
                    • {tp}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
