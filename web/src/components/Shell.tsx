"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/i18n";

/** The sprout coin: Nidhi means treasure, and it is the same coin people earn in the app. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="28" fill="#E9B872" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#C9873E" strokeWidth="3" />
      <path d="M32 46V30" stroke="#23312A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 34c-8 0-12-5-12-12 7 0 12 4 12 12z" fill="#4E7D5E" />
      <path d="M32 30c0-8 5-13 13-13 0 8-5 13-13 13z" fill="#3F6B4E" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight ${light ? "text-[#f6f2ea]" : "text-text"}`}>
      <LogoMark />
      Nidhi
    </Link>
  );
}

/** The programme strip across the top of every screen: agency name in English and Gujarati. */
export function GedaStrip() {
  return (
    <div className="geda-strip px-4 py-1.5 text-xs sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4">
        <span>Gujarat Energy Development Agency · Mission LiFE</span>
        <span lang="gu" className="hidden sm:inline">ગુજરાત ઊર્જા વિકાસ એજન્સી</span>
      </div>
    </div>
  );
}

export function WaveEdge({ fill = "#f6f2ea" }: { fill?: string }) {
  return (
    <svg className="hero-wave" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden>
      <path fill={fill} d="M0 24 C 120 4 240 44 360 24 S 600 4 720 24 S 960 44 1080 24 S 1320 4 1440 24 S 1680 44 1800 24 S 2040 4 2160 24 S 2400 44 2520 24 S 2760 4 2880 24 V40 H0z" />
    </svg>
  );
}

export { LanguageSwitcher };
