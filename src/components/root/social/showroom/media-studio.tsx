"use client";

// The Media Studio — prompt area on /social/media matching the exact geometry
// and feel of DraftAgent on /social/draft. Tailored for concrete marketing asset
// generation across brands like Mkan and Hogwarts (walkthrough reels, listing shots,
// lifestyle scenes, product ads, infographics, carousels, testimonials, mockups).

import { useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  Check,
  Clapperboard,
  Copy,
  FileImage,
  Laptop,
  Layers,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Plus,
  Quote,
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

export interface AssetFormatOption {
  id: string;
  label: string;
  labelAr: string;
  sub: string;
  subAr: string;
  kind: MediaStudioKind;
  defaultRatio: MediaStudioRatio;
  icon: typeof Clapperboard;
}

const ASSET_FORMATS: AssetFormatOption[] = [
  {
    id: "reel",
    label: "Walkthrough & Reel",
    labelAr: "جولة فيديو وريل",
    sub: "Property tour / Feature demo (24fps)",
    subAr: "جولة في العقار أو استعراض الميزات",
    kind: "video",
    defaultRatio: "9:16",
    icon: Clapperboard,
  },
  {
    id: "product",
    label: "Listing & Product Shot",
    labelAr: "لقطة عقار ومنتج",
    sub: "4K architectural / master room plate",
    subAr: "لوحة معمارية أو لقطة غرفة بدقة 4K",
    kind: "image",
    defaultRatio: "4:5",
    icon: FileImage,
  },
  {
    id: "lifestyle",
    label: "Lifestyle & Guest Scene",
    labelAr: "مشهد حياتي وتجربة",
    sub: "Warm family / student / host moment",
    subAr: "لحظة دافئة لعائلة أو طالب أو مضيف",
    kind: "image",
    defaultRatio: "4:5",
    icon: Sparkles,
  },
  {
    id: "ad",
    label: "Product Ad & Campaign",
    labelAr: "إعلان وحملة ترويجية",
    sub: "High-impact booking / admission promo",
    subAr: "ترويج عالي التأثير للحجز أو التسجيل",
    kind: "image",
    defaultRatio: "16:9",
    icon: Megaphone,
  },
  {
    id: "infographic",
    label: "Infographic & Amenities",
    labelAr: "إنفوجرافيك ومميزات",
    sub: "Amenities list / stats / fee breakdown",
    subAr: "قائمة الخدمات والأسعار والإحصاءات",
    kind: "template",
    defaultRatio: "1:1",
    icon: BarChart3,
  },
  {
    id: "carousel",
    label: "Carousel Deck Slide",
    labelAr: "شريحة كاروسيل",
    sub: "Multi-slide city guide / product steps",
    subAr: "دليل الأحياء وخطوات الاستخدام",
    kind: "template",
    defaultRatio: "4:5",
    icon: Layers,
  },
  {
    id: "testimonial",
    label: "Host / Client Testimonial",
    labelAr: "شهادة مضيف / عميل",
    sub: "Thmanyah Serif Display quote card",
    subAr: "بطاقة اقتباس بخط ثمانية العريض",
    kind: "template",
    defaultRatio: "1:1",
    icon: Quote,
  },
  {
    id: "mockup",
    label: "UI & Device Mockup",
    labelAr: "نموذج الواجهة والتطبيق",
    sub: "App interface on phone / tablet / desk",
    subAr: "واجهة التطبيق على هاتف أو جهاز لوحي",
    kind: "image",
    defaultRatio: "1:1",
    icon: Laptop,
  },
];

const MODELS_BY_KIND: Record<
  MediaStudioKind,
  { id: string; label: string; sub: string }[]
> = {
  video: [
    { id: "seedance", label: "Seedance 2.5", sub: "Fast · Motion & Audio" },
    { id: "veo", label: "Veo 3.1", sub: "Google Cinematic Realism" },
    { id: "kling", label: "Kling 3.0", sub: "Optics & Camera Movement" },
  ],
  image: [
    { id: "gemini", label: "Gemini 3.1 Flash", sub: "High-Res 4K Master Plate" },
    { id: "gpt_image", label: "GPT Image 2", sub: "Photorealistic Textures" },
  ],
  template: [
    { id: "canvas", label: "HTML Canvas", sub: "Deterministic Thmanyah Type" },
  ],
};

export function MediaStudio() {
  const { isRTL, t, product: globalProduct } = useSocial();

  // Active brand is driven by the global product in the page nav tabs
  const brand = globalProduct || "mkan";
  const [formatId, setFormatId] = useState<string>("reel");
  const currentFormat =
    ASSET_FORMATS.find((f) => f.id === formatId) || ASSET_FORMATS[0];

  const [kind, setKind] = useState<MediaStudioKind>(currentFormat.kind);
  const [model, setModel] = useState<string>("seedance");
  const [ratio, setRatio] = useState<MediaStudioRatio>(currentFormat.defaultRatio);
  const [spine, setSpine] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [compiled, setCompiled] = useState<MediaStudioOutput | null>(null);
  const [copied, setCopied] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);
  const [filingError, setFilingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeModelOptions = useMemo(
    () => MODELS_BY_KIND[kind] || MODELS_BY_KIND.video,
    [kind],
  );

  // Spines available for this brand
  const spines = useMemo(() => getBrandSpines(brand), [brand]);
  const activeSpine = spine || spines[0]?.id || "cinematic";

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

  // Brand and format-reactive starter suggestions
  const presets = useMemo(() => {
    if (brand === "mkan") {
      switch (formatId) {
        case "reel":
          return [
            { label: "Walkthrough · Red Sea Balcony", text: "A smooth 35mm handheld tour gliding from a sunlit coastal living room to a breezy balcony overlooking the Red Sea in Port Sudan." },
            { label: "Kitchen to Sunset Terrace", text: "Walkthrough gliding through an open kitchen into a private sunset veranda in Hayy Al-Shati." },
          ];
        case "product":
          return [
            { label: "Master Bedroom · Ocean View", text: "A bright, airy master bedroom with clean white linens, wooden side tables, and gentle morning sunlight in Hayy Al-Shati, Port Sudan." },
            { label: "Spacious Coastal Living Room", text: "Living room with large windows, split AC, and clean tiled floors overlooking the Red Sea coastline." },
          ];
        case "lifestyle":
          return [
            { label: "Family Afternoon Tea", text: "A Sudanese family enjoying mint tea on a breezy seaside veranda in Port Sudan during golden hour." },
            { label: "Host Welcoming Guests", text: "A warm local host greeting arriving travelers with authentic Red Sea hospitality." },
          ];
        case "ad":
          return [
            { label: "Weekend Rental Campaign", text: "High-impact promotional plate for luxury Port Sudan seaside apartments with 24/7 standby power and split AC." },
            { label: "Host Onboarding Promo", text: "Earn from your coastal property in Port Sudan by listing on Mkan." },
          ];
        case "infographic":
          return [
            { label: "Amenities Checklist", text: "24/7 solar & generator backup power, high-speed Wi-Fi, split AC in every room, 5 mins from Red Sea beach." },
            { label: "Transparent Pricing Breakdown", text: "Clear nightly rental pricing with zero hidden fees in Hayy Al-Shati." },
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
            { label: "Mobile App Search", text: "Traveler holding a smartphone searching Port Sudan rental homes on Mkan with the Red Sea in the soft background." },
          ];
        default:
          return [
            { label: t.mediaPresetMadePossible, text: "A Sudanese family enjoying mint tea on a breezy sunlit coastal balcony overlooking the Red Sea in Port Sudan at golden hour." },
          ];
      }
    }

    if (brand === "hogwarts") {
      switch (formatId) {
        case "reel":
          return [
            { label: "Campus Library Walkthrough", text: "Cinematic camera glide across a sunlit modern school library courtyard as students collaborate on laptops." },
            { label: "Classroom Attendance Demo", text: "Teacher taking digital attendance in seconds on a tablet in an active classroom." },
          ];
        case "product":
          return [
            { label: "Teacher's Desk Setup", text: "A clean minimalist teacher's desk with a tablet displaying the Hogwarts live student gradebook." },
            { label: "Bursar Administrative Suite", text: "An elegant administrative office with laptops running fee reconciliation dashboards." },
          ];
        case "lifestyle":
          return [
            { label: "Focused Student Study", text: "A dedicated high school student researching in a tranquil modern library setting with natural morning light." },
            { label: "Interactive Classroom Group", text: "Students enthusiastically raising hands in a bright, modern classroom." },
          ];
        case "ad":
          return [
            { label: "Admission Season Campaign", text: "Modernize your entire school management in minutes with zero paperwork this admission term." },
            { label: "Bursar Automated Billing Promo", text: "Automate fee tracking and parent WhatsApp invoices with Hogwarts SIS." },
          ];
        case "infographic":
          return [
            { label: "School Metrics Overview", text: "98% on-time fee collection, 100% automated student progress cards, and instant SMS parent notices." },
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
            { label: "Tablet Dashboard Mockup", text: "Clean bursar's office desk with a tablet displaying the real-time school financial collection dashboard." },
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
        assetType: kind === "video" ? "reel" : formatId === "ad" ? "hero" : "hero",
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

  const FormatIcon = currentFormat.icon;

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

              {/* 1. Asset Format & Use-Case Selector */}
              <PromptInputModelSelect
                value={formatId}
                onValueChange={(val) => handleFormatChange(val)}
              >
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  <FormatIcon className="size-3.5 text-primary" />
                  <span className="font-medium text-xs">
                    {isRTL ? currentFormat.labelAr : currentFormat.label}
                  </span>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent
                  align={isRTL ? "end" : "start"}
                  className="w-72 p-1.5 space-y-1"
                >
                  {ASSET_FORMATS.map((fmt) => {
                    const Icon = fmt.icon;
                    return (
                      <PromptInputModelSelectItem
                        key={fmt.id}
                        value={fmt.id}
                        className="cursor-pointer py-1.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-4 w-4 items-center justify-center text-primary">
                            <Icon className="size-4" />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs text-foreground">
                                {isRTL ? fmt.labelAr : fmt.label}
                              </span>
                              <span className="font-mono text-[9px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {fmt.kind}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/80 leading-tight">
                              {isRTL ? fmt.subAr : fmt.sub}
                            </span>
                          </div>
                        </div>
                      </PromptInputModelSelectItem>
                    );
                  })}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* 2. Simple Model Selector */}
              <PromptInputModelSelect
                value={model}
                onValueChange={(val) => {
                  setModel(val);
                  if (compiled) handleCompile();
                }}
              >
                <PromptInputModelSelectTrigger className={KNOB_TRIGGER}>
                  <Sparkles className="size-3.5 text-primary" />
                  <span className="font-medium text-xs">
                    {activeModelOptions.find((m) => m.id === model)?.label ||
                      activeModelOptions[0]?.label}
                  </span>
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent
                  align={isRTL ? "end" : "start"}
                  className="w-56 p-1.5 space-y-1"
                >
                  {activeModelOptions.map((m) => (
                    <PromptInputModelSelectItem
                      key={m.id}
                      value={m.id}
                      className="cursor-pointer py-1.5"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-xs text-foreground">
                          {m.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.sub}
                        </span>
                      </div>
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>

              {/* 3. Higgsfield-inspired Aspect Ratio Selector */}
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
              <span className="bg-primary/10 text-primary flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase">
                <RatioWireframe ratio={compiled.ratio} className="text-primary" />
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
                <Clapperboard className="size-3.5 text-primary" /> Camera & Framing
              </p>
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
