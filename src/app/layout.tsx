import "./globals.css";
import type { Metadata } from "next"
import { Providers } from "@/components/providers"
import { fontVariables } from "@/components/atom/fonts"
import { cn } from "@/lib/utils"

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
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={cn(fontVariables, "group/body overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] [--header-height:calc(var(--spacing)*14)]")}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
