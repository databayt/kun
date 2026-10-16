// Data behind /hardware — one Mac Studio workstation in Kigali.
//
// Numbers here are the authority for the page and must stay in step with
// content/docs/hardware.mdx, which carries the reasoning. Apple prices are US
// list, checked October 2026; Kigali line items (fibre, LTE, power tariff) are
// estimates until a written quote replaces them — each says so in its detail.
//
// This replaced an unmanned solar node at Erkowit. Kigali's grid is steady
// enough that the solar plant collapses to a line-interactive UPS, and the
// interesting number stops being kWp and becomes dollars.

export type ItemGroup = "desk" | "link" | "power";

export type SetupItem = {
  id: string;
  group: ItemGroup;
  label: string;
  labelAr: string;
  /** One-time cost, USD. */
  capexUSD: number;
  /** Recurring cost, USD per month (service fees, not electricity). */
  monthlyUSD: number;
  /** Typical draw while on — what the UPS has to carry. */
  watts: number;
  hours: number;
  defaultOn: boolean;
  detail?: string;
  detailAr?: string;
};

export function itemWh(item: SetupItem): number {
  return item.watts * item.hours;
}

export const SETUP_ITEMS: SetupItem[] = [
  // ── The desk ──────────────────────────────────────────────────────────
  {
    id: "display",
    group: "desk",
    label: "Studio Display (2026) — 27″ 5K",
    labelAr: "شاشة Studio Display (٢٠٢٦) — ٢٧ بوصة 5K",
    capexUSD: 1599,
    monthlyUSD: 0,
    watts: 30,
    hours: 10,
    defaultOn: true,
    detail:
      "600 nits · P3 · 12 MP Center Stage · Thunderbolt 5 in, daisy-chain out",
    detailAr: "٦٠٠ شمعة · P3 · كاميرا ١٢ ميغابكسل · Thunderbolt 5 مع تسلسل",
  },
  {
    id: "nano",
    group: "desk",
    label: "Nano-texture glass",
    labelAr: "زجاج النانو المطفأ",
    capexUSD: 300,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: false,
    detail: "Only if the desk faces a window — Kigali light is bright",
    detailAr: "فقط إن كان المكتب مقابل نافذة — ضوء كيغالي ساطع",
  },
  {
    id: "stand",
    group: "desk",
    label: "Tilt- and height-adjustable stand",
    labelAr: "حامل قابل للإمالة والارتفاع",
    capexUSD: 400,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: false,
    detail: "A VESA arm does the same for a quarter of the price",
    detailAr: "ذراع VESA يؤدي الغرض بربع السعر",
  },
  {
    id: "input",
    group: "desk",
    label: "Magic Keyboard (Touch ID) + Magic Trackpad",
    labelAr: "لوحة مفاتيح Magic بـ Touch ID ولوحة لمس",
    capexUSD: 278,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: true,
    detail: "The Mac Studio ships with neither",
    detailAr: "الجهاز لا يأتي بأيٍّ منهما",
  },
  {
    id: "ssd",
    group: "desk",
    label: "4 TB Thunderbolt 5 SSD — Time Machine",
    labelAr: "قرص SSD بسعة ٤ تيرابايت — Time Machine",
    capexUSD: 400,
    monthlyUSD: 0,
    watts: 5,
    hours: 24,
    defaultOn: true,
    detail: "Hourly local snapshots; the off-site copy goes to S3",
    detailAr: "نسخ محلية كل ساعة، والنسخة الخارجية إلى S3",
  },

  // ── The link ──────────────────────────────────────────────────────────
  {
    id: "fibre",
    group: "link",
    label: "Business fibre — CanalBox Business",
    labelAr: "ألياف للأعمال — CanalBox Business",
    capexUSD: 50,
    monthlyUSD: 60,
    watts: 12,
    hours: 24,
    defaultOn: true,
    detail:
      "Up to 10 Gbps tiers in Kigali since Feb 2026. Monthly is an estimate until quoted; Liquid and MTN are the comparison",
    detailAr:
      "باقات حتى ١٠ جيجابت في كيغالي منذ فبراير ٢٠٢٦. الشهري تقديري حتى عرض السعر؛ Liquid وMTN للمقارنة",
  },
  {
    id: "lte",
    group: "link",
    label: "LTE failover router + data plan",
    labelAr: "موجه LTE احتياطي مع باقة بيانات",
    capexUSD: 150,
    monthlyUSD: 20,
    watts: 6,
    hours: 24,
    defaultOn: true,
    detail: "Different carrier from the fibre's upstream. Cuts over in seconds",
    detailAr: "مشغّل مختلف عن مزوّد الألياف — يتحول خلال ثوانٍ",
  },

  // ── Power ─────────────────────────────────────────────────────────────
  {
    id: "ups",
    group: "power",
    label: "Line-interactive UPS — 1500 VA / 900 W",
    labelAr: "مزوّد طاقة احتياطي — ١٥٠٠ فولت أمبير / ٩٠٠ واط",
    capexUSD: 300,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: true,
    detail:
      "AVR rides through brownouts; the battery covers an outage long enough to finish the job and sleep cleanly",
    detailAr:
      "منظم الجهد يمتص التذبذب، والبطارية تكفي لإنهاء المهمة والإيقاف النظيف",
  },
];

