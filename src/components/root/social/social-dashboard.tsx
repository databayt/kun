"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isRTL, type Locale } from "@/components/local/config";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/atom/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  verifyHermesConnection,
  verifyTelegramConnection,
  verifyFacebookConnection,
  publishPostDirect,
} from "@/actions/post-social";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import {
  PRODUCTS,
  DEFAULT_PRODUCT,
  productChannelWired,
  type ProductId,
} from "@/components/root/social/products";
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

type ConnState = {
  status: "idle" | "checking" | "connected" | "disconnected";
  detail?: string;
  error?: string;
};

const translations = {
  en: {
    title: "Social Hub",
    description:
      "Stage and publish approved posts to social channels through the wired relays.",
    product: "Product",
    selectProduct: "Select a product",
    connectionStatus: "Egress Status",
    hermesRow: "Hermes Gateway",
    telegramRow: "Telegram Bot",
    facebookRow: "Facebook Page",
    connected: "Connected",
    disconnected: "Disconnected",
    checking: "Checking...",
    testConnection: "Test Connections",
    apiUrl: "Gateway URL",
    notConfigured: "not configured",
    composerTitle: "Post Composer",
    composerDesc:
      "Paste the approved copy, pick the channels, and publish. The relays only deliver — they never write.",
    textareaPlaceholder: "Paste the approved post copy here…",
    targetChannels: "Target Platforms",
    comingSoon: "soon",
    postDirect: "Publish",
    posting: "Publishing...",
    draftHintTitle: "Where do drafts come from?",
    draftHintBody:
      "Claude writes the copy — say “social post” in Claude Code (the /social skill) to draft Arabic-first variants per channel, generate media via /higgs, and get it approved. This composer is the last mile only.",
    successMsg: "Successfully posted!",
    errorMsg: "Failed to process: ",
    noChannels: "No channel is wired for this product yet.",
  },
  ar: {
    title: "ملتقى التواصل",
    description:
      "جهّز وانشر المنشورات المعتمدة على قنوات التواصل عبر النواقل الموصولة.",
    product: "المنتج",
    selectProduct: "اختر منتجاً",
    connectionStatus: "حالة النشر",
    hermesRow: "بوابة Hermes",
    telegramRow: "بوت تيليجرام",
    facebookRow: "صفحة فيسبوك",
    connected: "متصل",
    disconnected: "غير متصل",
    checking: "جاري الفحص...",
    testConnection: "فحص الاتصالات",
    apiUrl: "رابط البوابة",
    notConfigured: "غير مُهيّأ",
    composerTitle: "منشئ المنشورات",
    composerDesc:
      "الصق النص المعتمد، اختر القنوات، ثم انشر. النواقل توصّل فقط — لا تكتب.",
    textareaPlaceholder: "الصق نص المنشور المعتمد هنا…",
    targetChannels: "المنصات المستهدفة",
    comingSoon: "قريباً",
    postDirect: "نشر",
    posting: "جاري النشر...",
    draftHintTitle: "من أين تأتي المسودات؟",
    draftHintBody:
      "Claude يكتب النص — قل «منشور تواصل» في Claude Code (مهارة ‎/social) لصياغة نسخ عربية-أولاً لكل قناة، وتوليد الوسائط عبر ‎/higgs، ثم الاعتماد. هذا المنشئ هو الميل الأخير فقط.",
    successMsg: "تم النشر بنجاح!",
    errorMsg: "فشلت العملية: ",
    noChannels: "لا توجد قناة موصولة لهذا المنتج بعد.",
  },
};

function StatusIndicator({
  state,
  t,
}: {
  state: ConnState;
  t: (typeof translations)["en"];
}) {
  if (state.status === "checking" || state.status === "idle") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span className="text-xs text-amber-500 font-medium">{t.checking}</span>
      </div>
    );
  }
  if (state.status === "connected") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs text-emerald-500 font-medium">
          {t.connected} {state.detail && <span dir="ltr">{state.detail}</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      <span className="text-xs text-rose-500 font-medium">
        {t.disconnected}
      </span>
    </div>
  );
}

