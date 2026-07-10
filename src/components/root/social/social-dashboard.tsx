"use client";

import React, { useState, useEffect } from "react";
import { isRTL, type Locale } from "@/components/local/config";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/atom/page-header";
import {
  verifyHermesConnection,
  publishPostDirect,
} from "@/actions/post-social";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import {
  TwitterIcon,
  LinkedinIcon,
  TelegramIcon,
} from "@/components/root/social/icons";
import {
  Send,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Settings,
  Hash,
} from "lucide-react";

interface SocialDashboardProps {
  lang: Locale;
}

// Brand icons where we have them; every other channel renders a letter badge.
const channelIcons: Partial<
  Record<ChannelId, React.ComponentType<{ className?: string }>>
> = {
  slack: Hash,
  x: TwitterIcon,
  linkedin: LinkedinIcon,
  telegram: TelegramIcon,
};

const translations = {
  en: {
    title: "Social Hub",
    description:
      "Stage and publish approved posts to social channels through the Hermes gateway.",
    connectionStatus: "Hermes Gateway Status",
    connected: "Connected",
    disconnected: "Disconnected",
    checking: "Checking connection...",
    testConnection: "Test Connection",
    apiUrl: "Gateway URL",
    notConfigured: "not configured",
    composerTitle: "Post Composer",
    composerDesc:
      "Paste the approved copy, pick the channels, and publish. Hermes relays — it never writes.",
    textareaPlaceholder: "Paste the approved post copy here…",
    targetChannels: "Target Platforms",
    comingSoon: "soon",
    postDirect: "Publish via Hermes",
    posting: "Publishing...",
    draftHintTitle: "Where do drafts come from?",
    draftHintBody:
      "Claude writes the copy — say “social post” in Claude Code (the /social skill) to draft Arabic-first variants per channel, generate media via /higgs, and get it approved. This composer is the last mile only.",
    successMsg: "Successfully posted!",
    errorMsg: "Failed to process: ",
  },
  ar: {
    title: "ملتقى التواصل",
    description:
      "جهّز وانشر المنشورات المعتمدة على قنوات التواصل عبر بوابة Hermes.",
    connectionStatus: "حالة بوابة Hermes",
    connected: "متصل",
    disconnected: "غير متصل",
    checking: "جاري فحص الاتصال...",
    testConnection: "فحص الاتصال",
    apiUrl: "رابط البوابة",
    notConfigured: "غير مُهيّأ",
    composerTitle: "منشئ المنشورات",
    composerDesc:
      "الصق النص المعتمد، اختر القنوات، ثم انشر. Hermes ناقلٌ فقط — لا يكتب.",
    textareaPlaceholder: "الصق نص المنشور المعتمد هنا…",
    targetChannels: "المنصات المستهدفة",
    comingSoon: "قريباً",
    postDirect: "نشر عبر Hermes",
    posting: "جاري النشر...",
    draftHintTitle: "من أين تأتي المسودات؟",
    draftHintBody:
      "Claude يكتب النص — قل «منشور تواصل» في Claude Code (مهارة ‎/social) لصياغة نسخ عربية-أولاً لكل قناة، وتوليد الوسائط عبر ‎/higgs، ثم الاعتماد. هذا المنشئ هو الميل الأخير فقط.",
    successMsg: "تم النشر بنجاح!",
    errorMsg: "فشلت العملية: ",
  },
};