// ── The one box ─────────────────────────────────────────────────────────

export type Machine = {
  id: string;
  name: string;
  nameAr: string;
  memory: string;
  bandwidth: string;
  compute: string;
  loadW: number;
  idleW: number;
  loadHours: number;
  priceUSD: number;
  config: string;
  verdict: string;
  verdictAr: string;
};

export const MACHINES: Machine[] = [
  {
    id: "m5-max",
    name: "Mac Studio — M5 Max",
    nameAr: "ماك ستوديو — M5 Max",
    memory: "128 GB unified",
    bandwidth: "614 GB/s",
    compute: "40-core GPU",
    loadW: 105,
    idleW: 10,
    loadHours: 8,
    priceUSD: 5399,
    config: "128 GB · 1 TB",
    verdict:
      "Buy this one. Holds an 80B-class MoE with room for context, at the power draw of a desk lamp",
    verdictAr:
      "الخيار الآن — يتسع لنموذج MoE بحجم ٨٠ مليار مع سياق، باستهلاك مصباح مكتب",
  },
  {
    id: "m5-ultra",
    name: "Mac Studio — M5 Ultra",
    nameAr: "ماك ستوديو — M5 Ultra",
    memory: "256 GB unified",
    bandwidth: "1.2 TB/s",
    compute: "up to 80-core GPU",
    loadW: 220,
    idleW: 15,
    loadHours: 8,
    priceUSD: 9499,
    config: "256 GB · 1 TB",
    verdict:
      "Twice the bandwidth, so twice the decode speed — for $4,100 more. The Tier 4 box, not the first one",
    verdictAr:
      "ضعف عرض النطاق أي ضعف سرعة التوليد — مقابل ٤١٠٠ دولار إضافية. جهاز المرحلة ٤ لا الأولى",
  },
];

export function machineWh(m: Machine): number {
  return m.loadW * m.loadHours + m.idleW * (24 - m.loadHours);
}

/** Cost and power constants. Every one of these is an assumption, not a law. */
export const SETUP = {
  /** Rwanda non-residential tariff, roughly — USD per kWh. */
  kwhUSD: 0.25,
  /** For showing the monthly figure in francs. */
  usdRwf: 1450,
  /** 1500 VA class UPS: 2 × 12 V 9 Ah. */
  upsBatteryWh: 216,
  /** Inverter efficiency plus usable depth of a lead-acid pack. */
  upsEff: 0.8,
  /** UPS output limit — peak draw must stay under this. */
  upsMaxW: 900,
} as const;

export type Setup = {
  capexUSD: number;
  serviceMonthlyUSD: number;
  powerMonthlyUSD: number;
  monthlyUSD: number;
  dailyKWh: number;
  machineKWh: number;
  peakW: number;
  /** 0 when no UPS is selected. */
  upsMinutes: number;
  hasUps: boolean;
};

