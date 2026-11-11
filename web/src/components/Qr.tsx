"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * A QR code for `value`, drawn as inline SVG so it stays sharp when projected, with Nidhi's logo in
 * the middle. The highest error correction keeps it readable with the logo covering the centre.
 */
export function Qr({ value, label, size = 168 }: { value: string; label: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "H", color: { dark: "#23312a", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(null));
    return () => {
      live = false;
    };
  }, [value]);
  const logo = Math.round(size * 0.24);
  return (
    <div role="img" aria-label={label} style={{ width: size, height: size }} className="relative shrink-0 rounded-2xl bg-white p-2 shadow-[var(--shadow)]">
      <div className="h-full w-full" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
      {svg && (
        <span className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-white p-1" style={{ width: logo + 8, height: logo + 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the small static logo */}
          <img src="/logo.png" alt="" width={logo} height={logo} />
        </span>
      )}
    </div>
  );
}
