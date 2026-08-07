// Data behind /hardware — the Erkowit off-grid compound.
//
// Numbers here are the authority for the page and must stay in step with
// content/docs/hardware.mdx, which carries the reasoning. Wh/day is stored
// explicitly rather than always derived, because a few rows have mixed duty
// cycles (Node A idles most of the day and bursts for six hours) that a single
// watts x hours product cannot express honestly.

export type LoadGroup = "compute" | "domestic";

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
  // ── Compute and IT ────────────────────────────────────────────────────
  {
    id: "laptops",
    group: "compute",
    label: "Dev laptops",
    labelAr: "حواسيب المطورين",
    qty: 7,
    watts: 55,
    hours: 10,
    wh: 3850,
    firm: false,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "monitors",
    group: "compute",
    label: "External monitors",
    labelAr: "شاشات خارجية",
    qty: 5,
    watts: 28,
    hours: 9,
    wh: 1260,
    firm: false,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "node-a",
    group: "compute",
    label: "Node A — always-on inference",
    labelAr: "العقدة أ — الاستدلال الدائم",
    qty: 1,
    watts: 200,
    hours: 6,
    wh: 1470,
    firm: true,
    shiftable: false,
    defaultOn: true,
    detail: "Mac Studio · 15 W idle × 18 h + 200 W × 6 h",
    detailAr: "ماك ستوديو · ١٥ واط خمول × ١٨ س + ٢٠٠ واط × ٦ س",
  },
  {
    id: "node-b",
    group: "compute",
    label: "Node B — media + burst GPU",
    labelAr: "العقدة ب — الوسائط والمعالج الرسومي",
    qty: 1,
    watts: 850,
    hours: 5,
    wh: 4250,
    firm: false,
    shiftable: true,
    defaultOn: true,
    detail: "Image + video generation, large-context code jobs",
    detailAr: "توليد الصور والفيديو ومهام الشيفرة الكبيرة",
  },
  {
    id: "node-c",
    group: "compute",
    label: "Node C — server plane",
    labelAr: "العقدة ج — طبقة الخادم",
    qty: 1,
    watts: 85,
    hours: 24,
    wh: 2040,
    firm: true,
    shiftable: false,
    defaultOn: true,
    detail: "CRM · Hermes · Postgres · git mirror · CI · staging",
    detailAr:
      "إدارة العملاء · هيرمس · قاعدة البيانات · مرآة git · التكامل · التجريب",
  },
  {
    id: "storage",
    group: "compute",
    label: "Storage / NAS",
    labelAr: "التخزين",
    qty: 1,
    watts: 30,
    hours: 24,
    wh: 720,
    firm: true,
    shiftable: false,
    defaultOn: true,
    detail: "Package cache, model weights, backup target",
    detailAr: "ذاكرة الحزم وأوزان النماذج والنسخ الاحتياطي",
  },
  {
    id: "network",
    group: "compute",
    label: "Network — router, switch, AP, LTE CPE",
    labelAr: "الشبكة — الموجه والمبدل ونقطة الوصول",
    qty: 1,
    watts: 45,
    hours: 24,
    wh: 1080,
    firm: true,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "misc",
    group: "compute",
    label: "Bench, printer, chargers",
    labelAr: "الطاولة والطابعة والشواحن",
    qty: 1,
    watts: 20,
    hours: 12,
    wh: 240,
    firm: false,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "room-cooling",
    group: "compute",
    label: "Equipment-room free-air cooling",
    labelAr: "تبريد غرفة المعدات بالهواء الحر",
    qty: 1,
    watts: 200,
    hours: 8,
    wh: 1600,
    firm: false,
    shiftable: false,
    defaultOn: true,
    detail: "EC fans — replaces a ~1.2 kW mini-split at 22 °C ambient",
    detailAr: "مراوح بدل مكيف ١٫٢ كيلوواط عند ٢٢ درجة",
  },
  {
    id: "vsat",
    group: "compute",
    label: "VSAT terminal as primary link",
    labelAr: "محطة الأقمار كوصلة أساسية",
    qty: 1,
    watts: 180,
    hours: 24,
    wh: 4320,
    firm: true,
    shiftable: false,
    defaultOn: false,
    detail: "Backup lane. Costs more power than the whole team's laptops",
    detailAr: "وصلة احتياطية — تستهلك أكثر من كل حواسيب الفريق",
  },

  // ── Domestic ──────────────────────────────────────────────────────────
  {
    id: "lighting",
    group: "domestic",
    label: "LED lighting",
    labelAr: "الإضاءة",
    qty: 18,
    watts: 9,
    hours: 5,
    wh: 810,
    firm: true,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "fridges",
    group: "domestic",
    label: "Fridge-freezers (inverter type)",
    labelAr: "الثلاجات",
    qty: 2,
    watts: 42,
    hours: 24,
    wh: 2000,
    firm: true,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "fans",
    group: "domestic",
    label: "Ceiling fans (warm months)",
    labelAr: "مراوح السقف (الأشهر الحارة)",
    qty: 8,
    watts: 50,
    hours: 8,
    wh: 3200,
    firm: false,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "pump",
    group: "domestic",
    label: "Water transfer pump",
    labelAr: "مضخة المياه",
    qty: 1,
    watts: 750,
    hours: 1.5,
    wh: 1125,
    firm: false,
    shiftable: true,
    defaultOn: true,
  },
  {
    id: "washing",
    group: "domestic",
    label: "Washing machine (cold cycles)",
    labelAr: "الغسالة (دورات باردة)",
    qty: 1,
    watts: 400,
    hours: 1.5,
    wh: 600,
    firm: false,
    shiftable: true,
    defaultOn: true,
  },
  {
    id: "kitchen",
    group: "domestic",
    label: "Kitchen smalls — cooking on LPG",
    labelAr: "أدوات المطبخ — الطبخ بالغاز",
    qty: 1,
    watts: 700,
    hours: 1,
    wh: 700,
    firm: false,
    shiftable: false,
    defaultOn: true,
    detail: "Electric cooking would add 3–5 kWh/day and ~$3–4K of PV + battery",
    detailAr: "الطبخ الكهربائي يضيف ٣–٥ ك.و.س يوميًا و٣–٤ آلاف دولار",
  },
  {
    id: "charging",
    group: "domestic",
    label: "Phone / tablet charging",
    labelAr: "شحن الهواتف واللوحيات",
    qty: 1,
    watts: 50,
    hours: 8,
    wh: 400,
    firm: false,
    shiftable: false,
    defaultOn: true,
  },
  {
    id: "dehumidifier",
    group: "domestic",
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
      "Equipment room only. Condensation is the failure mode here, not heat",
    detailAr: "غرفة المعدات فقط — التكثف هو الخطر لا الحرارة",
  },
];

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
  /** Deliberate array oversize — see the doc on why PV beats battery per kWh. */
  pvHeadroom: 1.9,
  /** Contingency on the measured load table to reach the design figure. */
  designMargin: 1.1,
} as const;