/**
 * The whole cost model in one function. Kept pure and exported so the numbers
 * on the page and the numbers in the doc come from one place.
 */
export function computeSetup(
  selectedIds: ReadonlySet<string>,
  machine: Machine,
): Setup {
  let capexUSD = machine.priceUSD;
  let serviceMonthlyUSD = 0;
  let dailyWh = machineWh(machine);
  let peakW = machine.loadW;

  for (const item of SETUP_ITEMS) {
    if (!selectedIds.has(item.id)) continue;
    capexUSD += item.capexUSD;
    serviceMonthlyUSD += item.monthlyUSD;
    dailyWh += itemWh(item);
    peakW += item.watts;
  }

  const dailyKWh = dailyWh / 1000;
  const powerMonthlyUSD = dailyKWh * 30 * SETUP.kwhUSD;
  const hasUps = selectedIds.has("ups");

  return {
    capexUSD,
    serviceMonthlyUSD,
    powerMonthlyUSD,
    monthlyUSD: serviceMonthlyUSD + powerMonthlyUSD,
    dailyKWh,
    machineKWh: machineWh(machine) / 1000,
    peakW,
    upsMinutes: hasUps ? ((SETUP.upsBatteryWh * SETUP.upsEff) / peakW) * 60 : 0,
    hasUps,
  };
}

// ── Site facts ──────────────────────────────────────────────────────────

export type SiteFact = {
  label: string;
  labelAr: string;
  value: string;
  valueAr: string;
};

export const SITE_FACTS: SiteFact[] = [
  {
    label: "City",
    labelAr: "المدينة",
    value: "Kigali, Rwanda",
    valueAr: "كيغالي، رواندا",
  },
  {
    label: "Elevation",
    labelAr: "الارتفاع",
    value: "~1,567 m",
    valueAr: "١٥٦٧ م تقريبًا",
  },
  {
    label: "Ambient",
    labelAr: "الحرارة",
    value: "~20–27 °C — no cooling load",
    valueAr: "٢٠–٢٧° — بلا حمل تبريد",
  },
  {
    label: "Grid",
    labelAr: "الشبكة",
    value: "Stable · short outages",
    valueAr: "مستقرة · انقطاعات قصيرة",
  },
  {
    label: "Link",
    labelAr: "الاتصال",
    value: "Fibre + LTE failover",
    valueAr: "ألياف + LTE احتياطي",
  },
  {
    label: "Staffing",
    labelAr: "التشغيل",
    value: "On the desk · reachable remotely",
    valueAr: "على المكتب · متاح عن بُعد",
  },
];

// ── Tiers ───────────────────────────────────────────────────────────────

export type Tier = {
  n: string;
  name: string;
  nameAr: string;
  what: string;
  whatAr: string;
  capex: string;
  trigger: string;
  triggerAr: string;
  now: boolean;
};

