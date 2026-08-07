import Link from "next/link";
import { SizingModel } from "./sizing-model";
import { SITE_FACTS, TIERS, MODEL_LADDER } from "./config";
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
            ? "مجمّع حوسبة خارج الشبكة في أركويت — الاستدلال المحلي وطبقة الخادم ومسار الوسائط لبيت برمجيات من سبعة مقاعد."
            : "An off-grid compute compound at Erkowit — local inference, the server plane and the media lane for a 7-seat software house."}
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
            ? "أطفئ أي حمل لترى ما يكلفه فعلًا من بطارية وألواح. الصيغ نفسها المكتوبة في الوثيقة."
            : "Switch a load off to see what it actually costs in battery and panels. Same formulas the doc prints — this page just lets you push on them."}
        </p>

        <div className="mt-8">
          <SizingModel isAr={isAr} />
        </div>
      </section>

      {/* ── Model ladder ────────────────────────────────────────────── */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold tracking-tight">
          {isAr ? "سُلّم النماذج" : "What runs locally"}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {isAr
            ? "أوزان النماذج الحدودية مغلقة — لا يمكن تشغيلها محليًا مهما بلغ العتاد. المتاح هو الفئة مفتوحة الأوزان، وسقفها ٧١–٧٢٪ على SWE-bench مقابل ٨٠–٩٥٪ للمغلقة. المحلي مسار الحجم والانقطاع، لا بديل عن كلود."
            : "Frontier weights are closed — no hardware buys them. What runs is the open-weight tier, topping out at 71–72% SWE-bench against 80–95% closed. Local is the volume and offline lane, not a Claude replacement."}
        </p>

        <div className="border-border divide-border mt-6 divide-y overflow-hidden rounded-lg border">
          {MODEL_LADDER.map((row) => (
            <div
              key={row.klass}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 p-3 ${
                row.target ? "bg-muted/50" : ""
              }`}
            >
              <span className="w-32 shrink-0 text-sm font-medium">
                {isAr ? row.klassAr : row.klass}
              </span>
              <span
                dir="ltr"
                className="text-muted-foreground w-24 shrink-0 font-mono text-xs tabular-nums rtl:text-end"
              >
                {row.weights}
              </span>
              <span className="text-muted-foreground w-48 shrink-0 text-xs">
                {isAr ? row.fitsAr : row.fits}
              </span>
              <span className="min-w-0 flex-1 text-xs">
                {isAr ? row.verdictAr : row.verdict}
              </span>
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
            ? "البناء الكامل نحو ٥٥ ألف دولار مقابل مدرج ٥ آلاف. لا يُشترى شيء قبل أن يتحقق محفّزه."
            : "The full build is ~$55K against a $5K runway. Nothing is bought before its trigger fires."}
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
            ? "التفاصيل الكاملة — الحماية والتبريد والاتصال والمياه والسكن وقائمة المواد والمخاطر ومسح الموقع — في "
            : "The full reasoning — protection, cooling, connectivity, water, housing, bill of materials, risks and the site survey — is in "}
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
