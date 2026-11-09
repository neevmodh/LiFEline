"use client";

import { Badge, Card, CardTitle, fmt } from "@/components/ui";
import type { WeatherInsight } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

const MODEL_NOTE: Record<NonNullable<WeatherInsight["model"]>["source"], MessageKey> = {
  household: "weather.model.household",
  district: "weather.model.district",
  state: "weather.model.state",
  none: "weather.model.none",
};

/** Real savings once the weather is taken out: a cool month isn't a saving, a heatwave isn't a failure. */
export function WeatherCard({ insight }: { insight: WeatherInsight | null }) {
  const { t } = useI18n();
  if (!insight) return null;
  const latest = insight.months.at(-1);

  return (
    <Card>
      <CardTitle aside={<Badge tone="muted">{t("weather.badge")}</Badge>}>{t("weather.title")}</CardTitle>
      {!insight.available || !latest ? (
        <p className="text-sm text-muted">
          {insight.reason ?? t("weather.empty")}
        </p>
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums">
            {latest.saving_pct > 0 ? `${latest.saving_pct}%` : t("weather.over", { pct: Math.abs(latest.saving_pct) })}
            <span className="ml-2 text-base font-normal text-muted">{t("weather.inMonth", { month: fmt.month(latest.month) })}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {t("weather.explain", {
              used: fmt.int(latest.kwh),
              start: fmt.month(insight.baseline_month!),
              expected: fmt.int(latest.expected_kwh),
            })}
          </p>
          {latest.above_expected && (
            <p className="mt-2 rounded-xl bg-sun-soft px-3 py-2 text-sm">
              {t("weather.alert")}
            </p>
          )}
          {insight.months.length > 1 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left font-medium">{t("dashboard.month")}</th>
                  <th className="py-1 text-right font-medium">{t("weather.heat")}</th>
                  <th className="py-1 text-right font-medium">{t("weather.used")}</th>
                  <th className="py-1 text-right font-medium">{t("weather.expected")}</th>
                  <th className="py-1 text-right font-medium">{t("weather.saving")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {insight.months.map((m) => (
                  <tr key={m.month} className="border-t border-border">
                    <td className="py-1">{fmt.month(m.month)}</td>
                    <td className="py-1 text-right">{fmt.int(m.cooling_degree_days)}</td>
                    <td className="py-1 text-right">{fmt.int(m.kwh)}</td>
                    <td className="py-1 text-right">{fmt.int(m.expected_kwh)}</td>
                    <td className={`py-1 text-right ${m.saving_pct > 0 ? "text-brand" : "text-danger"}`}>
                      {m.saving_pct > 0 ? "" : "+"}
                      {Math.abs(m.saving_pct)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted">
            {t("weather.note", { model: t(MODEL_NOTE[insight.model!.source]) })}
            {insight.model!.slope_kwh_per_cdd > 0 && ` (${t("weather.slope", { slope: insight.model!.slope_kwh_per_cdd })})`}.
          </p>
        </>
      )}
    </Card>
  );
}
