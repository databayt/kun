"use client";

// The Media Studio — prompt area on /social/media matching the exact geometry
// and feel of DraftAgent on /social/draft. Lets contributors direct 4K master
// image plates, 9:16 Seedance 2.5 / Veo 3.1 video reels, and HTML carousel cards
// across all brands, with 5-beat prompt compilation, copy-to-clipboard, and
// direct filing to the brief queue or social composer.

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Clapperboard,
  Copy,
  FileImage,
  LayoutTemplate,
  Loader2,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import AgentHeading from "@/components/atom/agent-heading";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/atom/prompt-input";
import { Button } from "@/components/ui/button";
import { fileMediaBrief } from "@/actions/post-social";
import { fill } from "@/components/root/social/dictionary";
import { PRODUCTS } from "@/components/root/social/products";
import { useSocial } from "@/components/root/social/provider";
import {
  compileMediaStudioPrompt,
  getBrandSpines,
  type MediaStudioKind,
  type MediaStudioOutput,
  type MediaStudioRatio,
} from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

const KNOB_TRIGGER =
  "border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent";

function RatioWireframe({
  ratio,
  className,
}: {
  ratio: string;
  className?: string;
}) {
  switch (ratio) {
    case "9:16":
      return (
        <span
          className={cn(
            "inline-flex h-3.5 w-2 items-center justify-center rounded-[2px] border-[1.5px] border-current shrink-0",
            className,
          )}
        />
      );
    case "1:1":
      return (
        <span
          className={cn(
            "inline-flex h-3 w-3 items-center justify-center rounded-[2px] border-[1.5px] border-current shrink-0",
            className,
          )}
        />
      );
    case "16:9":
      return (
        <span
          className={cn(
            "inline-flex h-2 w-3.5 items-center justify-center rounded-[2px] border-[1.5px] border-current shrink-0",
            className,
          )}
        />
      );
    case "4:5":
      return (
        <span
          className={cn(
            "inline-flex h-3.5 w-2.5 items-center justify-center rounded-[2px] border-[1.5px] border-current shrink-0",
            className,
          )}
        />
      );
    default:
      return (
        <span
          className={cn(
            "inline-flex h-3 w-3 items-center justify-center rounded-[2px] border-[1.5px] border-current shrink-0",
            className,
          )}
        />
      );
  }
}

const RATIO_OPTIONS: {
  id: MediaStudioRatio;
  label: string;
  sub: string;
  platforms: string;
}[] = [
  {
    id: "9:16",
    label: "9:16 Vertical",
    sub: "1080×1920",
    platforms: "Reels · TikTok · Stories",
  },
  {
    id: "1:1",
    label: "1:1 Square",
    sub: "1080×1080",
    platforms: "Feed · Carousels · Grid",
  },
  {
    id: "16:9",
    label: "16:9 Landscape",
    sub: "1920×1080",
    platforms: "YouTube · Web · Widescreen",
  },
  {
    id: "4:5",
    label: "4:5 Portrait",
    sub: "1080×1350",
    platforms: "Instagram Portrait Feed",
  },
];

