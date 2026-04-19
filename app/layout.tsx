import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Bayi Yönetimi Platformu", template: "%s — Bayi Yönetimi Platformu" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