export default function SocialDashboard({ lang }: SocialDashboardProps) {
  const t = translations[lang] || translations.en;
  const isRightToLeft = isRTL(lang);

  // Connection State
  const [connection, setConnection] = useState<{
    status: "idle" | "checking" | "connected" | "disconnected";
    version?: string;
    error?: string;
  }>({ status: "idle" });

  // Composer State
  const [postText, setPostText] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>([
    "slack",
  ]);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const checkConnection = async () => {
    setConnection({ status: "checking" });
    try {
      const res = await verifyHermesConnection();
      if (res.connected) {
        setConnection({ status: "connected", version: res.version });
      } else {
        setConnection({ status: "disconnected", error: res.error });
      }
    } catch (err: unknown) {
      setConnection({
        status: "disconnected",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleChannelToggle = (channel: ChannelId) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel],
    );
  };

  const handlePublishDirect = async () => {
    setIsPosting(true);
    setPostSuccess(null);
    setPostError(null);
    try {
      const res = await publishPostDirect({
        text: postText,
        channels: selectedChannels,
      });
      if (res.ok) {
        setPostSuccess(t.successMsg);
        setPostText("");
      } else {
        setPostError(`${t.errorMsg}${res.error}`);
      }
    } catch (err: unknown) {
      setPostError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-8" dir={isRightToLeft ? "rtl" : "ltr"}>
      <PageHeader heading={t.title} description={t.description} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Columns */}
        <div className="lg:col-span-2 space-y-8">
          {/* Composer */}
          <div className="rounded-xl border border-border bg-card/40 backdrop-blur-md p-6 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-primary">
                  {t.composerTitle}
                </h3>
                <p className="text-sm font-light text-muted-foreground">
                  {t.composerDesc}
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  {t.targetChannels}
                </label>
                <div className="flex flex-wrap gap-3">
                  {CHANNELS.map((ch) => {
                    const isSelected = selectedChannels.includes(ch.id);
                    const Icon = channelIcons[ch.id];
                    const name = isRightToLeft ? ch.labelAr : ch.label;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleChannelToggle(ch.id)}
                        disabled={!ch.wired}
                        title={ch.wired ? name : `${name} — ${t.comingSoon}`}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                          !ch.wired
                            ? "bg-input/10 border-border/50 text-muted-foreground/50 cursor-not-allowed"
                            : isSelected
                              ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30"
                              : "bg-input/20 border-border text-muted-foreground hover:bg-input/40"
                        }`}
                      >
                        {Icon ? (
                          <Icon className="h-4 w-4" />
                        ) : (
                          <span className="h-4 w-4 flex items-center justify-center text-[11px] font-bold uppercase">
                            {ch.id[0]}
                          </span>
                        )}
                        <span>{name}</span>
                        {!ch.wired && (
                          <span className="text-[10px] opacity-70">
                            {t.comingSoon}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder={t.textareaPlaceholder}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-input/10 p-4 text-base focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {postSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-lg text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{postSuccess}</span>
                </div>
              )}

              {postError && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-lg text-sm">
                  <XCircle className="h-4 w-4" />
                  <span>{postError}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handlePublishDirect}
                  disabled={
                    isPosting ||
                    !postText.trim() ||
                    selectedChannels.length === 0 ||
                    connection.status !== "connected"
                  }
                  className="flex items-center gap-2 font-medium"
                >
                  <Send className="h-4 w-4" />
                  <span>{isPosting ? t.posting : t.postDirect}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Drafting hint — the brain lives in Claude, not here */}
          <div className="rounded-xl border border-border bg-card/30 backdrop-blur-md p-6 shadow-md">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-primary">
                  {t.draftHintTitle}
                </h3>
                <p className="text-sm font-light text-muted-foreground mt-1 leading-relaxed">
                  {t.draftHintBody}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Status Column */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card/30 backdrop-blur-md p-6 shadow-md">
            <h4 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>{t.connectionStatus}</span>
            </h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <span className="text-xs text-muted-foreground">
                  {t.apiUrl}
                </span>
                <span className="text-xs font-mono select-all truncate max-w-[180px]">
                  {process.env.NEXT_PUBLIC_HERMES_API_URL || t.notConfigured}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  {connection.status === "checking" && (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-xs text-amber-500 font-medium">
                        {t.checking}
                      </span>
                    </>
                  )}
                  {connection.status === "connected" && (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs text-emerald-500 font-medium">
                        {t.connected}{" "}
                        {connection.version && `v${connection.version}`}
                      </span>
                    </>
                  )}
                  {connection.status === "disconnected" && (
                    <>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      <span className="text-xs text-rose-500 font-medium">
                        {t.disconnected}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {connection.error && (
                <p className="text-xs text-rose-500 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 break-words leading-relaxed">
                  {connection.error}
                </p>
              )}

              <Button
                onClick={checkConnection}
                disabled={connection.status === "checking"}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2 mt-2"
              >
                <RefreshCw
                  className={`h-3 w-3 ${connection.status === "checking" ? "animate-spin" : ""}`}
                />
                <span>{t.testConnection}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
