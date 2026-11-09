import type { CSSProperties, ReactNode } from "react";

const BUBBLES: { left: string; s: number; d: number; l: number; x: number }[] = [
  { left: "6%", s: 14, d: 11, l: -2, x: 30 },
  { left: "17%", s: 8, d: 8, l: -6, x: -20 },
  { left: "31%", s: 20, d: 14, l: -9, x: 40 },
  { left: "47%", s: 10, d: 9, l: -1, x: -30 },
  { left: "62%", s: 16, d: 12, l: -7, x: 25 },
  { left: "76%", s: 9, d: 10, l: -4, x: -35 },
  { left: "90%", s: 12, d: 9, l: -3, x: -25 },
];

/** Rising bubbles; purely decorative. */
export function Bubbles({ count = BUBBLES.length, rise = 420 }: { count?: number; rise?: number }) {
  return (
    <>
      {BUBBLES.slice(0, count).map((b, i) => (
        <span
          key={i}
          aria-hidden
          className="bubble"
          style={{ left: b.left, "--s": `${b.s}px`, "--d": `${b.d}s`, "--l": `${b.l}s`, "--x": `${b.x}px`, "--rise": `${rise}px` } as CSSProperties}
        />
      ))}
    </>
  );
}

/** Water surface: light rays and caustics under the content, a wave along the bottom edge. */
export function OceanBand({
  children,
  className = "",
  waveColor = "#f5faf7",
  rays = true,
  abyss = false,
  rise = 420,
}: {
  children: ReactNode;
  className?: string;
  /** Fill of the wave along the bottom edge: the colour of whatever follows. */
  waveColor?: string | null;
  rays?: boolean;
  abyss?: boolean;
  rise?: number;
}) {
  return (
    <div className={`ocean-band ${abyss ? "abyss" : ""} ${className}`}>
      {rays && <div className="rays" aria-hidden />}
      <div className="caustic" aria-hidden />
      <Bubbles rise={rise} />
      <div className="relative z-10">{children}</div>
      {waveColor && (
        <svg className="wave-edge" viewBox="0 0 1440 44" preserveAspectRatio="none" aria-hidden>
          <path
            fill={waveColor}
            d="M0 26 C 120 4 240 48 360 26 S 600 4 720 26 S 960 48 1080 26 S 1320 4 1440 26 S 1680 48 1800 26 S 2040 4 2160 26 S 2400 48 2520 26 S 2760 4 2880 26 V44 H0z"
          />
        </svg>
      )}
    </div>
  );
}

/** The programme strip across the top of every screen: agency name, English and Gujarati. */
export function GedaStrip() {
  return (
    <div className="geda-strip px-4 py-1.5 text-xs sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4">
        <span>Gujarat Energy Development Agency · Mission LiFE</span>
        <span lang="gu" className="hidden sm:inline">ગુજરાત ઊર્જા વિકાસ એજન્સી</span>
      </div>
    </div>
  );
}

/** Full-screen water behind a centred card: sign-in, sign-up and the role picker. */
export function OceanPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <GedaStrip />
      <OceanBand className="flex flex-1 flex-col" waveColor={null} rise={700}>
        <div className="flex min-h-[calc(100vh-30px)] flex-col items-center justify-center px-4 py-10">{children}</div>
      </OceanBand>
    </div>
  );
}
