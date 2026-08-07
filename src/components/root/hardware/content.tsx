import Link from "next/link";
import { SizingModel } from "./sizing-model";
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
            ? "حاسوب خارق واحد يعمل بالطاقة الشمسية في أركويت — موقع حوسبة بلا طاقم، يُشغَّل عن بُعد ويدير النماذج محليًا."
            : "One supercomputer on solar at Erkowit — an unmanned compute node, dispatched remotely, running the models locally."}
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
          {isAr ? "نموذج القياس الحي" : "The live sizing model"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "اختر الجهاز وأطفئ أي حمل لترى ما يكلفه فعلًا من بطارية وألواح. اختيار جهاز الـ٨٥ ألف بدل جهاز الـ٤ آلاف يضاعف المحطة الشمسية ثلاث مرات — وهذا ما تراه هنا مباشرة."
            : "Pick the box, switch loads off, and watch the plant resize. Choosing the $85K machine over the $4K one roughly triples the solar plant — that delta is the whole argument, and here it is live."}
        </p>

        <div className="mt-8">
          <SizingModel isAr={isAr} />
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
              ? "نظام التشغيل ليس قرارًا منفصلًا"
              : "The OS is not a separate decision"}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {isAr
              ? "جهاز Spark يأتي بنظام DGX OS المبني على أوبنتو مع CUDA مثبتًا — اختيار الجهاز يختار النظام. وهو الصواب أصلًا: PagedAttention في vLLM حصري على لينكس وCUDA، بينما ذاكرة السياق في mlx_lm.server لكل طلب على حدة — وهو بالضبط ما لا يناسب المهام المتزامنة المُرسَلة عن بُعد."
              : "The Spark ships DGX OS, built on Ubuntu, with CUDA preloaded — choosing the box chooses the OS. It is right anyway: vLLM's PagedAttention is Linux + CUDA only, while mlx_lm.server keeps a per-request KV cache — exactly the wrong shape for concurrent dispatched jobs."}
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
            ? "ثلاثة بدائل معقولة، كلٌّ مرفوض لسبب محدد لا لتفضيل. الأرقام محققة في أغسطس ٢٠٢٦."
            : "Three reasonable alternatives, each rejected for a specific reason rather than a preference. Figures checked August 2026."}
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
              ? "خارطة NVIDIA تُصلح ضعف الجهاز الحالي في موعد معروف: Rubin Spark بذاكرة LPDDR6 بين ٢٠٢٧ و٢٠٢٨، وعرض النطاق هو بالضبط ما يقيّد التوليد اليوم. ومحفّز المرحلة ٣ يقع غالبًا في ٢٠٢٧ — لذا تُكتب المواصفة «من فئة Spark، الجيل المتاح وقت التنفيذ»، لا رقم طراز. بهذا لا يكون تأجيل الشراء انضباطًا ماليًا فحسب، بل ترقية تلقائية للخطة."
              : "NVIDIA's roadmap fixes the current box's one weakness on a known schedule: Rubin Spark with LPDDR6 lands 2027–28, and LPDDR5X bandwidth is precisely what caps decode today. Our Tier 3 trigger plausibly fires in 2027 — so the spec reads “Spark-class, current generation at trigger time,” never a part number. Written that way, buying the box last is not only cash discipline; the plan upgrades itself while it waits."}
          </p>
        </div>
      </section>

      {/* ── Unattended ops ──────────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "التشغيل بلا حضور" : "Nobody is there"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "أقرب يد بشرية على بعد أربع ساعات، وأجهزة هذه الفئة بلا وحدة إدارة مستقلة. لذا يُبنى التعافي من قطع بسيطة موثوقة."
            : "The nearest hands are four hours away, and Spark-class hardware has no BMC or IPMI to call. So recovery is built out of dumb, reliable parts."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            {
              t: "Switched PDU",
              tAr: "مقبس مُبدَّل عبر الشبكة",
              d: "The remote power button — the last resort, pressable from anywhere",
              dAr: "زر التشغيل عن بُعد — الملاذ الأخير من أي مكان",
            },
            {
              t: "Power-on after loss",
              tAr: "تشغيل تلقائي بعد الانقطاع",
              d: "Set in BIOS, so every outage self-heals without a human",
              dAr: "يُضبط في البيوس ليتعافى الموقع من كل انقطاع وحده",
            },
            {
              t: "Separate management path",
              tAr: "مسار إدارة منفصل",
              d: "A second LTE modem on a different carrier reaching only the PDU. You cannot fix the link through the link",
              dAr: "مودم ثانٍ على شبكة أخرى يصل للمقبس فقط — لا يمكن إصلاح الوصلة عبر الوصلة",
            },
            {
              t: "Idempotent queue",
              tAr: "طابور قابل للإعادة",
              d: "A hard power-cycle mid-job is normal here, not an incident. Every job must be safe to re-run",
              dAr: "قطع التيار أثناء المهمة أمر عادي هنا — كل مهمة يجب أن تحتمل الإعادة",
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
            ? "لاحظ الشكل: المرحلة ٢ هي الأغلى ولا يحمل أي جزء منها شعار NVIDIA. المحطة والوصلة والقدرة على الوصول عن بُعد تكلف أربعة أضعاف الحاسوب نفسه."
            : "Note the shape: Tier 2 is the expensive part, and none of it has an NVIDIA logo on it. The plant, the link and the ability to reach the site remotely cost four times what the computer costs."}
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
            ? "التفاصيل الكاملة — اختيار الجهاز والحماية والتبريد والاتصال وقائمة المواد والمخاطر ومسح الموقع — في "
            : "The full reasoning — choosing the box, protection, cooling, connectivity, bill of materials, risks and the site survey — is in "}
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