export default function SocialDashboard({ lang }: SocialDashboardProps) {
  const t = translations[lang] || translations.en;
  const isRightToLeft = isRTL(lang);

  // Which brand we're publishing as. Every channel toggle, health check, and
  // publish call below is scoped to it — Facebook resolves a different Page and
  // a different permanent token per product.
  const [product, setProduct] = useState<ProductId>(DEFAULT_PRODUCT);

  // Egress state — one per transport
  const [hermes, setHermes] = useState<ConnState>({ status: "idle" });
  const [telegram, setTelegram] = useState<ConnState>({ status: "idle" });
  const [facebook, setFacebook] = useState<ConnState>({ status: "idle" });

  // Composer State
  const [postText, setPostText] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  // Publishable for THIS brand: the global transport is wired AND the brand has
  // its own destination on it (its own Page, its own channel).
  const wiredForProduct = useMemo(
    () =>
      CHANNELS.filter((ch) =>
        productChannelWired(product, ch.id, ch.wired),
      ).map((ch) => ch.id as ChannelId),
    [product],
  );

  // Switching brand must never carry a selection the new brand can't publish to.
  useEffect(() => {
    setSelectedChannels((prev) => {
      const kept = prev.filter((id) => wiredForProduct.includes(id));
      return kept.length > 0 ? kept : wiredForProduct.slice(0, 1);
    });
    setPostSuccess(null);
    setPostError(null);
  }, [wiredForProduct]);

  const checkConnections = useCallback(async () => {
    setHermes({ status: "checking" });
    setTelegram({ status: "checking" });
    setFacebook({ status: "checking" });

    const [hermesRes, telegramRes, facebookRes] = await Promise.allSettled([
      verifyHermesConnection(),
      verifyTelegramConnection(),
      verifyFacebookConnection(product),
    ]);

    if (hermesRes.status === "fulfilled" && hermesRes.value.connected) {
      setHermes({
        status: "connected",
        detail: hermesRes.value.version && `v${hermesRes.value.version}`,
      });
    } else {
      setHermes({
        status: "disconnected",
        error:
          hermesRes.status === "fulfilled"
            ? hermesRes.value.error
            : String(hermesRes.reason),
      });
    }

    if (telegramRes.status === "fulfilled" && telegramRes.value.connected) {
      setTelegram({
        status: "connected",
        detail: telegramRes.value.username && `@${telegramRes.value.username}`,
      });
    } else {
      setTelegram({
        status: "disconnected",
        error:
          telegramRes.status === "fulfilled"
            ? telegramRes.value.error
            : String(telegramRes.reason),
      });
    }

    // The Page name is the proof the selected product resolved to the right
    // Page — it's the only pre-publish signal that the token isn't crossed.
    if (facebookRes.status === "fulfilled" && facebookRes.value.connected) {
      setFacebook({ status: "connected", detail: facebookRes.value.name });
    } else {
      setFacebook({
        status: "disconnected",
        error:
          facebookRes.status === "fulfilled"
            ? facebookRes.value.error
            : String(facebookRes.reason),
      });
    }
  }, [product]);

  useEffect(() => {
    checkConnections();
  }, [checkConnections]);

  const handleChannelToggle = (channel: ChannelId) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel],
    );
  };

  // Publish is gated per transport: only the relays the selection actually
  // needs must be connected.
  const transportNeeded = (transport: string) =>
    selectedChannels.some(
      (id) => CHANNELS.find((c) => c.id === id)?.transport === transport,
    );
  const transportsReady =
    (!transportNeeded("hermes") || hermes.status === "connected") &&
    (!transportNeeded("telegram") || telegram.status === "connected") &&
    (!transportNeeded("facebook") || facebook.status === "connected");

  const handlePublishDirect = async () => {
    setIsPosting(true);
    setPostSuccess(null);
    setPostError(null);
    try {
      const res = await publishPostDirect({
        product,
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

  const anyChecking =
    hermes.status === "checking" ||
    telegram.status === "checking" ||
    facebook.status === "checking";

  return (
    <div dir={isRightToLeft ? "rtl" : "ltr"}>
      <PageHeader heading={t.title} description={t.description} />

      {/* Product bar — same rhythm as the homepage tab bar, but a select:
          brands are a single choice, not a filter you flip through. */}
      <div className="border-b-[0.5px] py-3">
        <label htmlFor="product-selector" className="sr-only">
          {t.product}
        </label>
        <Select
          value={product}
          onValueChange={(value) => setProduct(value as ProductId)}
        >
          <SelectTrigger
            id="product-selector"
            className="bg-secondary text-secondary-foreground border-secondary h-8 w-auto justify-start shadow-none"
          >
            <span className="font-medium">{t.product}:</span>
            <SelectValue placeholder={t.selectProduct} />
          </SelectTrigger>
          <SelectContent align={isRightToLeft ? "end" : "start"}>
            {PRODUCTS.map((p) => (
              <SelectItem
                key={p.id}
                value={p.id}
                className="data-[state=checked]:opacity-50"
              >
                {isRightToLeft ? p.labelAr : p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-8">
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
                    const available = productChannelWired(
                      product,
                      ch.id,
                      ch.wired,
                    );
                    const isSelected = selectedChannels.includes(ch.id);
                    const Icon = channelIcons[ch.id];
                    const name = isRightToLeft ? ch.labelAr : ch.label;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleChannelToggle(ch.id)}
                        disabled={!available}
                        title={available ? name : `${name} — ${t.comingSoon}`}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                          !available
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
                        {!available && (
                          <span className="text-[10px] opacity-70">
                            {t.comingSoon}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {wiredForProduct.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {t.noChannels}
                  </p>
                )}
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
                    !transportsReady
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
                <span className="text-xs text-muted-foreground">
                  {t.facebookRow}
                </span>
                <StatusIndicator state={facebook} t={t} />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  {t.hermesRow}
                </span>
                <StatusIndicator state={hermes} t={t} />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  {t.telegramRow}
                </span>
                <StatusIndicator state={telegram} t={t} />
              </div>

              {facebook.error && (
                <p className="text-xs text-rose-500 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 break-words leading-relaxed">
                  {t.facebookRow}: {facebook.error}
                </p>
              )}

              {hermes.error && (
                <p className="text-xs text-rose-500 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 break-words leading-relaxed">
                  {t.hermesRow}: {hermes.error}
                </p>
              )}

              {telegram.error && (
                <p className="text-xs text-rose-500 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 break-words leading-relaxed">
                  {t.telegramRow}: {telegram.error}
                </p>
              )}

              <Button
                onClick={checkConnections}
                disabled={anyChecking}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2 mt-2"
              >
                <RefreshCw
                  className={`h-3 w-3 ${anyChecking ? "animate-spin" : ""}`}
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