export function MediaStudio() {
  const { isRTL, t, product: globalProduct } = useSocial();

  // Active brand is driven by the global product in the page nav tabs
  const brand = globalProduct || "mkan";
  const [kind, setKind] = useState<MediaStudioKind>("video");
  const [ratio, setRatio] = useState<MediaStudioRatio>("9:16");
  const [spine, setSpine] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [compiled, setCompiled] = useState<MediaStudioOutput | null>(null);
  const [copied, setCopied] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);
  const [filingError, setFilingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Spines available for this brand
  const spines = useMemo(() => getBrandSpines(brand), [brand]);
  const activeSpine = spine || spines[0]?.id || "cinematic";

  // Brand-reactive quick starter suggestions
  const presets = useMemo(() => {
    if (brand === "mkan") {
      return [
        { label: t.mediaPresetMadePossible, text: "A Sudanese family enjoying mint tea on a breezy sunlit coastal balcony overlooking the Red Sea in Port Sudan at golden hour." },
        { label: t.mediaPresetCoastalBalcony, text: "A modern coastal apartment living room in Port Sudan, white linen curtains drifting in the sea breeze, calm Red Sea waves visible outside." },
        { label: t.mediaPresetBreezyFlat, text: "Spacious 2-bedroom family flat in Hayy Al-Shati, Port Sudan with split AC, clean tiled floors, and standby power comfort." },
      ];
    }
    if (brand === "hogwarts") {
      return [
        { label: t.mediaPresetLibraryStudy, text: "A dedicated student studying with a laptop in a tranquil, naturally lit library courtyard." },
        { label: t.mediaPresetDeskMockup, text: "A clean minimalist bursar's desk with an elegant school management tablet interface." },
      ];
    }
    return [
      { label: "Documentary scene", text: `A natural documentary scene capturing authentic daily life for ${brand}.` },
      { label: "Product highlight", text: `Clean architectural plate with generous negative space and brand palette for ${brand}.` },
    ];
  }, [brand, t]);

  const handleCompile = (customSubject?: string) => {
    const textToCompile = (customSubject ?? subject).trim();
    if (!textToCompile) return;
    setFiledId(null);
    setFilingError(null);
    const res = compileMediaStudioPrompt({
      brand,
      kind,
      subject: textToCompile,
      ratio,
      spine: activeSpine,
    });
    setCompiled(res);
  };

  const handleCopy = () => {
    if (!compiled) return;
    navigator.clipboard.writeText(compiled.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileQueue = () => {
    if (!compiled) return;
    setFilingError(null);
    startTransition(async () => {
      const res = await fileMediaBrief({
        brand,
        assetType: kind === "video" ? "reel" : "hero",
        subject: compiled.beats.scene,
      });
      if (res.ok && res.brief) {
        setFiledId(res.brief.id);
      } else {
        setFilingError(res.error || "Could not file to queue.");
      }
    });
  };

  const brandLabel =
    (isRTL
      ? PRODUCTS.find((p) => p.id === brand)?.labelAr
      : PRODUCTS.find((p) => p.id === brand)?.label) || brand;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Studio Header */}
      <AgentHeading
        title={t.mediaStudioTitle}
        lead={t.mediaStudioLead}
        scrollTarget="showroom-gallery"
        scrollText={t.mediaStudioScroll}
        className="text-center"
      />

      {/* Quick Suggestion Chips */}
      {!compiled && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSubject(p.text);
                handleCompile(p.text);
              }}
              className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Prompt Box */}
      <div className="relative w-full">
        <PromptInput
          onSubmit={() => handleCompile()}
          className="group border-muted-foreground/10 bg-muted focus-within:border-foreground/20 hover:border-foreground/10 focus-within:hover:border-foreground/20 flex w-full flex-col gap-2 rounded-[2rem] border p-3 text-base shadow-sm transition-all duration-300 ease-in-out"
        >
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>

          <PromptInputTextarea
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              compiled
                ? t.mediaStudioPlaceholderMore
                : fill(t.mediaStudioPlaceholder, { brand: brandLabel })
            }
            className="placeholder:text-muted-foreground max-h-[180px] min-h-16 w-full resize-none bg-transparent !px-1 py-1 text-[15px] leading-snug focus:bg-transparent"
          />

          {/* Bottom Toolbar & Knobs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Plus Menu / Attachment */}
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger className="border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded-full border p-0 text-sm font-medium transition-colors">
                  <Plus className="size-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments label={t.agentAttachItem} />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              {/* Media Lane Knob */}
              <PromptInputModelSelect value={kind} onValueChange={(val) => { setKind(val as MediaStudioKind); if (compiled) handleCompile(); }}>
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  {kind === "video" && <Clapperboard className="size-3.5 text-primary" />}
                  {kind === "image" && <FileImage className="size-3.5 text-primary" />}
                  {kind === "template" && <LayoutTemplate className="size-3.5 text-primary" />}
                  <PromptInputModelSelectValue placeholder={t.mediaLaneLabel} />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  <PromptInputModelSelectItem value="video">
                    <span className="flex items-center gap-2">
                      <Clapperboard className="size-4 text-primary" />
                      {t.mediaLaneVideo}
                    </span>
                  </PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="image">
                    <span className="flex items-center gap-2">
                      <FileImage className="size-4 text-primary" />
                      {t.mediaLaneImage}
                    </span>
                  </PromptInputModelSelectItem>
                  <PromptInputModelSelectItem value="template">
                    <span className="flex items-center gap-2">
                      <LayoutTemplate className="size-4 text-primary" />
                      {t.mediaLaneTemplate}
                    </span>
                  </PromptInputModelSelectItem>
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* Ratio Knob — Higgsfield Marketing Studio inspired */}
              <PromptInputModelSelect
                value={ratio}
                onValueChange={(val) => {
                  setRatio(val as MediaStudioRatio);
                  if (compiled) handleCompile();
                }}
              >
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  <div className="flex items-center gap-1.5">
                    <RatioWireframe ratio={ratio} className="text-primary" />
                    <span className="font-mono text-xs">{ratio}</span>
                  </div>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent
                  align={isRTL ? "end" : "start"}
                  className="w-56 p-1.5 space-y-1"
                >
                  {RATIO_OPTIONS.map((opt) => (
                    <PromptInputModelSelectItem
                      key={opt.id}
                      value={opt.id}
                      className="flex items-start gap-2.5 py-1.5 cursor-pointer"
                    >
                      <div className="flex h-5 w-5 items-center justify-center pt-0.5">
                        <RatioWireframe ratio={opt.id} className="text-foreground/80" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-foreground">
                            {opt.label}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {opt.sub}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/80 leading-tight">
                          {opt.platforms}
                        </span>
                      </div>
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* Style Spine Knob */}
              {spines.length > 0 && (
                <PromptInputModelSelect value={activeSpine} onValueChange={(val) => { setSpine(val); if (compiled) handleCompile(); }}>
                  <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                    <PromptInputModelSelectValue placeholder={t.mediaSpineLabel} />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {spines.map((s) => (
                      <PromptInputModelSelectItem key={s.id} value={s.id}>
                        {s.use || s.id}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              )}
            </div>

            {/* Submit Button */}
            <PromptInputSubmit
              disabled={!subject.trim()}
              status="ready"
              className="h-8 w-8 rounded-full"
              aria-label={isRTL ? "تجميع الأمر" : "Compile prompt"}
            >
              <Send className="size-4" />
            </PromptInputSubmit>
          </div>
        </PromptInput>
      </div>

      {/* Compiled Studio Response Card */}
      {compiled && (
        <div className="bg-card text-card-foreground border-border/80 relative space-y-4 rounded-2xl border p-5 shadow-sm">
          {/* Header pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase">
                {compiled.lane} · {compiled.ratio}
              </span>
              <h4 className="text-sm font-medium">{compiled.title}</h4>
            </div>
            <div className="flex items-center gap-1.5">
              {compiled.paletteHexes.map((hex) => (
                <span
                  key={hex}
                  title={hex}
                  style={{ backgroundColor: hex }}
                  className="size-3.5 rounded-full border border-black/10 shadow-xs"
                />
              ))}
            </div>
          </div>

          {/* 5-Beat Breakdown */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Scene & Subject
              </p>
              <p className="text-muted-foreground">{compiled.beats.scene}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80 flex items-center gap-1.5">
                <Clapperboard className="size-3.5 text-primary" /> Camera & Motion
              </p>
              <p className="text-muted-foreground">{compiled.beats.cameraMotion}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80">💡 Lighting & Atmosphere</p>
              <p className="text-muted-foreground">{compiled.beats.lightingAtmosphere}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80">🔊 Audio Directives</p>
              <p className="text-muted-foreground">{compiled.beats.soundFoley || "Natural room tone"}</p>
            </div>
          </div>

          {/* Raw Compiled Prompt Code Block */}
          <div className="bg-muted relative rounded-xl p-3.5 font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {compiled.prompt}
          </div>

          {/* Feedback message for queue filing */}
          {filedId && (
            <p className="text-primary text-xs flex items-center gap-1.5">
              <Check className="size-4" /> {t.mediaFiledQueue} (ID: {filedId.slice(0, 8)}…)
            </p>
          )}
          {filingError && (
            <p className="text-destructive text-xs">{filingError}</p>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={copied ? "default" : "outline"}
                onClick={handleCopy}
                className="h-8 rounded-full text-xs"
              >
                {copied ? <Check className="size-3.5 me-1.5" /> : <Copy className="size-3.5 me-1.5" />}
                {copied ? t.mediaCopiedPrompt : t.mediaCopyPrompt}
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isPending || Boolean(filedId)}
                onClick={handleFileQueue}
                className="h-8 rounded-full text-xs"
              >
                {isPending && <Loader2 className="size-3.5 me-1.5 animate-spin" />}
                {isPending ? t.mediaFilingQueue : filedId ? t.mediaFiledQueue : t.mediaFileQueue}
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCompiled(null);
                setSubject("");
              }}
              className="h-8 text-xs"
            >
              {t.mediaStartNew}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
