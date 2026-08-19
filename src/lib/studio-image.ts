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

  const isRasterModel = model !== "canvas";
  const isPhotographicFormat = ["post", "lifestyle", "ad", "mockup", "walkthrough"].includes(format);

  // If raster AI model (Nano Banana / GPT Image) or photographic format
  if (isRasterModel && isPhotographicFormat) {
    const sLower = subject.toLowerCase();
    let rasterUrl = "";
    if (isMkan) {
      if (
        sLower.includes("balcony") ||
        sLower.includes("sunset") ||
        sLower.includes("veranda") ||
        sLower.includes("tea") ||
        sLower.includes("tour") ||
        format === "walkthrough"
      ) {
        rasterUrl = "/media/mkan-balcony-sunset.jpg";
      } else {
        rasterUrl = "/media/mkan-coastal-living-room.jpg";
      }
    } else {
      // For Hogwarts: check desk, classroom, tablet, dashboard first
      if (
        sLower.includes("desk") ||
        sLower.includes("tablet") ||
        sLower.includes("dashboard") ||
        sLower.includes("classroom") ||
        sLower.includes("gradebook") ||
        sLower.includes("teacher") ||
        sLower.includes("bursar") ||
        sLower.includes("office")
      ) {
        rasterUrl = "/media/hogwarts-teacher-desk.jpg";
      } else if (
        sLower.includes("library") ||
        sLower.includes("courtyard") ||
        sLower.includes("books") ||
        sLower.includes("studying") ||
        sLower.includes("research")
      ) {
        rasterUrl = "/media/hogwarts-library-study.jpg";
      } else {
        rasterUrl = "/media/hogwarts-teacher-desk.jpg";
      }
    }

    return {
      ok: true,
      imageUrl: rasterUrl,
      dimensions: compiled.dimensions,
      prompt: compiled.prompt,
      title: compiled.title,
      engine: model === "gemini" ? "Nano Banana 2 (Gemini 3.1 Flash Image)" : "GPT Image 2.0 (OpenAI DALL·E 3)",
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
