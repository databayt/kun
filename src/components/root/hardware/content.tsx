import Link from "next/link";
import type { ReactNode } from "react";
import {
  BatteryCharging,
  DatabaseBackup,
  Power,
  RadioTower,
} from "lucide-react";
import { BlurImage } from "@/components/atom/blur-image";
import { cn } from "@/lib/utils";
import { CostModel } from "./cost-model";
import {
  ALTERNATIVES,
  DEFAULT_SELECTION,
  MACHINE,
  MODEL_LADDER,
  SETUP_ITEMS,
  SITE_FACTS,
  TIERS,
  computeSetup,
  usd,
  type ProductImage,
} from "./config";
import type { Locale } from "@/components/local/config";

interface HardwareContentProps {
  lang: Locale;
}

const RESILIENCE = [
  {
    icon: BatteryCharging,
    t: "UPS with AVR",
    tAr: "مزوّد طاقة بمنظم جهد",
    d: "Brownouts never reach the box; a real outage gets minutes to finish the job and sleep cleanly",
    dAr: "التذبذب لا يصل إلى الجهاز، والانقطاع الفعلي يمنحه دقائق لإنهاء المهمة والإيقاف النظيف",
  },
  {
    icon: Power,
    t: "Start up after a power failure",
    tAr: "تشغيل تلقائي بعد انقطاع التيار",
    d: "One macOS Energy setting, so every long outage self-heals without a human",
    dAr: "إعداد واحد في macOS ليتعافى الجهاز من كل انقطاع طويل وحده",
  },
  {
    icon: RadioTower,
    t: "LTE failover on a second carrier",
    tAr: "LTE احتياطي على مشغّل ثانٍ",
    d: "The router cuts over in seconds, and remote login (Tailscale, Screen Sharing) keeps working through it",
    dAr: "الموجه يتحول خلال ثوانٍ، والدخول عن بُعد (Tailscale ومشاركة الشاشة) يستمر",
  },
  {
    icon: DatabaseBackup,
    t: "Backups and an idempotent queue",
    tAr: "نسخ احتياطي وطابور قابل للإعادة",
    d: "Time Machine hourly, an off-site copy to S3, and every job safe to re-run after a cut",
    dAr: "Time Machine كل ساعة ونسخة خارجية إلى S3، وكل مهمة تحتمل الإعادة بعد الانقطاع",
  },
];

