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
                {isAr ? "ملف الأدلة الموثق" : "Verified Evidence Profile"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {isAr ? "محدث:" : "Updated:"} {new Date(profile.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{profile.candidateName}</h2>
            <p className="text-muted-foreground mt-1 font-medium">{profile.headline}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.targetRoles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs font-normal">
                {role}
              </Badge>
            ))}
          </div>
        </div>

        {/* Quick Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.repositories.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "مستودعات نشطة" : "Active Repositories"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.capabilities.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "قدرات معمارية مثبتة" : "Proven Capabilities"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.technologies.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "تقنيات تم بناؤها فعلياً" : "Verified Technologies"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Core Proven Capabilities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {isAr ? "القدرات الهندسية المثبتة بالأدلة" : "Proven Engineering Capabilities"}
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
              </div>

              <div className="pt-3 border-t space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {isAr ? "شواهد الكود الحقيقية:" : "Verified Evidence:"}
                </span>
                <div className="space-y-1.5">
                  {cap.evidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-muted/50 rounded p-2 flex items-start gap-2 text-foreground/90 font-mono"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-primary">[{ev.repo}]</span> {ev.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verified Technologies */}
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
              <div className="text-xs text-muted-foreground pt-1">
                {tech.evidence.map((e, idx) => (
                  <p key={idx} className="line-clamp-2">
                    <strong className="text-foreground">[{e.repo}]</strong> {e.summary}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Repositories Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-blue-500" />
          {isAr ? "المستودعات المحلية الممسوحة" : "Scanned Local Repositories"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {profile.repositories.map((repo) => (
            <div key={repo.id} className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-primary">{repo.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {repo.evidenceCount} {isAr ? "أدلة" : "proofs"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate" title={repo.localPath}>
                {repo.localPath}
              </p>
              <div className="flex flex-wrap gap-1">
                {repo.stack.map((st) => (
                  <span
                    key={st}
                    className="text-[10px] bg-background border rounded px-1.5 py-0.5 text-muted-foreground"
                  >
                    {st}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
