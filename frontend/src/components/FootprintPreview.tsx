"use client";

import { useEffect, useState } from "react";
import { FootprintBar } from "@/components/FootprintBar";
import { Card, fmt } from "@/components/ui";
import { api, type Footprint, type FootprintInput } from "@/lib/api";

/** Live footprint for the household form, debounced so typing doesn't spam the API. */
export function FootprintPreview({ input, baselineKg }: { input: FootprintInput; baselineKg?: number }) {
  const [preview, setPreview] = useState<Footprint | null>(null);
  const { monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day } = input;

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .previewFootprint({ monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day]);

  const change = preview && baselineKg ? ((preview.total_kg - baselineKg) / baselineKg) * 100 : null;

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Your monthly footprint</p>
      {preview ? (
        <>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{fmt.kg(preview.total_kg)}</p>
          <p className="text-sm text-muted">CO₂ per month · {fmt.kg(preview.per_capita_kg)} per person</p>
          {change !== null && Math.abs(change) >= 0.5 && (
            <p className={`mt-1 text-xs font-medium ${change < 0 ? "text-brand" : "text-danger"}`}>
              {change > 0 ? "+" : ""}
              {change.toFixed(0)}% vs your saved baseline
            </p>
          )}
          <div className="mt-5">
            <FootprintBar footprint={preview} />
          </div>
          <p className="mt-5 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            Estimated electricity bill: <strong>{fmt.rs(preview.monthly_bill_rs)}</strong>/month
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Fill in the form to see your footprint.</p>
      )}
    </Card>
  );
}
