import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="en" className={`${jakarta.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-ink-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
