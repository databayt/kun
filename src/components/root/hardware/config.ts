// Data behind /hardware — the unmanned, solar-powered compute node at Erkowit.
//
// Numbers here are the authority for the page and must stay in step with
// content/docs/hardware.mdx, which carries the reasoning. Wh/day is stored
// explicitly rather than always derived, because a few rows have mixed duty
// cycles that a single watts x hours product cannot express honestly.
//
// This replaced a 7-seat live-in hub model. The node is unmanned and dispatched
// remotely, so there is no domestic load beyond the caretaker's quarters.

export type LoadGroup = "node" | "site";

export type LoadRow = {
  id: string;
  group: LoadGroup;
  label: string;
  labelAr: string;
  qty: number;
  watts: number;
  hours: number;
  /** Authoritative Wh/day. Equals qty x watts x hours except on mixed-duty rows. */
  wh: number;
  /** Non-sheddable — this is what battery autonomy actually has to protect. */
  firm: boolean;
  /** Can be scheduled into the solar window instead of drawn from battery. */
  shiftable: boolean;
  defaultOn: boolean;
  detail?: string;
  detailAr?: string;
};

export const LOAD_ROWS: LoadRow[] = [
  // ── The node ──────────────────────────────────────────────────────────
  {
    id: "service-plane",
    group: "node",
    label: "Service plane",
    labelAr: "طبقة الخدمات",
    qty: 1,
    watts: 25,
    hours: 24,
    wh: 600,
    firm: true,
    shiftable: false,
    defaultOn: true,
    detail: "CRM · Hermes · Postgres · git mirror · CI · staging",
    detailAr:
      "إدارة العملاء · هيرمس · قاعدة البيانات · مرآة git · التكامل · التجريب",
  },
  {
    id: "storage",
    group: "node",
    label: "Storage",
    labelAr: "التخزين",
    qty: 1,
    watts: 30,
    hours: 24,
    wh: 720,
    firm: true,
    shiftable: false,
    defaultOn: true,
    detail: "Model weights, package cache, backup target",
    detailAr: "أوزان النماذج وذاكرة الحزم والنسخ الاحتياطي",
  },
  {
    id: "network",
    group: "node",
    label: "Network — router, switch, LTE CPE",
    labelAr: "الشبكة — الموجه والمبدل ووحدة الاتصال",
    qty: 1,
    watts: 45,
    hours: 24,
    wh: 1080,
    firm: true,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "oob",
    group: "node",
    label: "Out-of-band — switched PDU, management modem, watchdog",
    labelAr: "التحكم المستقل — مقبس مُبدَّل ومودم إدارة ومراقب",
    qty: 1,
    watts: 12,
    hours: 24,
    wh: 288,
    firm: true,
    shiftable: false,
    defaultOn: true,
    detail: "The remote power button. Nobody is there to press one",
    detailAr: "زر التشغيل عن بُعد — لا أحد هناك ليضغطه",
  },
  {
    id: "security",
    group: "node",
    label: "Security — cameras, sensors, perimeter light",
    labelAr: "الحماية — كاميرات وحساسات وإنارة محيطية",
    qty: 1,
    watts: 25,
    hours: 24,
    wh: 600,
    firm: true,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "cooling",
    group: "node",
    label: "Equipment-room free-air cooling",
    labelAr: "تبريد غرفة المعدات بالهواء الحر",
    qty: 2,
    watts: 60,
    hours: 10,
    wh: 1200,
    firm: false,
    shiftable: false,
    defaultOn: true,
    detail:
      "EC fans. At 22 °C ambient this replaces a compressor drawing 6× more",
    detailAr: "مراوح — عند ٢٢ درجة تُغني عن مكيف يستهلك ٦ أضعاف",
  },

  // ── Site ──────────────────────────────────────────────────────────────
  {
    id: "caretaker",
    group: "site",
    label: "Caretaker quarters",
    labelAr: "سكن الحارس",
    qty: 1,
    watts: 63,
    hours: 24,
    wh: 1500,
    firm: false,
    shiftable: false,
    defaultOn: true,
    detail:
      "Light, fan, charging, small fridge. Not optional — theft and panel cleaning",
    detailAr:
      "إنارة ومروحة وشحن وثلاجة صغيرة — ضرورة لمنع السرقة وتنظيف الألواح",
  },
  {
    id: "pump",
    group: "site",
    label: "Water transfer pump",
    labelAr: "مضخة المياه",
    qty: 1,
    watts: 750,
    hours: 0.7,
    wh: 525,
    firm: false,
    shiftable: true,
    defaultOn: true,
  },
  {
    id: "dehumidifier",
    group: "site",
    label: "Dehumidifier — fog season",
    labelAr: "مزيل الرطوبة — موسم الضباب",
    qty: 1,
    watts: 320,
    hours: 6,
    wh: 1920,
    firm: false,
    shiftable: false,
    defaultOn: false,
    detail:
      "Condensation on cold silicon at dawn is the failure mode here, not heat",
    detailAr: "التكثف على الرقائق الباردة فجرًا هو الخطر لا الحرارة",
  },
  {
    id: "vsat",
    group: "site",
    label: "VSAT as primary link",
    labelAr: "الأقمار كوصلة أساسية",
    qty: 1,
    watts: 180,
    hours: 24,
    wh: 4320,
    firm: true,
    shiftable: false,
    defaultOn: false,
    detail: "Backup lane — power it down unless the primary is out",
    detailAr: "وصلة احتياطية — تُطفأ ما لم تنقطع الأساسية",
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
  price: string;
  verdict: string;
  verdictAr: string;
};

export const MACHINES: Machine[] = [
  {
    id: "spark",
    name: "DGX Spark class",
    nameAr: "من فئة DGX Spark",
    memory: "128 GB unified",
    bandwidth: "273 GB/s",
    compute: "~1 PFLOP FP4",
    loadW: 240,
    idleW: 30,
    loadHours: 10,
    price: "$3,999–4,699",
    verdict:
      "Buy this one. Fits the array with room to spare; excellent on low-active MoE at batch",
    verdictAr:
      "الخيار الآن — يناسب الألواح بسهولة وممتاز مع نماذج MoE على دفعات",
  },
  {
    id: "station",
    name: "DGX Station GB300",
    nameAr: "DGX Station GB300",
    memory: "~784 GB coherent",
    bandwidth: "HBM3e",
    compute: "~20 PFLOPS FP4",
    loadW: 1600,
    idleW: 400,
    loadHours: 8,
    price: "~$85,000",
    verdict:
      "The endpoint, priced and gated. Needs roughly triple the solar plant on top of the box",
    verdictAr: "الهدف البعيد — يحتاج ثلاثة أضعاف المحطة الشمسية فوق ثمن الجهاز",
  },
];

export function machineWh(m: Machine): number {
  return m.loadW * m.loadHours + m.idleW * (24 - m.loadHours);
}

/** Sizing constants. Every one of these is a design choice, not a law. */
export const SIZING = {
  /** Days the bank carries the full load with no sun. */
  autonomyDays: 1.2,
  /** LiFePO4 depth of discharge. */
  dod: 0.9,
  /** Inverter efficiency. */
  inverterEff: 0.94,
  /** Worst-month peak sun hours — conservative for Erkowit's fog. */
  pshWorstMonth: 4.5,
  /** Soiling, temperature, wiring, MPPT, mismatch. */
  derate: 0.75,
  /** Deliberate array oversize — PV beats battery per delivered kWh. */
  pvHeadroom: 1.9,
  /** Contingency on the measured load table to reach the design figure. */
  designMargin: 1.1,
} as const;

export type Sizing = {
  dailyKWh: number;
  designKWh: number;
  firmKWh: number;
  machineKWh: number;
  batteryKWh: number;
  pvMinKWp: number;
  pvRecKWp: number;
  arrayAreaM2: number;
};

/**
 * The whole electrical model in one function. Kept pure and exported so the
 * numbers on the page and the numbers in the doc come from one place.
 */
export function computeSizing(
  selectedIds: ReadonlySet<string>,
  machine: Machine,
): Sizing {
  let dailyWh = machineWh(machine);
  let firmWh = 0;

  for (const row of LOAD_ROWS) {
    if (!selectedIds.has(row.id)) continue;
    dailyWh += row.wh;
    if (row.firm) firmWh += row.wh;
  }

  const dailyKWh = dailyWh / 1000;
  const designKWh = dailyKWh * SIZING.designMargin;

  const batteryKWh =
    (designKWh * SIZING.autonomyDays) / (SIZING.dod * SIZING.inverterEff);
  const pvMinKWp = designKWh / (SIZING.pshWorstMonth * SIZING.derate);
  const pvRecKWp = pvMinKWp * SIZING.pvHeadroom;

  return {
    dailyKWh,
    designKWh,
    firmKWh: firmWh / 1000,
    machineKWh: machineWh(machine) / 1000,
    batteryKWh,
    pvMinKWp,
    pvRecKWp,
    // ~550 W modules at roughly 2.6 m² each.
    arrayAreaM2: (pvRecKWp / 0.55) * 2.6,
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
    label: "Elevation",
    labelAr: "الارتفاع",
    value: "~1,100–1,350 m",
    valueAr: "١١٠٠–١٣٥٠ م",
  },
  {
    label: "Ambient",
    labelAr: "الحرارة",
    value: "~22 °C — free-air cooling",
    valueAr: "٢٢° — تبريد بالهواء الحر",
  },
  {
    label: "To Port Sudan",
    labelAr: "إلى بورتسودان",
    value: "~90 km · ~4 h",
    valueAr: "٩٠ كم · ٤ ساعات",
  },
  {
    label: "Grid",
    labelAr: "الشبكة",
    value: "12–18 h daily blackouts",
    valueAr: "انقطاع ١٢–١٨ ساعة يوميًا",
  },
  {
    label: "Worst-month sun",
    labelAr: "أقل شمس شهريًا",
    value: "4.5 PSH (fog)",
    valueAr: "٤٫٥ ساعة ذروة (ضباب)",
  },
  {
    label: "Staffing",
    labelAr: "التشغيل",
    value: "Unmanned — dispatched remotely",
    valueAr: "بلا طاقم — يُشغَّل عن بُعد",
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
    what: "Laptops the team already owns, plus cloud. No site.",
    whatAr: "حواسيب الفريق الحالية والسحابة. بلا موقع.",
    capex: "$0",
    trigger: "Current state",
    triggerAr: "الوضع الحالي",
    now: false,
  },
  {
    n: "1",
    name: "Blackout resilience",
    nameAr: "الصمود أمام الانقطاع",
    what: "Per person in Sudan: 1 kWh power station, 200–400 W folding panel, LTE router, surge strip. Buys 8–10 working hours through an outage.",
    whatAr:
      "لكل شخص في السودان: بطارية ١ ك.و.س، لوح شمسي ٢٠٠–٤٠٠ واط، موجه، حماية من التيار. ٨–١٠ ساعات عمل خلال الانقطاع.",
    capex: "$400–900 / person",
    trigger: "None — affordable now, and it protects delivery today",
    triggerAr: "بلا شرط — ممكن الآن ويحمي التسليم",
    now: true,
  },
  {
    n: "2",
    name: "The node, without the supercomputer",
    nameAr: "الموقع بلا الحاسوب الخارق",
    what: "6 kWp, 15 kWh, 2 × 3 kW hybrid, mast + LTE, service plane, switched PDU + management modem, security. CRM, Hermes, git, cache and staging move local.",
    whatAr:
      "٦ ك.و.ذ ألواح، بطارية ١٥ ك.و.س، عاكسان ٣ ك.و، برج واتصال، طبقة الخدمات، مقبس مُبدَّل ومودم إدارة، حماية. نقل العملاء وهيرمس وgit والتجريب محليًا.",
    capex: "$15,000–22,000",
    trigger: "First paying school, or non-dilutive funding",
    triggerAr: "أول مدرسة مدفوعة أو تمويل غير مخفِّض",
    now: false,
  },
  {
    n: "3",
    name: "The supercomputer",
    nameAr: "الحاسوب الخارق",
    what: "Spark-class box on the plant Tier 2 already built. Local inference and media generation go live.",
    whatAr:
      "جهاز من فئة Spark على المحطة التي بنتها المرحلة ٢. تشغيل الاستدلال وتوليد الوسائط محليًا.",
    capex: "$4,000–5,000",
    trigger: "3 paying schools / ~$3K MRR sustained 3 months",
    triggerAr: "٣ مدارس مدفوعة أو ٣ آلاف دولار شهريًا لثلاثة أشهر",
    now: false,
  },
  {
    n: "4",
    name: "Scale the box",
    nameAr: "توسيع الجهاز",
    what: "Second Spark linked over ConnectX-7 for 256 GB, or a DGX Station GB300 with the plant tripled to 16 kWp / 40 kWh.",
    whatAr:
      "جهاز Spark ثانٍ موصول عبر ConnectX-7 ليصبح ٢٥٦ ج.ب، أو DGX Station GB300 مع مضاعفة المحطة ثلاث مرات.",
    capex: "$5,000 or ~$105,000",
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
      "12 months of measured node uptime, and a customer who wants on-prem and pays for it",
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
    klass: "Llama 3.1 8B FP4",
    klassAr: "Llama 3.1 8B FP4",
    active: "8B dense",
    speed: "~924 tok/s @ batch 128",
    verdict: "Trivial for the box. Good for classification and enrichment",
    verdictAr: "سهل على الجهاز — مناسب للتصنيف والإثراء",
    good: true,
  },
  {
    klass: "Qwen3-Coder-30B-A3B FP8",
    klassAr: "Qwen3-Coder-30B-A3B FP8",
    active: "3B active (MoE)",
    speed: "~483 tok/s @ batch 64",
    verdict:
      "The target. Low active params is exactly what this hardware wants",
    verdictAr: "الهدف — قلة المعاملات النشطة هي ما يناسب هذا العتاد",
    good: true,
  },
  {
    klass: "80B-class MoE coder",
    klassAr: "مبرمج MoE بحجم ٨٠ مليار",
    active: "~45 GB weights",
    speed: "fits 128 GB with KV headroom",
    verdict: "Best quality that still fits and still prefills fast",
    verdictAr: "أفضل جودة تتسع وتُعالج السياق بسرعة",
    good: true,
  },
  {
    klass: "Dense Llama 3.1 70B",
    klassAr: "Llama 3.1 70B الكثيف",
    active: "70B dense",
    speed: "~2.7 tok/s decode",
    verdict: "Never. Bandwidth-bound — the box looks broken running this",
    verdictAr: "أبدًا — محدود بعرض النطاق ويبدو الجهاز معطلًا",
    good: false,
  },
];