export const TIERS: Tier[] = [
  {
    n: "0",
    name: "Today",
    nameAr: "اليوم",
    what: "Laptops the team already owns, plus cloud.",
    whatAr: "حواسيب الفريق الحالية والسحابة.",
    capex: "$0",
    trigger: "Current state",
    triggerAr: "الوضع الحالي",
    now: false,
  },
  {
    n: "1",
    name: "The link",
    nameAr: "الاتصال",
    what: "Business fibre, an LTE failover on a second carrier, and a UPS for the router. The one piece every later tier stands on.",
    whatAr:
      "ألياف للأعمال، وخط LTE احتياطي على مشغّل ثانٍ، ومزوّد طاقة للموجه. الأساس الذي تقف عليه كل المراحل اللاحقة.",
    capex: "~$500 + ~$80/mo",
    trigger: "None — affordable now, and it protects delivery today",
    triggerAr: "بلا شرط — ممكن الآن ويحمي التسليم",
    now: true,
  },
  {
    n: "2",
    name: "The workstation",
    nameAr: "محطة العمل",
    what: "Mac Studio M5 Max 128 GB, Studio Display, keyboard and trackpad, Time Machine SSD. Hermes, the CRM mirror, git and staging move onto the box.",
    whatAr:
      "ماك ستوديو M5 Max بذاكرة ١٢٨ ج.ب، شاشة Studio Display، لوحة مفاتيح ولمس، قرص Time Machine. نقل هيرمس ومرآة العملاء وgit والتجريب إلى الجهاز.",
    capex: "~$7,700",
    trigger: "First paying school, or non-dilutive funding",
    triggerAr: "أول مدرسة مدفوعة أو تمويل غير مخفِّض",
    now: false,
  },
  {
    n: "3",
    name: "Local models live",
    nameAr: "تشغيل النماذج محليًا",
    what: "MLX serving on the box: enrichment, classification and the coder model run locally; the cloud keeps the frontier work.",
    whatAr:
      "تشغيل MLX على الجهاز: الإثراء والتصنيف ونموذج البرمجة محليًا، والسحابة للمهام الحدودية.",
    capex: "$0 — software",
    trigger: "3 paying schools / ~$3K MRR sustained 3 months",
    triggerAr: "٣ مدارس مدفوعة أو ٣ آلاف دولار شهريًا لثلاثة أشهر",
    now: false,
  },
  {
    n: "4",
    name: "Scale the box",
    nameAr: "توسيع الجهاز",
    what: "M5 Ultra with 256–512 GB, or a second Studio clustered over Thunderbolt 5. The M5 Max moves to a teammate's desk.",
    whatAr:
      "M5 Ultra بذاكرة ٢٥٦–٥١٢ ج.ب، أو جهاز ثانٍ موصول عبر Thunderbolt 5. وينتقل M5 Max إلى مكتب زميل.",
    capex: "~$9,500+",
    trigger:
      "Measured saturation — the queue is waiting on the machine, not on the link",
    triggerAr: "إشباع مُقاس — الطابور ينتظر الجهاز لا الاتصال",
    now: false,
  },
  {
    n: "5",
    name: "Customer plane migration",
    nameAr: "نقل طبقة العملاء",
    what: "Selected tenants on owned iron.",
    whatAr: "مستأجرون مختارون على عتادنا.",
    capex: "Incremental",
    trigger:
      "12 months of measured uptime, and a customer who wants on-prem and pays for it",
    triggerAr: "١٢ شهرًا من التشغيل المُقاس وعميل يطلب الاستضافة المحلية ويدفع",
    now: false,
  },
];

// ── What the box should run ─────────────────────────────────────────────

export type ModelRow = {
  klass: string;
  klassAr: string;
  active: string;
  speed: string;
  verdict: string;
  verdictAr: string;
  good: boolean;
};

export const MODEL_LADDER: ModelRow[] = [
  {
    klass: "Llama 3.1 8B 4-bit",
    klassAr: "Llama 3.1 8B 4-bit",
    active: "8B dense",
    speed: "fast — ~5 GB",
    verdict: "Trivial for the box. Good for classification and enrichment",
    verdictAr: "سهل على الجهاز — مناسب للتصنيف والإثراء",
    good: true,
  },
  {
    klass: "Qwen3-Coder-30B-A3B 8-bit",
    klassAr: "Qwen3-Coder-30B-A3B 8-bit",
    active: "3B active (MoE)",
    speed: "~32 GB weights",
    verdict: "The target. Low active params is exactly what 614 GB/s wants",
    verdictAr: "الهدف — قلة المعاملات النشطة هي ما يناسب ٦١٤ ج.ب/ث",
    good: true,
  },
  {
    klass: "gpt-oss-120b / 80B-class MoE",
    klassAr: "gpt-oss-120b / MoE بحجم ٨٠ مليار",
    active: "~45–65 GB weights",
    speed: "~75 tok/s measured",
    verdict: "Best quality that still fits 128 GB with KV headroom",
    verdictAr: "أفضل جودة تتسع في ١٢٨ ج.ب مع هامش للسياق",
    good: true,
  },
  {
    klass: "Dense Llama 3.1 70B",
    klassAr: "Llama 3.1 70B الكثيف",
    active: "70B dense",
    speed: "single-digit tok/s",
    verdict: "Never. Bandwidth-bound — the box looks broken running this",
    verdictAr: "أبدًا — محدود بعرض النطاق ويبدو الجهاز معطلًا",
    good: false,
  },
];

