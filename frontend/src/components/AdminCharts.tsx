"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { AdminOverview } from "@/lib/api";
import { fmt } from "@/components/ui";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};
const tick = { fill: "var(--muted)", fontSize: 12 };

export function WeeklyChart({ data }: { data: AdminOverview["weekly"] }) {
  const rows = data.map((w) => ({
    ...w,
    label: new Date(`${w.week_start}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
          <YAxis yAxisId="co2" tick={tick} tickLine={false} axisLine={false} />
          <YAxis yAxisId="users" orientation="right" tick={tick} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
          <Bar yAxisId="co2" dataKey="co2_saved_kg" name="CO₂ avoided (kg)" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} />
          <Line yAxisId="users" dataKey="active_citizens" name="Active citizens" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: AdminOverview["categories"] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" tick={tick} tickLine={false} axisLine={false} width={72} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [fmt.kg(Number(v)), "CO₂ avoided"]} />
          <Bar dataKey="co2_saved_kg" fill="var(--chart-3)" radius={[0, 6, 6, 0]} maxBarSize={22}>
            <LabelList dataKey="co2_saved_kg" position="right" formatter={(v) => fmt.kg(Number(v))} style={{ fill: "var(--muted)", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Districts plotted by coordinates; bubble size is CO₂ avoided in the last 30 days. */
export function DistrictMap({ data }: { data: AdminOverview["districts"] }) {
  const rows = data.filter((d) => d.citizens > 0);
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <XAxis type="number" dataKey="lon" domain={["dataMin - 0.5", "dataMax + 0.5"]} hide />
          <YAxis type="number" dataKey="lat" domain={["dataMin - 0.5", "dataMax + 0.5"]} hide />
          <ZAxis type="number" dataKey="co2_saved_30d_kg" range={[60, 1400]} />
          <Tooltip
            contentStyle={tooltipStyle}
            content={({ payload }) => {
              const d = payload?.[0]?.payload as AdminOverview["districts"][number] | undefined;
              if (!d) return null;
              return (
                <div style={tooltipStyle} className="px-3 py-2">
                  <p className="font-semibold">{d.district}</p>
                  <p>{fmt.kg(d.co2_saved_30d_kg)} avoided (30 days)</p>
                  <p>
                    {d.active_7d} of {d.citizens} citizens active this week
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={rows} fill="var(--chart-1)" fillOpacity={0.55} stroke="var(--chart-1)">
            <LabelList dataKey="district" position="top" style={{ fill: "var(--muted)", fontSize: 10 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
