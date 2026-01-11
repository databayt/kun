import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout - HTML structure is handled in [lang]/layout.tsx
  // This allows for proper language and RTL support
  return children;
}