export default function HardwareContent({ lang }: HardwareContentProps) {
  const isAr = lang === "ar";
  const totals = computeSetup(DEFAULT_SELECTION);
  const byId = new Map(SETUP_ITEMS.map((i) => [i.id, i]));
  const display = byId.get("display")!;
  const smallTiles = ["keyboard", "trackpad", "ups"].map((id) => byId.get(id)!);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <header className="max-w-3xl">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {isAr ? "العتاد · كيغالي" : "Hardware · Kigali"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {isAr ? "ماك ستوديو واحد. مكتب واحد." : "One Mac Studio. One desk."}
        </h1>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          {isAr
            ? "محطة عمل في كيغالي تدير النماذج محليًا — ماك ستوديو M5 Max بإعداده الافتراضي، وشاشة Studio Display، وألياف بخط احتياطي، ومزوّد طاقة يحمي كل ذلك."
            : "A workstation in Kigali that runs the models locally — a Mac Studio M5 Max in its default configuration, a Studio Display, fibre with a failover line, and a UPS that keeps it all up."}
        </p>
      </header>

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
        <HeroStat
          label={isAr ? "لمرة واحدة" : "One-time"}
          value={usd(totals.capexUSD)}
        />
        <HeroStat
          label={isAr ? "شهريًا" : "Monthly"}
          value={usd(totals.monthlyUSD)}
        />
        <HeroStat
          label={isAr ? "على البطارية" : "On battery"}
          value={`${Math.round(totals.upsMinutes)} min`}
        />
      </dl>

      <figure className="mt-10">
        <div className="bg-muted relative aspect-[3/2] overflow-hidden rounded-3xl">
          <BlurImage
            src="/hardware/desk-hero.jpg"
            alt={
              isAr
                ? "ماك ستوديو بجانب شاشة Studio Display تعرض Xcode مع Claude"
                : "Mac Studio beside a Studio Display running Xcode with Claude"
            }
            fill
            unoptimized
            fetchPriority="high"
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="object-cover"
          />
        </div>
        <figcaption className="text-muted-foreground mt-3 text-xs">
          {isAr
            ? "ماك ستوديو وشاشة Studio Display. الصورة: أبل."
            : "Mac Studio with Studio Display. Image: Apple."}
        </figcaption>
      </figure>

      {/* ── The setup ───────────────────────────────────────────────── */}
      <Section
        title={isAr ? "ما على المكتب" : "What's on the desk"}
        lede={
          isAr
            ? "خمس قطع، كلها متاحة اليوم. أسعار أبل الأمريكية المعلنة — أضف الشحن والجمارك."
            : "Five pieces, all shipping today. Apple US list prices — add freight and duty."
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ProductTile
            image={MACHINE.image}
            alt="Mac Studio"
            name={isAr ? MACHINE.nameAr : MACHINE.name}
            detail={`${MACHINE.memory} · ${MACHINE.storage} · ${MACHINE.compute}`}
            price={usd(MACHINE.priceUSD)}
            aspect="aspect-video"
          />
          <ProductTile
            image={display.image!}
            alt="Studio Display"
            name={isAr ? display.labelAr : display.label}
            detail={isAr ? display.detailAr! : display.detail!}
            price={usd(display.capexUSD)}
            aspect="aspect-video"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {smallTiles.map((item) => (
            <ProductTile
              key={item.id}
              image={item.image!}
              alt={item.label}
              name={isAr ? item.labelAr : item.label}
              detail={isAr ? item.detailAr! : item.detail!}
              price={usd(item.capexUSD)}
              aspect="aspect-square"
            />
          ))}
        </div>
      </Section>

      {/* ── The one box ─────────────────────────────────────────────── */}
      <Section
        title={isAr ? "الجهاز" : "The one box"}
        lede={isAr ? MACHINE.taglineAr : MACHINE.tagline}
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="bg-muted relative aspect-video overflow-hidden rounded-2xl">
            <BlurImage
              src={MACHINE.rearImage.src}
              alt={isAr ? "منافذ ماك ستوديو الخلفية" : "Mac Studio rear ports"}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 620px"
              className="object-cover mix-blend-multiply dark:mix-blend-normal"
            />
          </div>
          <dl className="divide-border divide-y text-sm">
            {MACHINE.specs.map((s) => (
              <div
                key={s.label}
                className="grid grid-cols-[7rem_1fr] gap-4 py-2.5"
              >
                <dt className="text-muted-foreground">
                  {isAr ? s.labelAr : s.label}
                </dt>
                <dd dir="ltr" className="font-medium rtl:text-end">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ── Site facts ──────────────────────────────────────────────── */}
      <Section
        title={isAr ? "الموقع" : "The site"}
        lede={
          isAr
            ? "كيغالي تملك ما افتقده موقع أركويت: شبكة كهرباء، وأيدٍ قريبة، واتصالًا مرخّصًا."
            : "Kigali has what the Erkowit site lacked: a grid, hands nearby, and a licensed link."
        }
      >
        <dl className="bg-muted/50 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl p-6 sm:grid-cols-3">
          {SITE_FACTS.map((fact) => (
            <div key={fact.label}>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                {isAr ? fact.labelAr : fact.label}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {isAr ? fact.valueAr : fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── The live model ──────────────────────────────────────────── */}
      <Section
        title={isAr ? "نموذج التكلفة الحي" : "The live cost model"}
        lede={
          isAr
            ? "أطفئ أي بند أو أضف ترقية الذاكرة لترى الكلفة لمرة واحدة والفاتورة الشهرية وكم تصمد البطارية. ترقية ١٢٨ ج.ب تضيف ٢٦٠٠ دولار — ولا تُشترى إلا عند الطلب."
            : "Switch line items off, or add the memory upgrade, and watch the one-time cost, the monthly bill and the battery runtime move. The 128 GB upgrade adds $2,600 — and can only be bought at checkout."
        }
      >
        <CostModel isAr={isAr} />
      </Section>

      {/* ── What to run on it ───────────────────────────────────────── */}
      <Section
        title={isAr ? "ما الذي يُشغَّل عليه" : "What to run on it"}
        lede={
          isAr
            ? "أوزان النماذج الحدودية مغلقة — لا يشتريها أي عتاد. المتاح هو الفئة مفتوحة الأوزان. والقاعدة: نماذج MoE قليلة المعاملات النشطة، لا النماذج الكثيفة — وفي ٣٦ ج.ب، فئة ٣٠ مليار هي السقف المريح."
            : "Frontier weights are closed — no hardware buys them. What runs is the open-weight tier. The rule: MoE with low active parameters, never dense — and in 36 GB, the 30B class is the comfortable ceiling."
        }
      >
        <div className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
          {MODEL_LADDER.map((row) => (
            <div
              key={row.klass}
              className={cn(
                "grid gap-x-4 gap-y-1 p-4 sm:grid-cols-[15rem_12rem_1fr] sm:items-baseline",
                !row.good && "bg-muted/50",
              )}
            >
              <span
                dir="ltr"
                className="flex items-center gap-2 text-sm font-medium rtl:justify-end"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    row.good ? "bg-foreground" : "bg-muted-foreground/40",
                  )}
                />
                {isAr ? row.klassAr : row.klass}
              </span>
              <span
                dir="ltr"
                className="text-muted-foreground font-mono text-xs tabular-nums rtl:text-end"
              >
                {row.active} · {row.speed}
              </span>
              <span className="text-muted-foreground text-sm">
                {isAr ? row.verdictAr : row.verdict}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 mt-4 rounded-2xl p-5">
          <h3 className="text-sm font-semibold">
            {isAr ? "macOS وMLX — بصراحة" : "macOS and MLX, honestly"}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {isAr
              ? "الجهاز يشغّل النماذج عبر MLX من أبل (mlx-lm وOllama بمحرك MLX) — الذاكرة الموحدة تعني أن النموذج كله في متناول المعالج الرسومي بلا نسخ. الثمن: لا CUDA ولا vLLM، وذاكرة السياق في mlx_lm.server لكل طلب على حدة، فالجهاز ممتاز لمستخدم واحد أو طابور متسلسل لا لعشرات الطلبات المتزامنة. وهذا يناسب حجمنا الآن."
              : "The box serves models through Apple's MLX (mlx-lm, Ollama's MLX engine) — unified memory means the whole model sits within the GPU's reach with no copies. The price: no CUDA, no vLLM, and mlx_lm.server keeps a per-request KV cache, so the box is excellent for one person or a serial queue, not dozens of concurrent requests. That matches our size today."}
          </p>
        </div>
      </Section>

      {/* ── The roads not taken ─────────────────────────────────────── */}
      <Section
        title={isAr ? "الطرق التي لم نسلكها" : "The roads not taken"}
        lede={
          isAr
            ? "ثلاثة بدائل معقولة، كلٌّ مرفوض أو مؤجل لسبب محدد لا لتفضيل. الأرقام محققة في أكتوبر ٢٠٢٦."
            : "Three reasonable alternatives, each rejected or deferred for a specific reason rather than a preference. Figures checked October 2026."
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {ALTERNATIVES.map((alt) => (
            <div
              key={alt.id}
              className="border-border flex flex-col rounded-2xl border p-5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {isAr ? alt.nameAr : alt.name}
                </h3>
                <span className="text-muted-foreground bg-muted shrink-0 rounded-full px-2 py-0.5 text-[10px]">
                  {alt.status === "watch"
                    ? isAr
                      ? "يُراجع"
                      : "watch"
                    : isAr
                      ? "مرفوض"
                      : "rejected"}
                </span>
              </div>

              <div
                dir="ltr"
                className="mt-4 font-mono text-3xl tabular-nums rtl:text-end"
              >
                {alt.headline}
              </div>
              <div className="text-muted-foreground text-xs">
                {isAr ? alt.headlineLabelAr : alt.headlineLabel}
              </div>

              {/* dir=ltr keeps the number-unit runs in order; short Arabic
                  phrases inside still render as correct RTL runs. */}
              <div
                dir="ltr"
                className="text-muted-foreground border-border mt-4 space-y-0.5 border-t pt-4 font-mono text-[11px] tabular-nums rtl:text-end"
              >
                {(isAr ? alt.specsAr : alt.specs).map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>

              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                {isAr ? alt.verdictAr : alt.verdict}
              </p>
            </div>
          ))}
        </div>

        <div className="border-foreground mt-4 rounded-2xl border p-5">
          <h3 className="text-sm font-semibold">
            {isAr ? "اشترِ الفئة لا الطراز" : "Buy the class, never the SKU"}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {isAr
              ? "أبل تجدد شرائحها كل عام تقريبًا، وكل جيل يرفع عرض النطاق — وهو بالضبط ما يقيّد التوليد. ومحفّز المرحلة ٢ قد لا يقع قبل جيل M6 — لذا تُكتب المواصفة «ماك ستوديو بشريحة Max، الإعداد الافتراضي للجيل المتاح وقت التنفيذ»، لا رقم طراز. بهذا لا يكون تأجيل الشراء انضباطًا ماليًا فحسب، بل ترقية تلقائية للخطة."
              : "Apple refreshes its chips roughly yearly, and each generation raises memory bandwidth — precisely what caps decode. Our Tier 2 trigger may not fire before the M6 generation — so the spec reads “Mac Studio, Max-class chip, default configuration of the generation current at trigger time,” never a part number. Written that way, buying the box last is not only cash discipline; the plan upgrades itself while it waits."}
          </p>
        </div>
      </Section>

      {/* ── Resilience ──────────────────────────────────────────────── */}
      <Section
        title={
          isAr
            ? "حين تنقطع الكهرباء أو الاتصال"
            : "When the power or the link drops"
        }
        lede={
          isAr
            ? "شبكة كيغالي مستقرة لكنها ليست مثالية، والجهاز يُستخدم عن بُعد حين لا يكون أحد على المكتب. لذا يُبنى التعافي من قطع بسيطة موثوقة."
            : "Kigali's grid is steady, not perfect, and the box gets used remotely whenever nobody is at the desk. So recovery is built out of simple, reliable parts."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RESILIENCE.map((item) => (
            <div key={item.t} className="bg-muted/50 rounded-2xl p-5">
              <item.icon aria-hidden className="size-5" strokeWidth={1.5} />
              <h3 className="mt-4 text-sm font-semibold">
                {isAr ? item.tAr : item.t}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {isAr ? item.dAr : item.d}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Tiers ───────────────────────────────────────────────────── */}
      <Section
        title={isAr ? "المراحل ومحفّزاتها" : "Tiers and triggers"}
        lede={
          isAr
            ? "لاحظ الشكل: الاتصال يأتي أولًا لأنه رخيص ويحمي التسليم اليوم، والجهاز ينتظر الإيراد. وتشغيل النماذج محليًا لا يكلف شيئًا إضافيًا — إنه برمجيات على جهاز اشتريناه."
            : "Note the shape: the link comes first because it is cheap and protects delivery today, and the box waits on revenue. Running models locally then costs nothing extra — it is software on a machine we already bought."
        }
      >
        <ol className="border-border relative space-y-6 border-s ps-6">
          {TIERS.map((tier) => (
            <li key={tier.n} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -start-[2.15rem] top-0.5 flex size-5 items-center justify-center rounded-full border font-mono text-[10px]",
                  tier.now
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {tier.n}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold">
                  {isAr ? tier.nameAr : tier.name}
                </h3>
                {tier.now && (
                  <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[10px]">
                    {isAr ? "الآن" : "now"}
                  </span>
                )}
                <span
                  dir="ltr"
                  className="ms-auto font-mono text-sm tabular-nums"
                >
                  {tier.capex}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                {isAr ? tier.whatAr : tier.what}
              </p>
              <p className="mt-1 text-xs">
                <span className="text-muted-foreground">
                  {isAr ? "المحفّز: " : "Trigger: "}
                </span>
                {isAr ? tier.triggerAr : tier.trigger}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── To the doc ──────────────────────────────────────────────── */}
      <footer className="border-border mt-20 border-t pt-8">
        <p className="text-muted-foreground text-sm">
          {isAr
            ? "التفاصيل الكاملة — اختيار الجهاز والشاشة والاتصال والطاقة وقائمة المواد والمخاطر — في "
            : "The full reasoning — choosing the box, the display, connectivity, power, bill of materials and risks — is in "}
          {/* Hardcoded /en: the docs corpus is English-only, so /ar/docs/*
              404s. Point Arabic readers at the page that exists. */}
          <Link
            href="/en/docs/hardware"
            className="text-foreground underline underline-offset-4"
          >
            {isAr ? "وثيقة العتاد" : "the hardware doc"}
          </Link>
          . {isAr ? "صور المنتجات من أبل وAPC." : "Product images: Apple, APC."}
        </p>
      </footer>
    </div>
  );
}

function Section({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-20 lg:mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed sm:text-base">
        {lede}
      </p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-widest uppercase">
        {label}
      </dt>
      <dd
        dir="ltr"
        className="mt-1 font-mono text-2xl tabular-nums rtl:text-end"
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * A store-style product tile. Photos with a baked light backdrop multiply into
 * the muted surface in light mode; transparent cut-outs sit on it padded.
 */
function ProductTile({
  image,
  alt,
  name,
  detail,
  price,
  aspect,
}: {
  image: ProductImage;
  alt: string;
  name: string;
  detail: string;
  price: string;
  aspect: string;
}) {
  return (
    <article className="group flex flex-col">
      <div
        className={cn("bg-muted relative overflow-hidden rounded-2xl", aspect)}
      >
        <BlurImage
          src={image.src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 560px"
          className={cn(
            "group-hover:scale-[1.02]",
            image.cutout
              ? "object-contain p-8"
              : "object-cover mix-blend-multiply dark:mix-blend-normal",
          )}
        />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{name}</h3>
        <span dir="ltr" className="shrink-0 font-mono text-sm tabular-nums">
          {price}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {detail}
      </p>
    </article>
  );
}