export type Sizing = {
  dailyKWh: number;
  designKWh: number;
  firmKWh: number;
  shiftableKWh: number;
  batteryKWh: number;
  pvMinKWp: number;
  pvRecKWp: number;
  arrayAreaM2: number;
};

/**
 * The whole electrical model in one function. Kept pure and exported so the
 * numbers on the page and the numbers in the doc come from one place.
 */
export function computeSizing(selectedIds: ReadonlySet<string>): Sizing {
  let dailyWh = 0;
  let firmWh = 0;
  let shiftableWh = 0;

  for (const row of LOAD_ROWS) {
    if (!selectedIds.has(row.id)) continue;
    dailyWh += row.wh;
    if (row.firm) firmWh += row.wh;
    if (row.shiftable) shiftableWh += row.wh;
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
    shiftableKWh: shiftableWh / 1000,
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
    value: "~22 °C — no general AC",
    valueAr: "٢٢° — بلا تكييف عام",
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
    label: "Seats",
    labelAr: "المقاعد",
    value: "7, live-in",
    valueAr: "٧ مع السكن",
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
    name: "Anchor node + server plane",
    nameAr: "العقدة الأساسية وطبقة الخادم",
    what: "5 kWp PV, 15 kWh battery, one 5 kW hybrid, mast + LTE, Node C. CRM, Hermes, git mirror, cache and staging all move local. 2 seats.",
    whatAr:
      "٥ ك.و.ذ ألواح، بطارية ١٥ ك.و.س، عاكس ٥ ك.و، برج واتصال، العقدة ج. نقل العملاء وهيرمس وgit والتجريب محليًا. مقعدان.",
    capex: "$10,000–15,000",
    trigger: "First paying school, or non-dilutive funding",
    triggerAr: "أول مدرسة مدفوعة أو تمويل غير مخفِّض",
    now: false,
  },
  {
    n: "3",
    name: "Local inference",
    nameAr: "الاستدلال المحلي",
    what: "Node A, PV to 12 kWp, battery to 30 kWh, second inverter.",
    whatAr: "العقدة أ، الألواح إلى ١٢ ك.و.ذ، البطارية إلى ٣٠ ك.و.س، عاكس ثانٍ.",
    capex: "$10,000–15,000",
    trigger: "3 paying schools / ~$3K MRR sustained 3 months",
    triggerAr: "٣ مدارس مدفوعة أو ٣ آلاف دولار شهريًا لثلاثة أشهر",
    now: false,
  },
  {
    n: "4",
    name: "Full hub + media lane",
    nameAr: "المقر الكامل ومسار الوسائط",
    what: "Node B, 7 seats, housing, PV to 16 kWp, battery to 40 kWh, third inverter.",
    whatAr:
      "العقدة ب، ٧ مقاعد، السكن، الألواح إلى ١٦ ك.و.ذ، البطارية إلى ٤٠ ك.و.س، عاكس ثالث.",
    capex: "$15,000–30,000",
    trigger:
      "Media volume measurably justifies it — at ~$50–100/mo of current spend, this does not pay back",
    triggerAr:
      "أن يبرره حجم الوسائط فعليًا — عند إنفاق ٥٠–١٠٠ دولار شهريًا لا يسترد",
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
      "12 months of measured site uptime, and a customer who wants on-prem and pays for it",
    triggerAr: "١٢ شهرًا من التشغيل المُقاس وعميل يطلب الاستضافة المحلية ويدفع",
    now: false,
  },
];

