"use client";

import { EngineeringKnowledgeProfile } from "@/lib/jobs/types";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  Database,
  Layers,
  Sparkles,
  Server,
  Smartphone,
  Cpu,
  CheckCircle2,
  FolderGit2,
  TrendingUp,
  Award,
  Globe,
  FileCode2,
} from "lucide-react";

interface ProfileDossierProps {
  profile: EngineeringKnowledgeProfile;
  lang: string;
}

export function ProfileDossier({ profile, lang }: ProfileDossierProps) {
  const isAr = lang === "ar";

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                {isAr ? "ملف الأدلة الموثق (3 طبقات)" : `Verified Evidence Profile (${profile.analyzerVersion || "v2.0"})`}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {isAr ? "محدث:" : "Updated:"} {new Date(profile.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{profile.candidateName}</h2>
            <p className="text-muted-foreground mt-1 font-medium">{profile.headline}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.positioningRoles?.map((pos) => (
              <Badge key={pos.title} variant="secondary" className="text-xs font-normal">
                {pos.title} ({pos.readinessScore}%)
              </Badge>
            ))}
          </div>
        </div>

        {/* Quick Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.repositories.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "مستودعات مسجلة" : "Repositories Tracked"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.capabilities.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "قدرات مثبتة (طبقة B)" : "Inferred Capabilities"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.facts?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "حقائق كود مباشرة (طبقة A)" : "Observable Facts"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.positioningRoles?.length || 5}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "تموضعات سوقية (طبقة C)" : "Market Positions"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layer C: Market Positioning Driven by Evidence */}
      {profile.positioningRoles && profile.positioningRoles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            {isAr ? "الطبقة ج: التموضع المهني في سوق العمل (Market Positioning)" : "Layer C: Evidence-Driven Market Positioning"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.positioningRoles.map((role) => (
              <div key={role.title} className="rounded-xl border bg-card p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-sm text-foreground">{role.title}</h4>
                    <Badge variant="default" className="text-xs font-semibold bg-emerald-600">
                      {role.readinessScore}% {isAr ? "جاهزية" : "Fit"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{role.justification}</p>
                </div>
                <div className="pt-2 border-t text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-foreground">{isAr ? "أقوى المشاريع:" : "Key Projects:"}</span>
                  {role.strongestProjectProofs.map((p) => (
                    <span key={p} className="bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layer B: Core Proven Capabilities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {isAr ? "الطبقة ب: القدرات الهندسية والمعمارية (Capability Inferences)" : "Layer B: Inferred Architectural Capabilities"}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.capabilities.map((cap) => (
            <div
              key={cap.id}
              className="rounded-xl border bg-card p-5 space-y-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-base">{cap.name}</h4>
                  <Badge
                    variant={cap.level === "Expert" ? "default" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {cap.level}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
                {cap.reasoning && (
                  <p className="text-xs text-primary/90 bg-primary/5 p-2 rounded mt-2 border border-primary/10">
                    <strong>{isAr ? "الأساس المنطقي:" : "Reasoning:"}</strong> {cap.reasoning}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {isAr ? "الحقائق والشواهد الداعمة (Layer A Facts):" : "Supporting Observable Facts:"}
                </span>
                <div className="space-y-1.5">
                  {cap.facts.map((ev, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-muted/50 rounded p-2 flex items-start gap-2 text-foreground/90 font-mono"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-primary">[{ev.repositoryId}:{ev.artifactPath}]</span> {ev.claim}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verified Production Tech Stack */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          {isAr ? "التقنيات المستخدمة في الإنتاج" : "Verified Production Technologies"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profile.technologies.map((tech) => (
            <div key={tech.name} className="rounded-lg border bg-card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{tech.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {tech.category}
                </Badge>
              </div>
              <Badge variant="secondary" className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                {tech.level}
              </Badge>
              <div className="text-xs text-muted-foreground pt-1 space-y-1">
                {tech.facts.slice(0, 2).map((e, idx) => (
                  <p key={idx} className="line-clamp-2">
                    <strong className="text-foreground">[{e.repositoryId}]</strong> {e.claim}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Source Repositories Registry */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-blue-500" />
          {isAr ? "سجل المستودعات متعدد المصادر (Local & GitHub)" : "Multi-Source Repository Registry"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {profile.repositories.map((repo) => {
            const hasLocal = repo.sources.some((s) => s.type === "local" && s.isAvailable);
            return (
              <div key={repo.id} className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-primary">{repo.name}</span>
                  <div className="flex items-center gap-1">
                    {hasLocal ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        Local + Git
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                        GitHub Remote
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{repo.description}</p>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {repo.canonicalUrl}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
