import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource/arimo/400.css";
import "@fontsource/arimo/700.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = {
  title: "Invoice Generator",
  description: "Repair and maintenance invoice generator",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Suspense fallback={<div className="h-12 border-b border-zinc-200 bg-white" />}>
          <AppHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