// ── The model ladder ────────────────────────────────────────────────────

export type ModelRow = {
  klass: string;
  klassAr: string;
  weights: string;
  fits: string;
  fitsAr: string;
  verdict: string;
  verdictAr: string;
  target: boolean;
};

export const MODEL_LADDER: ModelRow[] = [
  {
    klass: "20–30B coder",
    klassAr: "٢٠–٣٠ مليار",
    weights: "12–18 GB",
    fits: "Any 24 GB GPU, 64 GB Mac",
    fitsAr: "أي معالج ٢٤ ج.ب أو ماك ٦٤ ج.ب",
    verdict: "Fast, fine for the volume lane",
    verdictAr: "سريع ويكفي المسار الكثيف",
    target: false,
  },
  {
    klass: "80B-class coder",
    klassAr: "٨٠ مليار",
    weights: "~45 GB",
    fits: "256 GB Mac / 96 GB GPU",
    fitsAr: "ماك ٢٥٦ ج.ب أو معالج ٩٦ ج.ب",
    verdict: "The target — best quality that still prefills fast",
    verdictAr: "الهدف — أفضل جودة مع معالجة سياق سريعة",
    target: true,
  },
  {
    klass: "235B MoE",
    klassAr: "٢٣٥ مليار",
    weights: "~120–140 GB",
    fits: "256 GB Mac / 2× 96 GB GPU",
    fitsAr: "ماك ٢٥٦ ج.ب أو معالجان ٩٦ ج.ب",
    verdict: "Possible; prefill starts to hurt",
    verdictAr: "ممكن لكن معالجة السياق تثقل",
    target: false,
  },
  {
    klass: "671B MoE",
    klassAr: "٦٧١ مليار",
    weights: "~404 GB",
    fits: "512 GB Mac only",
    fitsAr: "ماك ٥١٢ ج.ب فقط",
    verdict: "Trophy. ~14 min to ingest an 8k prompt — unusable for agents",
    verdictAr: "للعرض فقط — ١٤ دقيقة لاستيعاب ٨ آلاف رمز",
    target: false,
  },
];
