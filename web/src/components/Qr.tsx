"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR code for `value`, drawn as inline SVG so it stays sharp when projected. */
export function Qr({ value, label, size = 168 }: { value: string; label: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", margin: 1, color: { dark: "#0b2a5b", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(null));
    return () => {
      live = false;
    };
  }, [value]);
  return (
    <div role="img" aria-label={label} style={{ width: size, height: size }} className="rounded-2xl bg-white p-2"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
  );
}
