export interface GoogleDraftParams {
  product: string;
  brief: string;
  angle?: string;
  register?: number;
}

export interface GoogleDraftResult {
  ok: boolean;
  ar?: string;
  en?: string;
  error?: string;
}

const BRAND_CONTEXTS: Record<string, string> = {
  hogwarts:
    "hogwarts — school management SaaS (multi-tenant SIS/LMS: admission, attendance, timetable, exams, grades, finance). Audience: school owners, principals, and operators in MENA.",
  mkan: "mkan (مكان) — rental marketplace for property listings and bookings.",
  databayt:
    "databayt — the company itself: open source, the sharing-economy doctrine, engineering craft.",
  sijillee: "sijillee (سِجلي) — records/documents product.",
  moalimee: "moalimee (مُعلّمي) — teacher/tutor marketplace.",
};

export async function draftWithGeminiFree(
  params: GoogleDraftParams,
): Promise<GoogleDraftResult> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not configured." };
  }

  const brandContext =
    BRAND_CONTEXTS[params.product] ??
    `${params.product} — SaaS product by Databayt.`;

  const prompt = `You are Databayt's lead social media writer for MENA.
Write a social media post for product: ${params.product}.
Product description: ${brandContext}
User Brief: ${params.brief}
Angle directive: ${params.angle ?? "Choose the best angle (pain, moment, or proof)"}
Arabic Register directive: Rung ${params.register ?? 2} (2=simplified MSA, 3=pan-Arab, 4=Sudanese dialect)

House Rules:
- Return ONLY valid JSON with keys "ar" and "en".
- Arabic copy ("ar"): Write native, engaging Arabic (300-600 characters). Use Latin digits (1, 2, 3) rather than Arabic-Indic digits (١, ٢, ٣). No "🚀" or clickbait.
- English copy ("en"): Parallel English post (300-600 characters). Plain, concrete, confident.
- Format: {"ar": "...", "en": "..."}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Gemini API HTTP ${res.status}: ${errText}` };
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { ok: false, error: "Empty response from Gemini API." };
    }

    const parsed = JSON.parse(text) as { ar?: string; en?: string };
    if (!parsed.ar || !parsed.en) {
      return { ok: false, error: "Invalid JSON structure from Gemini API." };
    }

    return {
      ok: true,
      ar: parsed.ar.trim(),
      en: parsed.en.trim(),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to draft with Gemini.",
    };
  }
}
