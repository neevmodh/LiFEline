import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from "next/font/google";
import { I18nProvider } from "@/i18n";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Gujarati and Hindi script, used when the UI language is switched.
const notoGujarati = Noto_Sans_Gujarati({ variable: "--font-gujarati", subsets: ["gujarati"] });
const notoDevanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: "Nidhi - turn your electricity bill into savings",
  description:
    "Scan your electricity bill and see what you could save in rupees every month, with a plan for your home. A Mission LiFE companion for Gujarat.",
  icons: { icon: "/icons/logo.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#f6f2ea" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${geistMono.variable} ${notoGujarati.variable} ${notoDevanagari.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
