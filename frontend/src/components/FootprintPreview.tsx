"use client";

import { useEffect, useState } from "react";
import { FootprintBar } from "@/components/FootprintBar";
import { Card, fmt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type Discom, type Footprint, type FootprintInput, type TariffArea } from "@/lib/api";

/** Live footprint for the household form, debounced so typing doesn't spam the API. */
export function FootprintPreview({
  input,
  baselineKg,
}: {
  input: FootprintInput & { discom?: Discom; area?: TariffArea };
  baselineKg?: number;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<Footprint | null>(null);
  const { monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day, discom, area } = input;

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .previewFootprint({ monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day, discom, area })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [monthly_kwh, members, lpg_cylinders_per_month, commute_mode, commute_km_per_day, discom, area]);

  const change = preview && baselineKg ? ((preview.total_kg - baselineKg) / baselineKg) * 100 : null;

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("footprint.title")}</p>
      {preview ? (
        <>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{fmt.kg(preview.total_kg)}</p>
          <p className="text-sm text-muted">{t("footprint.perMonth", { perPerson: fmt.kg(preview.per_capita_kg) })}</p>
          {change !== null && Math.abs(change) >= 0.5 && (
            <p className={`mt-1 text-xs font-medium ${change < 0 ? "text-brand" : "text-danger"}`}>
              {t("footprint.vsBaseline", { change: `${change > 0 ? "+" : ""}${change.toFixed(0)}` })}
            </p>
          )}
          <div className="mt-5">
            <FootprintBar footprint={preview} />
          </div>
          <p className="mt-5 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            {t("footprint.bill")} <strong>{fmt.rs(preview.monthly_bill_rs)}</strong>{t("footprint.perMonthSuffix")}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">{t("footprint.empty")}</p>
      )}
    </Card>
  );
}
