"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/i18n";

/** Nidhi's logo: leaves around a home with rooftop solar, a wind turbine and the sun, and the name. */
export function LogoMark({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small static logo, sized here
  return <img src="/logo.png" alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

/** The logo as a link home. On a dark band it sits on a white chip so the green lettering stays readable. */
export function Logo({ light = false, size = 52 }: { light?: boolean; size?: number }) {
  return (
    <Link href="/" aria-label="Nidhi home" className={`flex items-center ${light ? "rounded-2xl bg-white p-1 shadow-[var(--shadow)]" : ""}`}>
      <LogoMark size={size} />
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
