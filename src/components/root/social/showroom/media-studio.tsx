"use client";

// The Media Studio — prompt area on /social/media matching the exact geometry
// and feel of DraftAgent on /social/draft. Simplified single-concept dropdowns
// without icons or descriptions, direct reference loading, real-time live
// card previews, and cross-stage bridge to /social/draft.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  Plus,
  Quote,
  Send,
  Sparkles,
  Video as VideoIcon,
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

export interface AssetFormatOption {
  id: string;
  label: string;
  labelAr: string;
  kind: MediaStudioKind;
  defaultRatio: MediaStudioRatio;
}

const ASSET_FORMATS: AssetFormatOption[] = [
  { id: "walkthrough", label: "Walkthrough", labelAr: "جولة", kind: "video", defaultRatio: "9:16" },
  { id: "post", label: "Post", labelAr: "منشور", kind: "image", defaultRatio: "4:5" },
  { id: "lifestyle", label: "Lifestyle", labelAr: "حياة", kind: "image", defaultRatio: "4:5" },
  { id: "ad", label: "Ad", labelAr: "إعلان", kind: "image", defaultRatio: "16:9" },
  { id: "infographic", label: "Infographic", labelAr: "إنفوجرافيك", kind: "template", defaultRatio: "1:1" },
  { id: "carousel", label: "Carousel", labelAr: "كاروسيل", kind: "template", defaultRatio: "4:5" },
  { id: "testimonial", label: "Testimonial", labelAr: "شهادة", kind: "template", defaultRatio: "1:1" },
  { id: "mockup", label: "Mockup", labelAr: "نموذج", kind: "image", defaultRatio: "1:1" },
];

const RATIO_OPTIONS: { id: MediaStudioRatio; label: string }[] = [
  { id: "9:16", label: "9:16" },
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "4:5", label: "4:5" },
];

const MODELS_BY_KIND: Record<
  MediaStudioKind,
  { id: string; label: string }[]
> = {
  video: [
    { id: "seedance", label: "Seedance 2.5" },
    { id: "veo", label: "Veo 3.1" },
    { id: "kling", label: "Kling 3.0" },
  ],
  image: [
    { id: "gemini", label: "Gemini 3.1" },
    { id: "gpt_image", label: "GPT Image 2" },
  ],
  template: [
    { id: "canvas", label: "HTML Canvas" },
  ],
};

