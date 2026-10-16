// Data behind /hardware — one Mac Studio workstation in Kigali.
//
// Numbers here are the authority for the page and must stay in step with
// content/docs/hardware.mdx, which carries the reasoning. Apple prices are US
// list, checked October 2026; Kigali line items (fibre, LTE, power tariff) are
// estimates until a written quote replaces them — each says so in its detail.
//
// Product photos live in public/hardware/: Apple Newsroom press images and
// Apple Store product shots, plus the APC product render. The fibre and LTE
// routers come from the provider, so they carry no photo.
//
// This replaced an unmanned solar node at Erkowit. Kigali's grid is steady
// enough that the solar plant collapses to a line-interactive UPS, and the
// interesting number stops being kWp and becomes dollars.

export type ItemGroup = "box" | "desk" | "link" | "power";

export type ProductImage = {
  src: string;
  width: number;
  height: number;
  /** Transparent PNG cut-out rather than a photo on a baked light backdrop. */
  cutout: boolean;
};

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
  image?: ProductImage;
};

export function itemWh(item: SetupItem): number {
  return item.watts * item.hours;
}

export const SETUP_ITEMS: SetupItem[] = [
  // ── The box, upgraded ─────────────────────────────────────────────────
  {
    id: "upgrade-128",
    group: "box",
    label: "Upgrade: 40-core GPU + 128 GB memory",
    labelAr: "ترقية: معالج رسومي ٤٠ نواة وذاكرة ١٢٨ ج.ب",
    capexUSD: 2600,
    monthlyUSD: 0,
    watts: 15,
    hours: 8,
    defaultOn: false,
    detail:
      "Bandwidth 460 → 614 GB/s and room for 80B-class models. Apple memory cannot be added later — this is decided at checkout or never",
    detailAr:
      "عرض النطاق من ٤٦٠ إلى ٦١٤ ج.ب/ث ومساحة لنماذج ٨٠ مليار. ذاكرة أبل لا تُضاف لاحقًا — القرار عند الشراء أو أبدًا",
  },

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
    image: {
      src: "/hardware/studio-display.jpg",
      width: 1400,
      height: 788,
      cutout: false,
    },
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
    id: "keyboard",
    group: "desk",
    label: "Magic Keyboard with Touch ID",
    labelAr: "لوحة مفاتيح Magic بـ Touch ID",
    capexUSD: 149,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: true,
    detail: "The Mac Studio ships without one. Touch ID unlocks and signs in",
    detailAr: "الجهاز يأتي بدونها — Touch ID للفتح وتسجيل الدخول",
    image: {
      src: "/hardware/magic-keyboard-touch-id.png",
      width: 800,
      height: 800,
      cutout: true,
    },
  },
  {
    id: "trackpad",
    group: "desk",
    label: "Magic Trackpad",
    labelAr: "لوحة اللمس Magic Trackpad",
    capexUSD: 129,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: true,
    detail: "Force Touch, USB-C charging",
    detailAr: "Force Touch وشحن USB-C",
    image: {
      src: "/hardware/magic-trackpad.png",
      width: 800,
      height: 800,
      cutout: true,
    },
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
    label: "APC Back-UPS Pro 1500",
    labelAr: "APC Back-UPS Pro 1500",
    capexUSD: 300,
    monthlyUSD: 0,
    watts: 0,
    hours: 0,
    defaultOn: true,
    detail:
      "BR1500MI, the 230 V model · 1500 VA / 865 W, line-interactive AVR. Rides through brownouts and covers an outage long enough to sleep cleanly",
    detailAr:
      "طراز BR1500MI بجهد ٢٣٠ فولت · ١٥٠٠ فولت أمبير / ٨٦٥ واط مع منظم جهد. يمتص التذبذب ويكفي للإيقاف النظيف",
    image: {
      src: "/hardware/apc-back-ups-pro-1500.jpg",
      width: 800,
      height: 800,
      cutout: false,
    },
  },
];

// ── The one box ─────────────────────────────────────────────────────────

export type Spec = {
  label: string;
  labelAr: string;
  value: string;
};

export type Machine = {
  name: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  memory: string;
  bandwidth: string;
  compute: string;
  storage: string;
  loadW: number;
  idleW: number;
  loadHours: number;
  priceUSD: number;
  image: ProductImage;
  rearImage: ProductImage;
  specs: Spec[];
};

