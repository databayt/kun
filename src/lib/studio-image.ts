import { compileMediaStudioPrompt, type MediaStudioRatio } from "./brand-kit";

export interface GenerateStudioImageInput {
  brand: string;
  format: string;
  ratio: MediaStudioRatio;
  subject: string;
  model?: string;
  spine?: string;
}

export interface GenerateStudioImageResult {
  ok: boolean;
  error?: string;
  imageUrl?: string;
  dimensions?: string;
  prompt?: string;
  title?: string;
  engine?: string;
  briefId?: string;
  /** False when `imageUrl` is not a publishable absolute URL (or absent). */
  attachable?: boolean;
  /** Why it is not attachable, and what to do instead. */
  attachNote?: string;
}

export function generateStudioImageCore(
  input: GenerateStudioImageInput,
): GenerateStudioImageResult {
  const { brand, format, ratio, subject, model = "gemini", spine } = input;
  if (!subject.trim()) {
    return { ok: false, error: "Subject cannot be empty." };
  }

  const compiled = compileMediaStudioPrompt({
    brand,
    kind: format === "walkthrough" ? "video" : "image",
    format,
    subject: subject.trim(),
    ratio,
    spine,
    model,
  });

  const [widthStr, heightStr] = compiled.dimensions.split(/[x×]/);
  const width = parseInt(widthStr, 10) || 1080;
  const height = parseInt(heightStr, 10) || 1350;

  const isMkan = brand === "mkan";
  const bg = isMkan ? "#faf8f5" : "#faf9f5";
  const textColor = isMkan ? "#1a1815" : "#141413";
  const accent = compiled.accentHex || (isMkan ? "#e05638" : "#d97757");
  const brandTitle = isMkan ? "MKAN · PORT SUDAN" : "HOGWARTS · SCHOOL SIS";
  const domain = compiled.domain;

  // The studio does not render anything. It compiles a prompt, and for the two
  // brands with curated stills on disk it offers the closest one as a starting
  // point. A badge naming a model that never ran is the exact dishonesty the
  // `--source` rule in content/docs/media.mdx exists to prevent, so the label
  // below always says where the pixels actually came from.
  const LIBRARY: Record<
    string,
    { match: (subject: string) => boolean; file: string }[]
  > = {
    mkan: [
      {
        match: (t) =>
          ["balcony", "sunset", "veranda", "tea", "tour"].some((k) =>
            t.includes(k),
          ),
        file: "mkan-balcony-sunset.jpg",
      },
      { match: () => true, file: "mkan-coastal-living-room.jpg" },
    ],
    hogwarts: [
      {
        match: (t) =>
          [
            "desk",
            "tablet",
            "dashboard",
            "classroom",
            "gradebook",
            "teacher",
            "bursar",
            "office",
          ].some((k) => t.includes(k)),
        file: "hogwarts-teacher-desk.jpg",
      },
      {
        match: (t) =>
          ["library", "courtyard", "books", "studying", "research"].some((k) =>
            t.includes(k),
          ),
        file: "hogwarts-library-study.jpg",
      },
      { match: () => true, file: "hogwarts-teacher-desk.jpg" },
    ],
  };

  // An unrecognised format used to fall through to the template plate, so a
  // video request that arrived with format "" came back as a deterministic
  // card. Refuse instead of guessing — a wrong asset is worse than no asset.
  const KNOWN_FORMATS = [
    "walkthrough",
    "post",
    "lifestyle",
    "ad",
    "mockup",
    "infographic",
    "carousel",
    "testimonial",
  ];
  if (!KNOWN_FORMATS.includes(format)) {
    return { ok: false, error: `Unknown format: ${format || "(empty)"}` };
  }

  const kind = format === "walkthrough" ? "video" : "image";
  const wantsPhotographic = ["post", "lifestyle", "ad", "mockup"].includes(
    format,
  );

  // Video used to fall through to the stills table, so picking Seedance or Veo
  // returned a JPG. No video renderer is reachable from a Server Action; the
  // compiled prompt is the whole deliverable here.
  if (kind === "video") {
    return {
      ok: true,
      prompt: compiled.prompt,
      title: compiled.title,
      engine: "Prompt only — no video renderer is wired to this surface",
      attachable: false,
      attachNote:
        "Run the compiled prompt through scripts/video-media.mjs or scripts/gemini-media.mjs, then add the result to the library.",
    };
  }

  if (wantsPhotographic) {
    const shelf = LIBRARY[brand];
    // Brands added after the stills were curated (balqalam, databayt) have no
    // shelf. Previously every non-Mkan brand silently borrowed Hogwarts'.
    if (!shelf) {
      return {
        ok: true,
        prompt: compiled.prompt,
        title: compiled.title,
        engine: `Prompt only — no library stills exist for ${brand}`,
        attachable: false,
        attachNote:
          "Pick an asset from the showroom, or render the compiled prompt and add it to the library.",
      };
    }
    const needle = subject.toLowerCase();
    const file = shelf.find((entry) => entry.match(needle))!.file;
    return {
      ok: true,
      imageUrl: `/media/${file}`,
      // Deliberately no `dimensions`: these are fixed files on disk and are not
      // resized to the requested ratio, so reporting the request would be wrong.
      prompt: compiled.prompt,
      title: compiled.title,
      engine: `Library asset · ${file}`,
      attachable: false,
      attachNote:
        "Repo-relative placeholder, not a publishable URL. Attach from the showroom instead.",
    };
  }

  // Escape special xml characters
  const escapeXml = (unsafe: string) =>
    unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
        default:
          return c;
      }
    });

  const escapedScene = escapeXml(compiled.beats.scene);
  const escapedLighting = escapeXml(compiled.beats.lightingAtmosphere);

  // Generate a high-resolution visual card SVG plate
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${isMkan ? "#f0ebe1" : "#ece5d8"}"/>
      </linearGradient>
    </defs>
    
    <rect width="${width}" height="${height}" fill="url(#cardGrad)"/>
    <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="24" fill="none" stroke="${accent}" stroke-opacity="0.3" stroke-width="3"/>
    
    <g transform="translate(64, 64)">
      <rect x="0" y="0" width="240" height="44" rx="22" fill="${accent}" fill-opacity="0.15"/>
      <text x="120" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="1">${brandTitle}</text>
      
      <text x="${width - 128}" y="27" font-family="monospace" font-size="15" font-weight="600" fill="${textColor}" fill-opacity="0.5" text-anchor="end">${(compiled.format || format).toUpperCase()} · ${compiled.ratio}</text>

      <foreignObject x="0" y="90" width="${width - 128}" height="${height - 300}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color: ${textColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif; font-size: ${width > 1100 ? "32px" : "28px"}; font-weight: 700; line-height: 1.4; padding: 10px 0;">
          <p style="margin: 0 0 24px 0; color: ${textColor};">${escapedScene}</p>
          
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px;">
            ${
              isMkan
                ? `<span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">⚡ 24/7 Standby Power</span>
                   <span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">❄️ Split AC in All Rooms</span>
                   <span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">🌊 Red Sea Coast</span>
                   <span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">📶 High-Speed Wi-Fi</span>`
                : `<span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">📊 98% On-Time Fees</span>
                   <span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">📱 WhatsApp Invoices</span>
                   <span style="background: rgba(0,0,0,0.06); padding: 10px 20px; border-radius: 999px; font-size: 15px; font-weight: 600;">⚡ Zero Paperwork</span>`
            }
          </div>
        </div>
      </foreignObject>

      <g transform="translate(0, ${height - 180})">
        <line x1="0" y1="0" x2="${width - 128}" y2="0" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>
        <text x="0" y="36" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="${textColor}" fill-opacity="0.6">${escapedLighting}</text>
        <text x="${width - 128}" y="36" font-family="monospace" font-size="16" font-weight="700" fill="${accent}" text-anchor="end">${domain}</text>
      </g>
    </g>
  </svg>`;

  const svgBase64 = Buffer.from(svg).toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return {
    ok: true,
    imageUrl: dataUrl,
    dimensions: compiled.dimensions,
    prompt: compiled.prompt,
    title: compiled.title,
    engine: "Deterministic HTML Canvas Engine",
  };
}