export function MediaStudio() {
  const { isRTL, t, product: globalProduct, goToStage } = useSocial();

  // Active brand is driven by the global product in the page nav tabs
  const brand = globalProduct || "mkan";
  const [mode, setMode] = useState<"image" | "video">("image");
  const [formatId, setFormatId] = useState<string>("post");
  const currentFormat =
    ASSET_FORMATS.find((f) => f.id === formatId) || ASSET_FORMATS[0];

  const [kind, setKind] = useState<MediaStudioKind>("image");
  const [model, setModel] = useState<string>("gemini");
  const [ratio, setRatio] = useState<MediaStudioRatio>("4:5");
  const [spine, setSpine] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [compiled, setCompiled] = useState<MediaStudioOutput | null>(null);
  const [copied, setCopied] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);
  const [filingError, setFilingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableFormats = useMemo(() => {
    return ASSET_FORMATS.filter((f) =>
      mode === "video" ? f.kind === "video" : f.kind !== "video",
    );
  }, [mode]);

  const activeModelOptions = useMemo(
    () => MODELS_BY_KIND[kind] || MODELS_BY_KIND.video,
    [kind],
  );

  // Spines available for this brand
  const spines = useMemo(() => getBrandSpines(brand), [brand]);
  const activeSpine = spine || spines[0]?.id || "cinematic";

  // Handle toggling between Image and Video mode
  const handleModeToggle = (nextMode: "image" | "video") => {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (nextMode === "video") {
      setFormatId("walkthrough");
      setKind("video");
      setRatio("9:16");
      setModel("seedance");
    } else {
      setFormatId("post");
      setKind("image");
      setRatio("4:5");
      setModel("gemini");
    }
    if (compiled) setCompiled(null);
  };

  // When format changes, update kind, default ratio, and default model
  const handleFormatChange = (newFormatId: string) => {
    setFormatId(newFormatId);
    const targetFormat = ASSET_FORMATS.find((f) => f.id === newFormatId);
    if (targetFormat) {
      setKind(targetFormat.kind);
      setRatio(targetFormat.defaultRatio);
      setModel(MODELS_BY_KIND[targetFormat.kind]?.[0]?.id || "default");
    }
    if (compiled) setCompiled(null);
  };

  // Listen for reference card clicks from the showroom gallery
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{
        title: string;
        note?: string;
        type?: string;
        brand?: string;
      }>;
      if (custom.detail) {
        const { title, note, type } = custom.detail;
        const textToLoad = note || title;
        setSubject(textToLoad);
        if (type) {
          const matchingFmt = ASSET_FORMATS.find(
            (f) => f.id === type || f.kind === type,
          );
          if (matchingFmt) {
            setFormatId(matchingFmt.id);
            setKind(matchingFmt.kind);
            setRatio(matchingFmt.defaultRatio);
          }
        }
        handleCompile(textToLoad);
      }
    };

    window.addEventListener("media-studio:load-reference", handler);
    return () =>
      window.removeEventListener("media-studio:load-reference", handler);
  }, []);

  // Brand and format-reactive starter suggestions
  const presets = useMemo(() => {
    if (brand === "mkan") {
      switch (formatId) {
        case "walkthrough":
          return [
            { label: "Balcony Tour", text: "A smooth 35mm handheld tour gliding from a sunlit coastal living room to a breezy balcony overlooking the Red Sea in Port Sudan." },
            { label: "Sunset Veranda", text: "Walkthrough gliding through an open kitchen into a private sunset veranda in Hayy Al-Shati." },
          ];
        case "post":
          return [
            { label: "Master Bedroom", text: "A bright, airy master bedroom with clean white linens, wooden side tables, and gentle morning sunlight in Hayy Al-Shati, Port Sudan." },
            { label: "Coastal Living Room", text: "Living room with large windows, split AC, and clean tiled floors overlooking the Red Sea coastline." },
          ];
        case "lifestyle":
          return [
            { label: "Afternoon Tea", text: "A Sudanese family enjoying mint tea on a breezy seaside veranda in Port Sudan during golden hour." },
            { label: "Welcoming Host", text: "A warm local host greeting arriving travelers with authentic Red Sea hospitality." },
          ];
        case "ad":
          return [
            { label: "Weekend Rental", text: "High-impact promotional plate for luxury Port Sudan seaside apartments with 24/7 standby power and split AC." },
            { label: "Host Onboarding", text: "Earn from your coastal property in Port Sudan by listing on Mkan with verified guest bookings." },
          ];
        case "infographic":
          return [
            { label: "Amenities List", text: "24/7 solar & generator backup power, high-speed Wi-Fi, split AC in every room, 5 mins from Red Sea beach." },
            { label: "Pricing Breakdown", text: "Clear nightly rental pricing with zero hidden fees in Hayy Al-Shati, Port Sudan." },
          ];
        case "carousel":
          return [
            { label: "Neighborhood Guide", text: "Why families and business travelers choose Hayy Al-Shati in Port Sudan." },
            { label: "5 Steps to Book", text: "From browsing coastal homes to secure check-in with verified Port Sudan hosts." },
          ];
        case "testimonial":
          return [
            { label: "Superhost Review", text: "Superhost Fatima: 'Hosting on Mkan transformed our rental property in Port Sudan into a steady business.'" },
          ];
        case "mockup":
          return [
            { label: "App Search", text: "Traveler holding a smartphone searching Port Sudan rental homes on Mkan with the Red Sea in the soft background." },
          ];
        default:
          return [
            { label: t.mediaPresetMadePossible, text: "A Sudanese family enjoying mint tea on a breezy sunlit coastal balcony overlooking the Red Sea in Port Sudan at golden hour." },
          ];
      }
    }

    if (brand === "hogwarts") {
      switch (formatId) {
        case "walkthrough":
          return [
            { label: "Library Walkthrough", text: "Cinematic camera glide across a sunlit modern school library courtyard as students collaborate on laptops." },
            { label: "Attendance Demo", text: "Teacher taking digital attendance in seconds on a tablet in an active classroom." },
          ];
        case "post":
          return [
            { label: "Teacher Desk", text: "A clean minimalist teacher's desk with a tablet displaying the Hogwarts live student gradebook." },
            { label: "Bursar Office", text: "An elegant administrative office with laptops running fee reconciliation dashboards." },
          ];
        case "lifestyle":
          return [
            { label: "Student Study", text: "A dedicated high school student researching in a tranquil modern library setting with natural morning light." },
            { label: "Classroom Group", text: "Students enthusiastically raising hands in a bright, modern classroom." },
          ];
        case "ad":
          return [
            { label: "Admission Campaign", text: "Modernize your entire school management in minutes with zero paperwork this admission term." },
            { label: "Billing Promo", text: "Automate fee tracking and parent WhatsApp invoices with Hogwarts SIS." },
          ];
        case "infographic":
          return [
            { label: "School Metrics", text: "98% on-time fee collection, 100% automated student progress cards, and instant SMS parent notices." },
          ];
        case "carousel":
          return [
            { label: "5 Reasons to Switch", text: "Why modern private schools migrate away from legacy spreadsheets to Hogwarts SIS." },
          ];
        case "testimonial":
          return [
            { label: "Headmaster Quote", text: "Headmaster Dr. Tariq: 'We cut our end-of-term reporting from three weeks down to two hours.'" },
          ];
        case "mockup":
          return [
            { label: "Tablet Dashboard", text: "Clean bursar's office desk with a tablet displaying the real-time school financial collection dashboard." },
          ];
        default:
          return [
            { label: t.mediaPresetLibraryStudy, text: "A dedicated student studying with a laptop in a tranquil, naturally lit library courtyard." },
          ];
      }
    }

    return [
      { label: "Product highlight", text: `Clean architectural plate with generous negative space and brand palette for ${brand}.` },
      { label: "Documentary scene", text: `A natural documentary scene capturing authentic daily life for ${brand}.` },
    ];
  }, [brand, formatId, t]);

  const handleCompile = (customSubject?: string) => {
    const textToCompile = (customSubject ?? subject).trim();
    if (!textToCompile) return;
    setFiledId(null);
    setFilingError(null);
    const res = compileMediaStudioPrompt({
      brand,
      kind,
      format: formatId,
      subject: textToCompile,
      ratio,
      spine: activeSpine,
      model,
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
    <div id="media-studio-root" className="mx-auto w-full max-w-4xl space-y-6">
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
              className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer"
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

              {/* Image / Video Icon Segmented Toggle */}
              <div className="border-input bg-muted inline-flex h-8 items-center rounded-full p-0.5 border">
                <button
                  type="button"
                  onClick={() => handleModeToggle("image")}
                  aria-label={isRTL ? "صورة" : "Image"}
                  title={isRTL ? "صورة" : "Image"}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-full transition-colors cursor-pointer",
                    mode === "image"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ImageIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleModeToggle("video")}
                  aria-label={isRTL ? "فيديو" : "Video"}
                  title={isRTL ? "فيديو" : "Video"}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded-full transition-colors cursor-pointer",
                    mode === "video"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <VideoIcon className="size-3.5" />
                </button>
              </div>

              {/* 1. Format Selector — Clean single title, no icons */}
              <PromptInputModelSelect
                value={formatId}
                onValueChange={(val) => handleFormatChange(val)}
              >
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  <span className="font-medium text-xs">
                    {isRTL ? currentFormat.labelAr : currentFormat.label}
                  </span>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent align={isRTL ? "end" : "start"}>
                  {availableFormats.map((fmt) => (
                    <PromptInputModelSelectItem
                      key={fmt.id}
                      value={fmt.id}
                      className="cursor-pointer"
                    >
                      {isRTL ? fmt.labelAr : fmt.label}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* 2. Model Selector — Clean title */}
              <PromptInputModelSelect
                value={model}
                onValueChange={(val) => {
                  setModel(val);
                  if (compiled) handleCompile();
                }}
              >
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  <span className="font-medium text-xs">
                    {activeModelOptions.find((m) => m.id === model)?.label ||
                      activeModelOptions[0]?.label}
                  </span>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent align={isRTL ? "end" : "start"}>
                  {activeModelOptions.map((m) => (
                    <PromptInputModelSelectItem
                      key={m.id}
                      value={m.id}
                      className="cursor-pointer"
                    >
                      {m.label}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* 3. Aspect Ratio Selector — Clean title */}
              <PromptInputModelSelect
                value={ratio}
                onValueChange={(val) => {
                  setRatio(val as MediaStudioRatio);
                  if (compiled) handleCompile();
                }}
              >
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  <span className="font-mono text-xs">{ratio}</span>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent align={isRTL ? "end" : "start"}>
                  {RATIO_OPTIONS.map((opt) => (
                    <PromptInputModelSelectItem
                      key={opt.id}
                      value={opt.id}
                      className="cursor-pointer font-mono text-xs"
                    >
                      {opt.label}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* 4. Style Spine Selector */}
              {spines.length > 0 && (
                <PromptInputModelSelect
                  value={activeSpine}
                  onValueChange={(val) => {
                    setSpine(val);
                    if (compiled) handleCompile();
                  }}
                >
                  <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                    <PromptInputModelSelectValue placeholder={t.mediaSpineLabel} />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent align={isRTL ? "end" : "start"}>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase">
                {compiled.format || compiled.lane} · {compiled.ratio}
              </span>
              {compiled.model && (
                <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {MODELS_BY_KIND[compiled.lane]?.find((m) => m.id === compiled.model)?.label || compiled.model}
                </span>
              )}
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

          {/* Live Visual Card Preview for deterministic and card templates */}
          <VisualCardPreview compiled={compiled} isRTL={isRTL} brand={brand} />

          {/* 5-Beat Breakdown */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Scene & Subject
              </p>
              <p className="text-muted-foreground">{compiled.beats.scene}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80">Camera & Framing</p>
              <p className="text-muted-foreground">{compiled.beats.cameraMotion}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80">💡 Lighting & Atmosphere</p>
              <p className="text-muted-foreground">{compiled.beats.lightingAtmosphere}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-foreground/80">🔊 Audio / Directives</p>
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
                className="h-8 rounded-full text-xs cursor-pointer"
              >
                {copied ? <Check className="size-3.5 me-1.5" /> : <Copy className="size-3.5 me-1.5" />}
                {copied ? t.mediaCopiedPrompt : t.mediaCopyPrompt}
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isPending || Boolean(filedId)}
                onClick={handleFileQueue}
                className="h-8 rounded-full text-xs cursor-pointer"
              >
                {isPending && <Loader2 className="size-3.5 me-1.5 animate-spin" />}
                {isPending ? t.mediaFilingQueue : filedId ? t.mediaFiledQueue : t.mediaFileQueue}
              </Button>

              {/* Bridge directly to social copy drafting */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToStage("draft")}
                className="border-primary/40 text-primary hover:bg-primary/10 h-8 rounded-full text-xs cursor-pointer"
              >
                <Sparkles className="size-3.5 me-1.5" />
                {t.mediaDraftCopy}
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCompiled(null);
                setSubject("");
              }}
              className="h-8 text-xs cursor-pointer"
            >
              {t.mediaStartNew}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Deterministic live card preview rendering real Thmanyah typography,
 * brand color palettes, and structured layouts right in the browser.
 */
function VisualCardPreview({
  compiled,
  isRTL,
  brand,
}: {
  compiled: MediaStudioOutput;
  isRTL: boolean;
  brand: string;
}) {
  const isTestimonial = compiled.format === "testimonial";
  const isInfographic = compiled.format === "infographic";
  const isAdOrHero = compiled.format === "ad" || compiled.format === "post";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-primary" /> Live Card Preview
        </span>
        <span className="font-mono">{compiled.ratio}</span>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-6 shadow-xs transition-all",
          brand === "mkan" ? "bg-[#faf8f5] text-[#1a1815]" : "bg-[#faf9f5] text-[#141413]",
        )}
      >
        {isTestimonial ? (
          <div className="space-y-4">
            <Quote className="size-8 text-primary/30" />
            <blockquote className="font-serif text-lg sm:text-xl font-bold leading-snug tracking-tight">
              "{compiled.beats.scene}"
            </blockquote>
            <div className="flex items-center justify-between border-t border-black/10 pt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {brand === "mkan" ? "Superhost · Hayy Al-Shati, Port Sudan" : "Principal Dr. Tariq · Khartoum"}
              </span>
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-primary">
                {brand === "mkan" ? "mkan.sd" : "ed.databayt.org"}
              </span>
            </div>
          </div>
        ) : isInfographic ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="bg-primary/10 text-primary font-mono text-[10px] font-bold uppercase rounded-full px-2.5 py-0.5">
                {brand === "mkan" ? "Port Sudan Stays" : "Hogwarts SIS"}
              </span>
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                {compiled.domain}
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold leading-snug">
              {compiled.beats.scene}
            </h4>
            <div className="flex flex-wrap gap-2 pt-1">
              {brand === "mkan" ? (
                <>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">⚡ 24/7 Standby Power</span>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">❄️ Split AC In All Rooms</span>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">🌊 Red Sea View</span>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">📶 High-Speed Wi-Fi</span>
                </>
              ) : (
                <>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">📊 98% On-Time Fees</span>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">📱 Instant WhatsApp Invoices</span>
                  <span className="bg-black/5 rounded-full px-3 py-1 text-xs font-medium">⚡ Zero Paperwork</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono uppercase font-bold text-primary">
                {compiled.format?.toUpperCase()} · {compiled.ratio}
              </span>
              <span className="font-mono text-[11px]">{compiled.dimensions}</span>
            </div>
            <p className="text-sm sm:text-base font-medium leading-relaxed">
              {compiled.beats.scene}
            </p>
            <div className="flex items-center justify-between border-t border-black/10 pt-2 text-[11px] text-muted-foreground">
              <span>{compiled.beats.lightingAtmosphere}</span>
              <span className="font-mono font-bold text-foreground">{compiled.domain}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
