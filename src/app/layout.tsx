import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { fontVariables } from "@/components/atom/fonts";
import { cn } from "@/lib/utils";

const SITE_NAME = "Kun, the Code Machine";
const SITE_URL = "https://kun.databayt.org";
const SITE_DESCRIPTION =
  "Kun (كن) is a code machine that collapses time between idea and product.";
const SITE_OG_IMAGE = `/api/og?eyebrow=${encodeURIComponent("THE CODE MACHINE")}&title=${encodeURIComponent("Kun")}&description=${encodeURIComponent(SITE_DESCRIPTION)}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body
        className={cn(
          fontVariables,
          "group/body overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] [--header-height:calc(var(--spacing)*14)]",
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
