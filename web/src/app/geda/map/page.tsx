"use client";

// Every district on one map, by rooftop sunshine, citizens or CO2 avoided; pick one for its figures.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConsole } from "@/components/geda/ConsoleContext";
import { GujaratMap } from "@/components/map";
import { Spinner, fmt, useLoad } from "@/components/ui";
import { districtName, useI18n } from "@/i18n";
import { api } from "@/lib/api";

type Metric = "sun" | "citizens" | "co2";

export default function MapPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { overview: o } = useConsole();
  const sun = useLoad(api.districtSun);
  const [metric, setMetric] = useState<Metric>("sun");
  const [selected, setSelected] = useState<string | null>(null);
  const byName = useMemo(() => Object.fromEntries((o?.districts ?? []).map((d) => [d.district, d])), [o]);
  const sunByName = useMemo(() => Object.fromEntries((sun.data ?? []).map((d) => [d.district, d.kwh_per_kwp])), [sun.data]);
  const values = useMemo(() => {
    if (metric === "sun") return sunByName;
    return Object.fromEntries((o?.districts ?? []).map((d) => [d.district, metric === "citizens" ? d.citizens : d.co2_saved_30d_kg]));
  }, [metric, sunByName, o]);
  const label = metric === "sun" ? `${t("geda.metricSun")} (kWh/kWp/yr)` : metric === "citizens" ? t("geda.metricCitizens") : t("geda.metricCo2");
  const format = (v: number) => (metric === "co2" ? fmt.kg(v) : fmt.int(v));
  const sel = selected ? byName[selected] : null;
  if (!o) return <Spinner />;

  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
      <div className="inline-flex rounded-full bg-surface-2 p-1 text-sm" role="tablist">
        {(["sun", "citizens", "co2"] as Metric[]).map((m) => (
          <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
            className={`rounded-full px-4 py-1.5 font-medium ${metric === m ? "bg-surface shadow-sm" : "text-muted"}`}>
            {m === "sun" ? t("geda.metricSun") : m === "citizens" ? t("geda.metricCitizens") : t("geda.metricCo2")}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <GujaratMap metric={{ label, values, format }} selected={selected} onSelect={setSelected} height={560} />
        <div>
          {selected ? (
            <div className="space-y-3">
              <h2 className="font-display text-2xl font-bold">{districtName(locale, selected)}</h2>
              {sunByName[selected] && <p className="num text-sm text-muted">{t("geda.sunUnit", { n: fmt.int(sunByName[selected]) })}</p>}
              {sel && (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[[t("geda.detailCitizens"), fmt.int(sel.citizens)], [t("geda.detailActive"), fmt.int(sel.active_7d)], [t("geda.detailCo2"), fmt.kg(sel.co2_saved_30d_kg)], [t("geda.detailSolar"), `${fmt.int(sel.solar_potential_kwp)} kW`]].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-bg p-3"><dt className="text-xs text-muted">{k}</dt><dd className="num mt-1 text-lg font-bold">{v}</dd></div>
                  ))}
                </dl>
              )}
              {sel && (
                <button onClick={() => router.push(`/geda/districts?d=${encodeURIComponent(sel.district)}`)} className="min-h-11 rounded-full bg-navy px-5 text-sm font-semibold text-[#f6f2ea] hover:bg-abyss">
                  {t("con.detail", { name: districtName(locale, sel.district) })}
                </button>
              )}
            </div>
          ) : (
            <p className="text-muted">{t("geda.pickDistrict")}</p>
          )}
          {metric === "sun" && <p className="mt-6 text-xs leading-relaxed text-muted">{t("geda.sunNote")}</p>}
        </div>
      </div>
    </section>
  );
}
