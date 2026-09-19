import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = "https://cymru-intelligence.wales";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cymru Intelligence | A clearer view of a stronger Wales",
  description:
    "Cymru Intelligence brings together trusted data on Welsh businesses, planning, contracts, funding and economic activity.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Cymru Intelligence | A clearer view of a stronger Wales",
    description:
      "Cymru Intelligence brings together trusted data on Welsh businesses, planning, contracts, funding and economic activity.",
    url: siteUrl,
    siteName: "Cymru Intelligence",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cymru Intelligence | A clearer view of a stronger Wales",
    description:
      "Cymru Intelligence brings together trusted data on Welsh businesses, planning, contracts, funding and economic activity.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-ink-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
