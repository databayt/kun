"use client";

import { useEffect, useState } from "react";
import { getConversionFunnelStatsAction, getWeeklySearchReviewAction } from "@/actions/jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CampaignConversionPerformance,
  CareerConversionFunnel,
  PositioningConversionPerformance,
  SourceQualityPerformance,
  WeeklyJobSearchReview,
} from "@/lib/jobs/types";
import {
  TrendingUp,
  ArrowRight,
  Target,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Send,
  Zap,
} from "lucide-react";

interface ConversionDashboardProps {
  lang: string;
}

export function ConversionDashboard({ lang }: ConversionDashboardProps) {
  const isAr = lang === "ar";
  const [funnel, setFunnel] = useState<CareerConversionFunnel | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignConversionPerformance[]>([]);
  const [positioning, setPositioning] = useState<PositioningConversionPerformance[]>([]);
  const [sources, setSources] = useState<SourceQualityPerformance[]>([]);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyJobSearchReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [stats, review] = await Promise.all([
          getConversionFunnelStatsAction(),
          getWeeklySearchReviewAction(),
        ]);
        setFunnel(stats.funnel);
        setCampaigns(stats.campaigns);
        setPositioning(stats.positioning);
        setSources(stats.sources);
        setWeeklyReview(review);
      } catch (err) {
        console.error("Failed to load conversion stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center space-y-3">
        <Sparkles className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">
          {isAr ? "جارٍ تحليل قمع التحويل وأداء الحملات..." : "Analyzing conversion funnel & campaign learning..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Visual Conversion Funnel */}
      <div className="rounded-xl border bg-card p-6 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {isAr ? "قمع تحويل الفرص الوظيفية (Career Conversion Funnel)" : "Career Conversion Funnel"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "تتبع معدلات التحويل من الاكتشاف وحتى عروض العمل"
                : "Tracking conversion rates from discovery to offers with diagnostic feedback"}
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {isAr ? "الاستجابة الإجمالية:" : "Overall Response Rate:"} {funnel?.responseRate ?? 0}%
          </Badge>
        </div>

        {/* Funnel Pipeline Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "المكتشفة" : "Discovered"}</div>
            <div className="text-2xl font-black">{funnel?.totalDiscovered ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">100%</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "المؤهلة (70%+)" : "Qualified"}</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{funnel?.totalQualified ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{funnel?.qualificationRate ?? 0}%</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "المجهزة" : "Prepared"}</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{funnel?.totalPrepared ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{isAr ? "أصول جاهزة" : "Assets Ready"}</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "المُرسلة" : "Applied"}</div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{funnel?.totalApplied ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{funnel?.applicationRate ?? 0}% {isAr ? "تنفيذ" : "Exec"}</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "الاستجابات" : "Responses"}</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{funnel?.totalResponses ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{funnel?.responseRate ?? 0}% {isAr ? "استجابة" : "Resp"}</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "المقابلات" : "Interviews"}</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{funnel?.totalScreens ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{funnel?.interviewConversionRate ?? 0}%</div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-center">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{isAr ? "عروض العمل" : "Offers"}</div>
            <div className="text-2xl font-black text-emerald-500">{funnel?.totalOffers ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{funnel?.offerRate ?? 0}%</div>
          </div>
        </div>
      </div>

      {/* 2. Weekly Search Review Report */}
      {weeklyReview && (
        <div className="rounded-xl border bg-card p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-md font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              {isAr ? "المراجعة الاستراتيجية الأسبوعية" : "Weekly Job Search Review"}
              <span className="text-xs text-muted-foreground font-normal">
                ({weeklyReview.weekStarting} → {weeklyReview.weekEnding})
              </span>
            </h3>
            <Badge variant="outline" className="text-xs">
              {isAr ? "أعلى حملة تحويلاً:" : "Top Campaign:"} {weeklyReview.topPerformingCampaign}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 bg-muted/20 p-3.5 rounded-lg border">
              <strong className="text-foreground block flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                {isAr ? "التموضع الأعلى استجابة:" : "Top Converting Positioning Angle:"}
              </strong>
              <p className="text-muted-foreground">{weeklyReview.topPerformingPositioning}</p>
            </div>

            <div className="space-y-2 bg-muted/20 p-3.5 rounded-lg border">
              <strong className="text-foreground block flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                {isAr ? "عنق الزجاجة في المهارات:" : "Identified Skill Bottleneck:"}
              </strong>
              <p className="text-muted-foreground">{weeklyReview.keySkillGapBottleneck}</p>
            </div>
          </div>

          {/* Recommended Next-Week Actions */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {isAr ? "التركيز والتوصيات للأسبوع القادم:" : "Recommended Focus for Next Week:"}
            </h4>
            <div className="space-y-1.5 font-sans text-xs">
              {weeklyReview.recommendedNextWeekFocus.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 bg-card p-2.5 rounded border">
                  <span className="text-primary font-bold">→</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Campaign & Positioning Conversion Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Matrix */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            {isAr ? "أداء حملات التوظيف (Campaign Efficiency)" : "Campaign Conversion Matrix"}
          </h3>
          <div className="space-y-2.5">
            {campaigns.map((c) => (
              <div key={c.campaignId} className="rounded-lg border bg-muted/10 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{c.campaignName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {isAr ? "كفاءة:" : "Efficiency:"} {c.efficiencyScore}%
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground pt-1">
                  <div>{isAr ? "فرص مؤهلة:" : "Qualified:"} <strong className="text-foreground">{c.qualified}</strong></div>
                  <div>{isAr ? "معدل الاستجابة:" : "Response Rate:"} <strong className="text-emerald-500">{c.responseRate}%</strong></div>
                  <div>{isAr ? "مقابلات:" : "Interviews:"} <strong className="text-indigo-500">{c.interviews}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Positioning Matrix */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            {isAr ? "أداء التموضع المهني (Positioning Angles)" : "Positioning Angle Performance"}
          </h3>
          <div className="space-y-2.5">
            {positioning.map((p, idx) => (
              <div key={idx} className="rounded-lg border bg-muted/10 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{p.positioningAngle}</span>
                  <span className="text-[11px] text-muted-foreground">{p.applicationsCount} {isAr ? "تقديمات" : "apps"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                  <div>{isAr ? "معدل الاستجابة:" : "Response Rate:"} <strong className="text-emerald-500">{p.responseRate}%</strong></div>
                  <div>{isAr ? "معدل المقابلات:" : "Interview Rate:"} <strong className="text-indigo-500">{p.interviewRate}%</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
