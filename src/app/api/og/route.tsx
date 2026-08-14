import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const SITE_NAME = "Kun, the Code Machine";

function clamp(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const title = clamp(searchParams.get("title") || "Documentation", 80);
  const description = clamp(searchParams.get("description") || "", 150);
  const eyebrow = clamp(searchParams.get("eyebrow") || "DOCUMENTATION", 40);

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#09090b",
        color: "#fafafa",
        padding: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 24,
          letterSpacing: 4,
          color: "#a1a1aa",
        }}
      >
        {eyebrow}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 86, lineHeight: 1.1 }}>
          {title}
        </div>
        {description ? (
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: "#a1a1aa",
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", fontSize: 30 }}>
        {SITE_NAME}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
