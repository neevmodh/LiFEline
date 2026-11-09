"use client";

import { useEffect, useMemo, useState } from "react";
import { ConsumptionTrend, WeeklySeries } from "@/components/AdminCharts";
import { GujaratMap, type MapMetric } from "@/components/map";
import { Badge, Card, ErrorNote, Spinner, fmt, plural } from "@/components/ui";
import { api, type AdminOverview, type DistrictDetail } from "@/lib/api";
import { hoursLabel, useConfig } from "@/lib/config";
import { SolarScenario } from "@/components/SolarScenario";

type District = AdminOverview["districts"][number];
type MetricKey = "co2" | "participation" | "perCitizen" | "footprint" | "solar";

const METRICS: Record<MetricKey, { tab: string; label: string; pick: (d: District) => number | null; format: (v: number) => string }> = {
  co2: { tab: "CO₂ avoided", label: "CO₂ avoided, last 30 days", pick: (d) => d.co2_saved_30d_kg, format: fmt.kg },
  participation: {
    tab: "Participation",
    label: "Citizens active this week",
    pick: (d) => d.participation_pct,
    format: (v) => `${Math.round(v)}%`,
  },
  perCitizen: {
    tab: "Per citizen",
    label: "CO₂ avoided per citizen, 30 days",
    pick: (d) => d.co2_per_citizen_30d_kg,
    format: fmt.kg,
  },
  footprint: {
    tab: "Footprint",
    label: "Avg household footprint / month",
    pick: (d) => d.avg_baseline_kg,
    format: fmt.kg,
  },
  solar: {
    tab: "Solar potential",
    label: "Untapped rooftop solar",
    pick: (d) => d.solar_potential_kwp,
    format: (v) => `${fmt.int(v)} kW`,
  },
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function DistrictPanel({ district }: { district: District }) {
  const config = useConfig();
  const [detail, setDetail] = useState<{ id: number; data: DistrictDetail } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .districtDetail(district.district_id)
      .then((data) => !cancelled && setDetail({ id: district.district_id, data }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [district.district_id]);

  const d = detail?.id === district.district_id ? detail.data : null;

  return (
    <div className="flex h-full flex-col gap-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{district.district}</h3>
          <p className="text-sm text-muted">
            {district.citizens
              ? `${plural(district.citizens, "citizen")} · ${district.participation_pct ?? 0}% active this week`
              : "No registered citizens yet"}
          </p>
        </div>
        {district.citizens > 0 && (
          <button
            type="button"
            onClick={() => api.downloadDistrictReport(district.district_id).catch((e) => setError(e.message))}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
          >
            Download CSV
          </button>
        )}
      </div>
      <ErrorNote message={error} />

      {!d ? (
        <Spinner />
      ) : d.citizens === 0 ? (
        <div className="rounded-xl bg-sun-soft p-4 text-sm">
          <p className="font-medium">An outreach opportunity</p>
          <p className="mt-1 text-muted">
            Nobody in {d.district} has joined yet. A school or ward awareness drive here would extend Mission LiFE&apos;s
            reach the most.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="CO₂ avoided · 30d" value={fmt.kg(d.co2_saved_30d_kg)} hint={plural(d.actions_30d, "action")} />
            <Kpi label="Electricity saved · 30d" value={`${fmt.int(d.kwh_saved_30d)} kWh`} />
            <Kpi label="Peak-hour shifts · 30d" value={fmt.int(d.peak_shifts_30d)} hint={config ? `Heavy loads moved off ${hoursLabel(config.peak_hours, true)}` : "Heavy loads moved off peak"} />
            <Kpi
              label="Avg footprint"
              value={d.avg_baseline_kg != null ? fmt.kg(d.avg_baseline_kg) : "–"}
              hint="per household / month"
            />
          </div>

          {d.consumption.length > 1 && (
            <div>
              <p className="text-sm font-medium">Average household electricity use</p>
              <ConsumptionTrend data={d.consumption} />
            </div>
          )}

          <div>
            <p className="text-sm font-medium">CO₂ avoided per week</p>
            <WeeklySeries data={d.weekly} measure="co2" height={140} />
          </div>

          <div className="rounded-xl border border-sun/40 bg-sun-soft/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Rooftop solar pipeline</p>
              <Badge tone="sun">{plural(d.solar_survey_requests, "survey request")}</Badge>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Suitable roofs</dt>
              <dd className="text-right tabular-nums">{fmt.int(d.solar.suitable_households)}</dd>
              <dt className="text-muted">Untapped capacity</dt>
              <dd className="text-right tabular-nums">{fmt.int(d.solar.potential_kwp)} kW</dd>
              <dt className="text-muted">Clean power / year</dt>
              <dd className="text-right tabular-nums">{fmt.int(d.solar.annual_generation_kwh)} kWh</dd>
              <dt className="text-muted">CO₂ avoided / year</dt>
              <dd className="text-right tabular-nums">{d.solar.annual_co2_avoided_t} t</dd>
              <dt className="text-muted">PM Surya Ghar subsidy needed</dt>
              <dd className="text-right tabular-nums">{fmt.rs(d.solar.subsidy_pipeline_rs)}</dd>
              <dt className="text-muted">Already solar</dt>
              <dd className="text-right tabular-nums">{fmt.int(d.solar.installed_households)} homes</dd>
            </dl>
          </div>

          <SolarScenario
            districtId={district.district_id}
            title={`What if ${district.district} goes solar?`}
            refreshKey={district.citizens}
          />

          {d.top_wards.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Leading wards · 30 days</p>
              <ol className="divide-y divide-border text-sm">
                {d.top_wards.map((w, i) => (
                  <li key={w.ward} className="flex items-center justify-between py-1.5">
                    <span>
                      <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
                      {w.ward} <span className="text-xs text-muted">· {plural(w.citizens, "citizen")}</span>
                    </span>
                    <span className="tabular-nums">{fmt.kg(w.co2_saved_30d_kg)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function DistrictExplorer({
  districts,
  selectedId,
  onSelect,
}: {
  districts: District[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>("co2");
  const byName = useMemo(() => new Map(districts.map((d) => [d.district, d])), [districts]);
  const selected = districts.find((d) => d.district_id === selectedId) ?? null;
  const m = METRICS[metricKey];

  const metric: MapMetric = useMemo(
    () => ({
      label: m.label,
      format: m.format,
      // Districts with no citizens show as "no data" rather than a misleading zero.
      values: Object.fromEntries(districts.map((d) => [d.district, d.citizens ? m.pick(d) : null])),
    }),
    [districts, m],
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">District explorer</h2>
          <p className="text-xs text-muted">All 33 districts of Gujarat. Click a district for its details.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1 text-sm" role="tablist" aria-label="Map metric">
          {(Object.keys(METRICS) as MetricKey[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={metricKey === key}
              onClick={() => setMetricKey(key)}
              className={`rounded-lg px-3 py-1 ${metricKey === key ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
            >
              {METRICS[key].tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="lg:sticky lg:top-20">
          <GujaratMap
            metric={metric}
            selected={selected?.district}
            height={560}
            onSelect={(name) => {
              const d = byName.get(name);
              if (d) onSelect(d.district_id);
            }}
            tooltipExtra={(name) => {
              const d = byName.get(name);
              return d?.citizens ? [`${plural(d.citizens, "citizen")} · ${d.participation_pct ?? 0}% active`] : [];
            }}
          />
        </div>
        {selected ? (
          <DistrictPanel key={selected.district_id} district={selected} />
        ) : (
          <p className="text-sm text-muted">Select a district on the map.</p>
        )}
      </div>
    </Card>
  );
}
