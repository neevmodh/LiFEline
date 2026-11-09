"use client";

import { useEffect, useState } from "react";
import { Badge, fmt } from "@/components/ui";
import { api, type SolarScenario as Scenario } from "@/lib/api";

function crore(rs: number): string {
  if (rs >= 1e7) return `₹${(rs / 1e7).toFixed(2)} cr`;
  if (rs >= 1e5) return `₹${(rs / 1e5).toFixed(1)} lakh`;
  return fmt.rs(rs);
}

/** "What if X% of suitable registered homes went solar?" for one district or all of Gujarat. */
export function SolarScenario({
  districtId,
  title,
  refreshKey,
}: {
  districtId?: number;
  title: string;
  /** Changes when new households may have joined (booth mode), to recompute. */
  refreshKey?: number;
}) {
  const [adoption, setAdoption] = useState(50);
  const [data, setData] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      api
        .solarScenario(adoption, districtId)
        .then((d) => {
          if (!live) return;
          setData(d);
          setError(null);
        })
        .catch((e) => live && setError(e.message));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [adoption, districtId, refreshKey]);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {data && <Badge tone="muted">{data.yield_source === "pvgis" ? "PVGIS yield" : "Gujarat average yield"}</Badge>}
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-muted">If </span>
        <strong className="tabular-nums">{adoption}%</strong>
        <span className="text-muted"> of suitable registered homes install rooftop solar</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={adoption}
          onChange={(e) => setAdoption(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--brand)]"
          aria-label="Share of suitable homes adopting rooftop solar"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      {data &&
        (data.suitable_homes === 0 ? (
          <p className="mt-2 text-sm text-muted">No registered homes with a usable roof here yet.</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Homes</dt>
              <dd className="text-right tabular-nums">
                {Number.isInteger(data.adopting_homes) ? fmt.int(data.adopting_homes) : data.adopting_homes.toFixed(1)} of{" "}
                {fmt.int(data.suitable_homes)}
              </dd>
              <dt className="text-muted">New capacity</dt>
              <dd className="text-right tabular-nums">{(data.capacity_mw * 1000).toFixed(1)} kW</dd>
              <dt className="text-muted">Clean power / year</dt>
              <dd className="text-right tabular-nums">{fmt.int(data.annual_generation_mwh * 1000)} kWh</dd>
              <dt className="text-muted">CO₂ avoided / year</dt>
              <dd className="text-right tabular-nums">{data.annual_co2_avoided_t} t</dd>
              <dt className="text-muted">Bills saved / year</dt>
              <dd className="text-right tabular-nums">{crore(data.annual_bill_savings_rs)}</dd>
              <dt className="text-muted">PM Surya Ghar subsidy</dt>
              <dd className="text-right tabular-nums">{crore(data.subsidy_needed_rs)}</dd>
              <dt className="text-muted">Payback for households</dt>
              <dd className="text-right tabular-nums">{data.payback_years ? `${data.payback_years} yrs` : "–"}</dd>
            </dl>
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <strong>Per 1,000 similar homes:</strong> {data.per_1000_homes.capacity_mw} MW,{" "}
              {data.per_1000_homes.annual_co2_avoided_t} t CO₂ a year, {crore(data.per_1000_homes.annual_bill_savings_rs)}{" "}
              saved on bills, {crore(data.per_1000_homes.subsidy_needed_rs)} subsidy.
            </p>
          </>
        ))}
      <p className="mt-2 text-xs text-muted">
        Each home sized and costed with the citizen solar calculator: its own roof, use and tariff.
      </p>
    </div>
  );
}