// ── The roads not taken ─────────────────────────────────────────────────
//
// Three reasonable alternatives, each rejected for a specific reason rather
// than a preference. Facts checked October 2026.

export type Alternative = {
  id: string;
  name: string;
  nameAr: string;
  /** The single number that decides it. */
  headline: string;
  headlineLabel: string;
  headlineLabelAr: string;
  specs: string[];
  specsAr: string[];
  verdict: string;
  verdictAr: string;
  /** "rejected" is settled; "watch" means revisit when a condition changes. */
  status: "rejected" | "watch";
};

export const ALTERNATIVES: Alternative[] = [
  {
    id: "spark",
    name: "NVIDIA DGX Spark",
    nameAr: "NVIDIA DGX Spark",
    headline: "273 GB/s",
    headlineLabel: "against 614 for the M5 Max",
    headlineLabelAr: "مقابل ٦١٤ لجهاز M5 Max",
    specs: [
      "128 GB unified · ~$4,000–4,700",
      "CUDA · vLLM · DGX OS (Ubuntu)",
      "No display workflow — a headless box",
    ],
    specsAr: [
      "128 GB موحدة · ~$4,000–4,700",
      "CUDA · vLLM · DGX OS (أوبنتو)",
      "بلا سير عمل للشاشة — جهاز بلا واجهة",
    ],
    verdict:
      "Same memory, under half the bandwidth, so slower decode. It buys CUDA, but it would be a second machine beside a Mac rather than the one desk the team works at.",
    verdictAr:
      "الذاكرة نفسها بأقل من نصف عرض النطاق، أي توليد أبطأ. يمنح CUDA لكنه جهاز ثانٍ بجانب ماك لا المكتب الواحد الذي يعمل عليه الفريق.",
    status: "rejected",
  },
  {
    id: "ultra",
    name: "M5 Ultra now",
    nameAr: "M5 Ultra الآن",
    headline: "+$4,100",
    headlineLabel: "for 2× bandwidth and 2× memory",
    headlineLabelAr: "مقابل ضعف عرض النطاق والذاكرة",
    specs: [
      "256 GB · 1.2 TB/s · from $9,499",
      "512 GB option slipping to 2027",
      "480 W max continuous rating",
    ],
    specsAr: [
      "256 GB · 1.2 TB/s · من $9,499",
      "خيار 512 GB متأخر إلى ٢٠٢٧",
      "تصنيف أقصى ٤٨٠ واط مستمر",
    ],
    verdict:
      "Real speed, bought before there is a queue to speed up. It is Tier 4 — revisit when measured saturation says the Max is the bottleneck.",
    verdictAr:
      "سرعة حقيقية تُشترى قبل وجود طابور يحتاجها. هذه المرحلة ٤ — تُراجع حين يثبت القياس أن M5 Max هو عنق الزجاجة.",
    status: "watch",
  },
  {
    id: "xdr",
    name: "Studio Display XDR",
    nameAr: "Studio Display XDR",
    headline: "$3,299",
    headlineLabel: "against $1,599 for the Studio Display",
    headlineLabelAr: "مقابل ١٥٩٩ دولارًا للشاشة العادية",
    specs: [
      "Mini-LED · HDR · 120 Hz",
      "Same 27″ 5K canvas",
      "Built for colour grading",
    ],
    specsAr: [
      "Mini-LED · HDR · 120 Hz",
      "المساحة نفسها ٢٧ بوصة 5K",
      "مصممة لتصحيح الألوان",
    ],
    verdict:
      "Code, docs and dashboards gain nothing from HDR. The $1,700 difference is a fibre line for two years.",
    verdictAr:
      "الكود والوثائق ولوحات المتابعة لا تستفيد من HDR. فرق ١٧٠٠ دولار يدفع خط الألياف لعامين.",
    status: "rejected",
  },
];
