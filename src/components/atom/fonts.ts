import {
  Geist_Mono as FontMono,
  Geist as FontSans,
  Rubik,
} from "next/font/google";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

export const fontRubik = Rubik({
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
});

// Thmanyah — خط ثمانية (Arabic + Latin), the databayt Arabic voice.
// Files are git-ignored and fetched from the official host by
// scripts/fetch-thmanyah.mjs (predev/prebuild) — the license permits
// embedding but forbids redistribution. See public/fonts/thmanyah/README.md.
export const fontThmanyahSans = localFont({
  src: [
    { path: "../../../public/fonts/thmanyah/thmanyah-sans-300.woff2", weight: "300" },
    { path: "../../../public/fonts/thmanyah/thmanyah-sans-400.woff2", weight: "400" },
    { path: "../../../public/fonts/thmanyah/thmanyah-sans-500.woff2", weight: "500" },
    { path: "../../../public/fonts/thmanyah/thmanyah-sans-700.woff2", weight: "700" },
  ],
  variable: "--font-thmanyah-sans",
  display: "swap",
});

export const fontThmanyahDisplay = localFont({
  src: [
    {
      path: "../../../public/fonts/thmanyah/thmanyah-serif-display-400.woff2",
      weight: "400",
    },
  ],
  variable: "--font-thmanyah-display",
  display: "swap",
});

export const fontThmanyahText = localFont({
  src: [
    {
      path: "../../../public/fonts/thmanyah/thmanyah-serif-text-300.woff2",
      weight: "300",
    },
    {
      path: "../../../public/fonts/thmanyah/thmanyah-serif-text-400.woff2",
      weight: "400",
    },
    {
      path: "../../../public/fonts/thmanyah/thmanyah-serif-text-500.woff2",
      weight: "500",
    },
    {
      path: "../../../public/fonts/thmanyah/thmanyah-serif-text-700.woff2",
      weight: "700",
    },
    {
      path: "../../../public/fonts/thmanyah/thmanyah-serif-text-900.woff2",
      weight: "900",
    },
  ],
  variable: "--font-thmanyah-text",
  display: "swap",
});

export const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontRubik.variable,
  fontThmanyahSans.variable,
  fontThmanyahDisplay.variable,
  fontThmanyahText.variable,
);
