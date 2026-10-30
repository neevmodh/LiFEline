"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/components/ui";

/** Monthly electricity use against the onboarding baseline. */
export function TrendChart({ data, baseline }: { data: { month: string; kwh: number }[]; baseline: number }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={fmt.month} tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            labelFormatter={(m) => fmt.month(String(m))}
            formatter={(v) => [`${v} kWh`, "Usage"]}
          />
          <ReferenceLine
            y={baseline}
            stroke="var(--sun)"
            strokeDasharray="4 4"
            label={{ value: "Baseline", position: "insideTopRight", fill: "var(--sun)", fontSize: 11 }}
          />
          <Bar dataKey="kwh" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
