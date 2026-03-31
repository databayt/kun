import "./globals.css";
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Kun - The Software Company Engine",
    template: "%s | Kun"
  },
  description: "The Software Company Engine - كن (Be!)",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
