import type { Metadata } from "next";
import { branding } from "@/config/branding";
import { BrandStyle } from "@/components/BrandStyle";
import "./globals.css";

export const metadata: Metadata = {
  title: `${branding.businessName} — POS & Manager`,
  description: branding.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <BrandStyle />
      </head>
      <body>{children}</body>
    </html>
  );
}
