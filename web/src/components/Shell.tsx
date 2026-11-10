"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/i18n";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 text-xl font-bold tracking-tight ${light ? "text-white" : "text-text"}`}>
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0a8157] to-[#34b27a] text-white shadow-[var(--shadow)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 21c0-9 5-15 15-16-1 10-7 15-16 15" />
          <path d="M5 21 13 13" />
        </svg>
      </span>
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

export function WaveEdge({ fill = "#f4f9f7" }: { fill?: string }) {
  return (
    <svg className="hero-wave" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden>
      <path fill={fill} d="M0 24 C 120 4 240 44 360 24 S 600 4 720 24 S 960 44 1080 24 S 1320 4 1440 24 S 1680 44 1800 24 S 2040 4 2160 24 S 2400 44 2520 24 S 2760 4 2880 24 V40 H0z" />
    </svg>
  );
}

export { LanguageSwitcher };