/** Apple's default M5 Max configuration — no build-to-order upgrades. */
export const MACHINE: Machine = {
  name: "Mac Studio — M5 Max",
  nameAr: "ماك ستوديو — M5 Max",
  tagline: "The default configuration. Nothing upgraded, nothing missing.",
  taglineAr: "الإعداد الافتراضي — بلا ترقيات وبلا نقص.",
  memory: "36 GB unified",
  bandwidth: "460 GB/s",
  compute: "18-core CPU · 32-core GPU",
  storage: "512 GB SSD",
  loadW: 90,
  idleW: 9,
  loadHours: 8,
  priceUSD: 2499,
  image: {
    src: "/hardware/mac-studio-front.jpg",
    width: 1400,
    height: 787,
    cutout: false,
  },
  rearImage: {
    src: "/hardware/mac-studio-rear.jpg",
    width: 1400,
    height: 787,
    cutout: false,
  },
  specs: [
    { label: "Chip", labelAr: "الشريحة", value: "Apple M5 Max" },
    {
      label: "CPU",
      labelAr: "المعالج",
      value: "18-core (6 super + 12 performance)",
    },
    {
      label: "GPU",
      labelAr: "المعالج الرسومي",
      value: "32-core, Neural Accelerators",
    },
    { label: "Neural Engine", labelAr: "المحرك العصبي", value: "16-core" },
    { label: "Memory", labelAr: "الذاكرة", value: "36 GB unified · 460 GB/s" },
    { label: "Storage", labelAr: "التخزين", value: "512 GB SSD" },
    {
      label: "Rear",
      labelAr: "الخلف",
      value: "4× Thunderbolt 5 · 10 Gb Ethernet · 2× USB-A · HDMI",
    },
    { label: "Front", labelAr: "الأمام", value: "2× USB-C · SDXC" },
    {
      label: "Wireless",
      labelAr: "اللاسلكي",
      value: "Wi-Fi 7 · Bluetooth 6 (N1)",
    },
    { label: "Software", labelAr: "النظام", value: "macOS 27" },
  ],
};

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
  upsMaxW: 865,
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
export function computeSetup(selectedIds: ReadonlySet<string>): Setup {
  let capexUSD = MACHINE.priceUSD;
  let serviceMonthlyUSD = 0;
  let dailyWh = machineWh(MACHINE);
  let peakW = MACHINE.loadW;

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
    machineKWh: machineWh(MACHINE) / 1000,
    peakW,
    upsMinutes: hasUps ? ((SETUP.upsBatteryWh * SETUP.upsEff) / peakW) * 60 : 0,
    hasUps,
  };
}

