import Link from "next/link";
import { CostModel } from "./cost-model";
import { SITE_FACTS, TIERS, MODEL_LADDER, ALTERNATIVES } from "./config";
import type { Locale } from "@/components/local/config";

interface HardwareContentProps {
  lang: Locale;
}

export default function HardwareContent({ lang }: HardwareContentProps) {
  const isAr = lang === "ar";

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-0">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {isAr ? "العتاد" : "Hardware"}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-base">
          {isAr
            ? "جهاز ماك ستوديو واحد في كيغالي — محطة عمل على المكتب تدير النماذج محليًا، مع شاشة Studio Display وألياف بخط احتياطي."
            : "One Mac Studio in Kigali — a workstation on the desk that runs the models locally, with a Studio Display and fibre backed by a failover link."}
        </p>
      </header>

      {/* ── Site facts ──────────────────────────────────────────────── */}
      <dl className="border-border mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y py-6 sm:grid-cols-3">
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

      {/* ── The live model ──────────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "نموذج التكلفة الحي" : "The live cost model"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "اختر الجهاز وأطفئ أي بند لترى كلفته الفعلية مرة واحدة وشهريًا وكم تصمد البطارية. اختيار M5 Ultra بدل M5 Max يضيف ٤١٠٠ دولار مقدمًا — وهذا ما تراه هنا مباشرة."
            : "Pick the box, switch line items off, and watch the one-time cost, the monthly bill and the UPS runtime move. Choosing the M5 Ultra over the M5 Max adds $4,100 up front — that delta is the whole argument, and here it is live."}
        </p>

        <div className="mt-8">
          <CostModel isAr={isAr} />
        </div>
      </section>

      {/* ── What to run on it ───────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "ما الذي يُشغَّل عليه" : "What to run on it"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "أوزان النماذج الحدودية مغلقة — لا يشتريها أي عتاد. المتاح هو الفئة مفتوحة الأوزان، وسقفها ٧١–٧٢٪ على SWE-bench مقابل ٨٠–٩٥٪ للمغلقة. والقاعدة الحاسمة: نماذج MoE قليلة المعاملات النشطة، لا النماذج الكثيفة — سرعة التوليد يحدّدها عرض النطاق مضروبًا في المعاملات النشطة، لا حجم النموذج."
            : "Frontier weights are closed — no hardware buys them. What runs is the open-weight tier, topping out at 71–72% SWE-bench against 80–95% closed. The decisive rule: MoE with low active parameters, never dense. Decode speed is set by memory bandwidth × active params, not by model size."}
        </p>

        <div className="border-border divide-border mt-6 divide-y overflow-hidden rounded-lg border">
          {MODEL_LADDER.map((row) => (
            <div
              key={row.klass}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 p-3 ${
                row.good ? "" : "bg-muted/50"
              }`}
            >
              <span
                dir="ltr"
                className="w-56 shrink-0 text-sm font-medium rtl:text-end"
              >
                {isAr ? row.klassAr : row.klass}
              </span>
              <span
                dir="ltr"
                className="text-muted-foreground w-32 shrink-0 font-mono text-xs tabular-nums rtl:text-end"
              >
                {row.active}
              </span>
              <span
                dir="ltr"
                className="w-44 shrink-0 font-mono text-xs tabular-nums rtl:text-end"
              >
                {row.speed}
              </span>
              <span className="min-w-0 flex-1 text-xs">
                {isAr ? row.verdictAr : row.verdict}
              </span>
            </div>
          ))}
        </div>

        {/* The OS is not a separate decision */}
        <div className="border-border mt-6 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">
            {isAr
              ? "macOS وMLX — بصراحة"
              : "macOS and MLX, honestly"}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {isAr
              ? "الجهاز يشغّل النماذج عبر MLX من أبل (mlx-lm وOllama بمحرك MLX) — الذاكرة الموحدة تعني أن النموذج كله في متناول المعالج الرسومي بلا نسخ. الثمن: لا CUDA ولا vLLM، وذاكرة السياق في mlx_lm.server لكل طلب على حدة، فالجهاز ممتاز لمستخدم واحد أو طابور متسلسل لا لعشرات الطلبات المتزامنة. وهذا يناسب حجمنا الآن."
              : "The box serves models through Apple's MLX (mlx-lm, Ollama's MLX engine) — unified memory means the whole model sits within the GPU's reach with no copies. The price: no CUDA, no vLLM, and mlx_lm.server keeps a per-request KV cache, so the box is excellent for one person or a serial queue, not dozens of concurrent requests. That matches our size today."}
          </p>
        </div>
      </section>

      {/* ── The roads not taken ─────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "الطرق التي لم نسلكها" : "The roads not taken"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "ثلاثة بدائل معقولة، كلٌّ مرفوض أو مؤجل لسبب محدد لا لتفضيل. الأرقام محققة في أكتوبر ٢٠٢٦."
            : "Three reasonable alternatives, each rejected or deferred for a specific reason rather than a preference. Figures checked October 2026."}
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {ALTERNATIVES.map((alt) => (
            <div
              key={alt.id}
              className="border-border flex flex-col rounded-lg border p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {isAr ? alt.nameAr : alt.name}
                </h3>
                <span className="text-muted-foreground border-border shrink-0 rounded border px-1 text-[10px]">
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
                className="mt-3 font-mono text-2xl tabular-nums rtl:text-end"
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
                className="text-muted-foreground border-border mt-3 space-y-0.5 border-t pt-3 font-mono text-[11px] tabular-nums rtl:text-end"
              >
                {(isAr ? alt.specsAr : alt.specs).map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>

              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                {isAr ? alt.verdictAr : alt.verdict}
              </p>
            </div>
          ))}
        </div>

        {/* Buy the class, never the SKU */}
        <div className="border-foreground mt-6 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">
            {isAr ? "اشترِ الفئة لا الطراز" : "Buy the class, never the SKU"}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {isAr
              ? "أبل تجدد شرائحها كل عام تقريبًا، وكل جيل يرفع عرض النطاق — وهو بالضبط ما يقيّد التوليد. ومحفّز المرحلة ٢ قد لا يقع قبل جيل M6 — لذا تُكتب المواصفة «ماك ستوديو بشريحة Max وذاكرة ١٢٨ ج.ب على الأقل، الجيل المتاح وقت التنفيذ»، لا رقم طراز. بهذا لا يكون تأجيل الشراء انضباطًا ماليًا فحسب، بل ترقية تلقائية للخطة."
              : "Apple refreshes its chips roughly yearly, and each generation raises memory bandwidth — precisely what caps decode. Our Tier 2 trigger may not fire before the M6 generation — so the spec reads “Mac Studio, Max-class chip, at least 128 GB, current generation at trigger time,” never a part number. Written that way, buying the box last is not only cash discipline; the plan upgrades itself while it waits."}
          </p>
        </div>
      </section>

      {/* ── Unattended ops ──────────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "حين تنقطع الكهرباء أو الاتصال" : "When the power or the link drops"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "شبكة كيغالي مستقرة لكنها ليست مثالية، والجهاز يُستخدم عن بُعد حين لا يكون أحد على المكتب. لذا يُبنى التعافي من قطع بسيطة موثوقة."
            : "Kigali's grid is steady, not perfect, and the box gets used remotely whenever nobody is at the desk. So recovery is built out of simple, reliable parts."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            {
              t: "UPS with AVR",
              tAr: "مزوّد طاقة بمنظم جهد",
              d: "Brownouts never reach the box; a real outage gets minutes to finish the job and sleep cleanly",
              dAr: "التذبذب لا يصل إلى الجهاز، والانقطاع الفعلي يمنحه دقائق لإنهاء المهمة والإيقاف النظيف",
            },
            {
              t: "Start up after a power failure",
              tAr: "تشغيل تلقائي بعد انقطاع التيار",
              d: "One macOS Energy setting, so every long outage self-heals without a human",
              dAr: "إعداد واحد في macOS ليتعافى الجهاز من كل انقطاع طويل وحده",
            },
            {
              t: "LTE failover on a second carrier",
              tAr: "LTE احتياطي على مشغّل ثانٍ",
              d: "The router cuts over in seconds, and remote login (Tailscale, Screen Sharing) keeps working through it",
              dAr: "الموجه يتحول خلال ثوانٍ، والدخول عن بُعد (Tailscale ومشاركة الشاشة) يستمر",
            },
            {
              t: "Backups and an idempotent queue",
              tAr: "نسخ احتياطي وطابور قابل للإعادة",
              d: "Time Machine hourly, an off-site copy to S3, and every job safe to re-run after a cut",
              dAr: "Time Machine كل ساعة ونسخة خارجية إلى S3، وكل مهمة تحتمل الإعادة بعد الانقطاع",
            },
          ].map((item) => (
            <div key={item.t} className="border-border rounded-lg border p-4">
              <h3 className="text-sm font-semibold">
                {isAr ? item.tAr : item.t}
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {isAr ? item.dAr : item.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tiers ───────────────────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "المراحل ومحفّزاتها" : "Tiers and triggers"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "لاحظ الشكل: الاتصال يأتي أولًا لأنه رخيص ويحمي التسليم اليوم، والجهاز ينتظر الإيراد. وتشغيل النماذج محليًا لا يكلف شيئًا إضافيًا — إنه برمجيات على جهاز اشتريناه."
            : "Note the shape: the link comes first because it is cheap and protects delivery today, and the box waits on revenue. Running models locally then costs nothing extra — it is software on a machine we already bought."}
        </p>

        <div className="mt-6 space-y-3">
          {TIERS.map((tier) => (
            <div
              key={tier.n}
              className={`border-border rounded-lg border p-4 ${
                tier.now ? "border-foreground" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-muted-foreground font-mono text-xs">
                  {isAr ? "المرحلة" : "Tier"} {tier.n}
                </span>
                <h3 className="text-sm font-semibold">
                  {isAr ? tier.nameAr : tier.name}
                </h3>
                <span
                  dir="ltr"
                  className="ms-auto font-mono text-sm tabular-nums"
                >
                  {tier.capex}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {isAr ? tier.whatAr : tier.what}
              </p>
              <p className="mt-2 text-xs">
                <span className="text-muted-foreground">
                  {isAr ? "المحفّز: " : "Trigger: "}
                </span>
                {isAr ? tier.triggerAr : tier.trigger}
              </p>
              {tier.now && (
                <p className="mt-3 text-xs font-medium">
                  {isAr
                    ? "← هذه هي الوحيدة التي لا تنتظر شيئًا."
                    : "← This is the one that waits on nothing."}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

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
          .
        </p>
      </footer>
    </div>
  );
}
