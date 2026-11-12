"use client";

// Measure your roof: tap its corners on a satellite map and Nidhi works out the area, then hands it back
// to the app's solar check (?return=…, Nidhi's own addresses only). Opened from the app; works alone too.
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { useI18n } from "@/i18n";
import { APP_URL } from "@/lib/links";
import { polygonAreaSqm, returnUrl, roofAreaForCalculator, type LatLng } from "@/lib/roof";

const RoofMap = dynamic(() => import("@/components/map/RoofMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

const GUJARAT: LatLng = [23.03, 72.58]; // Ahmedabad, until the person's own place is known

function RoofMeasurer() {
  const { t } = useI18n();
  const params = useSearchParams();
  const start = useMemo<LatLng>(() => {
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    return Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0 ? [lat, lon] : GUJARAT;
  }, [params]);
  const [center, setCenter] = useState<LatLng>(start);
  const [points, setPoints] = useState<LatLng[]>([]);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const area = Math.round(polygonAreaSqm(points));
  const usable = roofAreaForCalculator(points);

  function locate() {
    if (!navigator.geolocation) return setNote(t("roof.noLocation"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setNote(t("roof.noLocation"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function useArea() {
    if (usable === null) return;
    window.location.href = returnUrl(params.get("return"), usable, `${APP_URL.replace(/\/$/, "")}/solar`);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- the small static logo */}
        <img src="/logo.png" alt="" width={36} height={36} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">{t("roof.title")}</h1>
          <p className="text-sm text-muted">{t("roof.how")}</p>
        </div>
        <button onClick={locate} disabled={locating} className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60">
          {locating ? t("roof.locating") : t("roof.locate")}
        </button>
      </header>

      {/* The map fills this box absolutely: a percentage height inside a min-height box would be 0. */}
      <div className="relative min-h-[55dvh] flex-1">
        <div className="absolute inset-0">
          <RoofMap center={center} points={points} onTap={(p) => setPoints((all) => [...all, p])} />
        </div>
      </div>

      <footer className="sticky bottom-0 z-[500] flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 sm:px-6" aria-live="polite">
        <div className="min-w-[10rem] flex-1">
          <p className="text-2xl font-bold tabular-nums">{points.length >= 3 ? `${area.toLocaleString("en-IN")} m²` : "—"}</p>
          <p className="text-xs text-muted">{points.length >= 3 ? t("roof.areaNote") : t("roof.points", { n: points.length })}</p>
          {note && <p className="text-xs text-danger">{note}</p>}
          {points.length >= 3 && usable === null && <p className="text-xs text-danger">{t("roof.tooBig")}</p>}
        </div>
        <button onClick={() => setPoints((all) => all.slice(0, -1))} disabled={!points.length} className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-40">
          {t("roof.undo")}
        </button>
        <button onClick={() => setPoints([])} disabled={!points.length} className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-40">
          {t("roof.clear")}
        </button>
        <button onClick={useArea} disabled={usable === null} className="min-h-11 rounded-full bg-navy px-5 text-sm font-semibold text-[#f6f2ea] disabled:opacity-40">
          {t("roof.use")}
        </button>
      </footer>
    </main>
  );
}

export default function RoofPage() {
  return (
    <Suspense fallback={null}>
      <RoofMeasurer />
    </Suspense>
  );
}
