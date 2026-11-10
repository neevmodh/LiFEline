import type { Metadata, Viewport } from "next";
import { PwaSupport } from "@/components/PwaSupport";
import { Geist, Geist_Mono, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from "next/font/google";
import { I18nProvider } from "@/i18n";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Gujarati and Hindi script, used when the UI language is switched.
const notoGujarati = Noto_Sans_Gujarati({ variable: "--font-gujarati", subsets: ["gujarati"] });
const notoDevanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: "Nidhi - Mission LiFE companion",
  description:
    "Track your household carbon footprint, get timely energy-saving nudges, and see what rooftop solar would save you.",
  appleWebApp: { capable: true, title: "Nidhi", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a8157",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${notoGujarati.variable} ${notoDevanagari.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
          <PwaSupport />
        </I18nProvider>
      </body>
    </html>
  );
}