/** The default selection — what the hero's headline totals describe. */
export const DEFAULT_SELECTION: ReadonlySet<string> = new Set(
  SETUP_ITEMS.filter((r) => r.defaultOn).map((r) => r.id),
);

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
    what: "Mac Studio M5 Max in its default configuration, Studio Display, Magic Keyboard and Trackpad, Time Machine SSD. Hermes, the CRM mirror, git and staging move onto the box.",
    whatAr:
      "ماك ستوديو M5 Max بإعداده الافتراضي، شاشة Studio Display، لوحة مفاتيح ولمس، قرص Time Machine. نقل هيرمس ومرآة العملاء وgit والتجريب إلى الجهاز.",
    capex: "~$4,800",
    trigger: "First paying school, or non-dilutive funding",
    triggerAr: "أول مدرسة مدفوعة أو تمويل غير مخفِّض",
    now: false,
  },
  {
    n: "3",
    name: "Local models live",
    nameAr: "تشغيل النماذج محليًا",
    what: "MLX serving on the box: enrichment, classification and a 30B-class coder run locally in 36 GB; the cloud keeps the frontier work.",
    whatAr:
      "تشغيل MLX على الجهاز: الإثراء والتصنيف ونموذج برمجة بحجم ٣٠ مليار محليًا ضمن ٣٦ ج.ب، والسحابة للمهام الحدودية.",
    capex: "$0 — software",
    trigger: "3 paying schools / ~$3K MRR sustained 3 months",
    triggerAr: "٣ مدارس مدفوعة أو ٣ آلاف دولار شهريًا لثلاثة أشهر",
    now: false,
  },
  {
    n: "4",
    name: "Scale the box",
    nameAr: "توسيع الجهاز",
    what: "Memory cannot be added to a Mac later, so scaling means a second box: an M5 Ultra (96–512 GB) or a 128 GB Studio clustered over Thunderbolt 5. The first Studio moves to a teammate's desk.",
    whatAr:
      "ذاكرة الماك لا تُضاف لاحقًا، فالتوسع يعني جهازًا ثانيًا: M5 Ultra (٩٦–٥١٢ ج.ب) أو ستوديو بذاكرة ١٢٨ ج.ب موصول عبر Thunderbolt 5. وينتقل الجهاز الأول إلى مكتب زميل.",
    capex: "~$5,100–9,500",
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
    speed: "~5 GB · fast",
    verdict: "Trivial for the box. Good for classification and enrichment",
    verdictAr: "سهل على الجهاز — مناسب للتصنيف والإثراء",
    good: true,
  },
  {
    klass: "gpt-oss-20b",
    klassAr: "gpt-oss-20b",
    active: "~4B active (MoE)",
    speed: "~13 GB",
    verdict: "General reasoning that leaves most of the 36 GB free",
    verdictAr: "استدلال عام يترك معظم الذاكرة فارغة",
    good: true,
  },
  {
    klass: "Qwen3-Coder-30B-A3B 4-bit",
    klassAr: "Qwen3-Coder-30B-A3B 4-bit",
    active: "3B active (MoE)",
    speed: "~17 GB weights",
    verdict:
      "The target. Fits with room for context — low active params is what 460 GB/s wants",
    verdictAr: "الهدف — يتسع مع هامش للسياق، وقلة المعاملات النشطة تناسب ٤٦٠ ج.ب/ث",
    good: true,
  },
  {
    klass: "gpt-oss-120b / 80B-class MoE",
    klassAr: "gpt-oss-120b / MoE بحجم ٨٠ مليار",
    active: "~45–65 GB weights",
    speed: "needs the 128 GB box",
    verdict: "Does not fit in 36 GB. Only with the upgrade, decided at checkout",
    verdictAr: "لا يتسع في ٣٦ ج.ب — فقط مع الترقية عند الشراء",
    good: false,
  },
  {
    klass: "Dense Llama 3.1 70B",
    klassAr: "Llama 3.1 70B الكثيف",
    active: "70B dense",
    speed: "~40 GB 4-bit",
    verdict: "Never. Too big here, and bandwidth-bound on any Mac",
    verdictAr: "أبدًا — أكبر من الذاكرة ومحدود بعرض النطاق على أي ماك",
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
    headline: "128 GB",
    headlineLabel: "for ~$4,000, against 36 GB here",
    headlineLabelAr: "مقابل ~٤٠٠٠ دولار، مقابل ٣٦ ج.ب هنا",
    specs: [
      "273 GB/s vs 460 GB/s",
      "CUDA · vLLM · DGX OS (Ubuntu)",
      "Headless — no desk, no display workflow",
    ],
    specsAr: [
      "273 GB/s مقابل 460 GB/s",
      "CUDA · vLLM · DGX OS (أوبنتو)",
      "بلا واجهة — لا مكتب ولا شاشة",
    ],
    verdict:
      "Holds bigger models, decodes slower, and is a second headless machine beside the desk. If 80B-class models become the need, the +$2,600 upgrade keeps it in one box.",
    verdictAr:
      "يتسع لنماذج أكبر لكنه أبطأ في التوليد، وجهاز ثانٍ بلا واجهة بجانب المكتب. إن صارت نماذج ٨٠ مليار حاجة، فالترقية بـ٢٦٠٠ دولار تبقيها في جهاز واحد.",
    status: "rejected",
  },
  {
    id: "ultra",
    name: "M5 Ultra now",
    nameAr: "M5 Ultra الآن",
    headline: "+$3,000",
    headlineLabel: "for 2.6× bandwidth and 96 GB",
    headlineLabelAr: "مقابل ٢٫٦ ضعف عرض النطاق و٩٦ ج.ب",
    specs: [
      "96 GB · 1.2 TB/s · from $5,499",
      "Up to 512 GB (slipping to 2027)",
      "480 W max continuous rating",
    ],
    specsAr: [
      "96 GB · 1.2 TB/s · من $5,499",
      "حتى 512 GB (متأخر إلى ٢٠٢٧)",
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

// ── Formatting ──────────────────────────────────────────────────────────

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
