"use client";

import { Badge, Card, CardTitle, fmt } from "@/components/ui";
import type { WeatherInsight } from "@/lib/api";

const MODEL_NOTE: Record<NonNullable<WeatherInsight["model"]>["source"], string> = {
  household: "learned from your own bills",
  district: "learned from households in your district",
  state: "learned from households across Gujarat",
  none: "not enough bills yet to learn how weather affects use",
};

/** Real savings once the weather is taken out: a cool month isn't a saving, a heatwave isn't a failure. */
export function WeatherCard({ insight }: { insight: WeatherInsight | null }) {
  if (!insight) return null;
  const latest = insight.months.at(-1);

  return (
    <Card>
      <CardTitle aside={<Badge tone="muted">Weather-adjusted</Badge>}>Your real saving</CardTitle>
      {!insight.available || !latest ? (
        <p className="text-sm text-muted">
          {insight.reason ?? "Add a bill for a month after you joined to see your weather-adjusted saving."}
        </p>
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums">
            {latest.saving_pct > 0 ? `${latest.saving_pct}%` : `${Math.abs(latest.saving_pct)}% over`}
            <span className="ml-2 text-base font-normal text-muted">in {fmt.month(latest.month)}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            You used {fmt.int(latest.kwh)} kWh. From your starting point in {fmt.month(insight.baseline_month!)}, that
            month&apos;s weather alone would have meant about {fmt.int(latest.expected_kwh)} kWh.
          </p>
          {latest.above_expected && (
            <p className="mt-2 rounded-xl bg-sun-soft px-3 py-2 text-sm">
              That&apos;s well above what the weather explains. Check AC set-points, a geyser left on, or an appliance
              that has started using more.
            </p>
          )}
          {insight.months.length > 1 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left font-medium">Month</th>
                  <th className="py-1 text-right font-medium">Heat (CDD)</th>
                  <th className="py-1 text-right font-medium">Used</th>
                  <th className="py-1 text-right font-medium">Weather-expected</th>
                  <th className="py-1 text-right font-medium">Saving</th>
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
            Weather from the Open-Meteo archive for your district. Heat is measured in cooling degree days above 24°C;
            the effect of heat on your use is {MODEL_NOTE[insight.model!.source]}
            {insight.model!.slope_kwh_per_cdd > 0 && ` (${insight.model!.slope_kwh_per_cdd} kWh per degree day)`}.
          </p>
        </>
      )}
    </Card>
  );
}
