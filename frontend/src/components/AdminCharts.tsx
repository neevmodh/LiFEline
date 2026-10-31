"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminOverview } from "@/lib/api";
import { fmt } from "@/components/ui";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text)",
};
const tick = { fill: "var(--muted)", fontSize: 12 };

const weekLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** One measure per chart: bars for amounts, a line for counts over time. */
export function WeeklySeries({
  data,
  measure,
  height = 200,
}: {
  data: AdminOverview["weekly"];
  measure: "co2" | "active";
  height?: number;
}) {
  const rows = data.map((w) => ({ ...w, label: weekLabel(w.week_start) }));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        {measure === "co2" ? (
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
            <YAxis tick={tick} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--surface-2)" }}
              formatter={(v) => [fmt.kg(Number(v)), "CO₂ avoided"]}
            />
            <Bar dataKey="co2_saved_kg" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        ) : (
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
            <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Active citizens"]} />
            <Line dataKey="active_citizens" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: AdminOverview["categories"] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" tick={tick} tickLine={false} axisLine={false} width={72} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--surface-2)" }}
            formatter={(v) => [fmt.kg(Number(v)), "CO₂ avoided"]}
          />
          <Bar dataKey="co2_saved_kg" fill="var(--chart-3)" radius={[0, 4, 4, 0]} maxBarSize={20}>
            <LabelList
              dataKey="co2_saved_kg"
              position="right"
              formatter={(v) => fmt.kg(Number(v))}
              style={{ fill: "var(--muted)", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Average household electricity use per month in one district. */
export function ConsumptionTrend({ data }: { data: { month: string; avg_kwh: number }[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={fmt.month} tick={tick} tickLine={false} axisLine={false} />
          <YAxis tick={tick} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(m) => fmt.month(String(m))}
            formatter={(v) => [`${Math.round(Number(v))} kWh`, "Avg per household"]}
          />
          <Line dataKey="avg_kwh" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
