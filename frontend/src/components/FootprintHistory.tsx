"use client";

import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/components/ui";
import type { FootprintHistory as History } from "@/lib/api";
import { useI18n } from "@/i18n";

/** Monthly footprint by source against the onboarding baseline, with CO₂ avoided by actions. */
export function FootprintHistory({ data }: { data: History }) {
  const { t } = useI18n();
  if (!data.months.length) return <p className="text-sm text-muted">{t("dashboard.noReadings")}</p>;
  const last = data.months.at(-1)!;
  const change = ((last.total_kg - data.baseline_kg) / data.baseline_kg) * 100;
  const avoided = data.months.reduce((s, m) => s + m.avoided_kg, 0);
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {t("history.summary", {
          month: fmt.month(last.month),
          total: fmt.kg(last.total_kg),
          change: `${change > 0 ? "+" : ""}${change.toFixed(0)}`,
          avoided: fmt.kg(avoided),
        })}
      </p>
      <div className="h-60 w-full">
        <ResponsiveContainer>
          <BarChart data={data.months} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={fmt.month} tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              labelFormatter={(m) => fmt.month(String(m))}
              formatter={(v, name) => [fmt.kg(Number(v)), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={data.baseline_kg}
              stroke="var(--sun)"
              strokeDasharray="4 4"
              label={{ value: t("history.baseline"), position: "insideTopRight", fill: "var(--sun)", fontSize: 11 }}
            />
            <Bar dataKey="electricity_kg" name={t("footprint.electricity")} stackId="fp" fill="var(--chart-1)" maxBarSize={40} />
            <Bar dataKey="cooking_kg" name={t("footprint.cooking")} stackId="fp" fill="var(--chart-2)" maxBarSize={40} />
            <Bar dataKey="commute_kg" name={t("footprint.commute")} stackId="fp" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
