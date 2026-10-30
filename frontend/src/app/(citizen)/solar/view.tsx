"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardTitle, ErrorNote, Field, Stat, fmt, inputClass } from "@/components/ui";
import { api, type SolarEstimate } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SolarView() {
  const { user } = useAuth();
  const [roof, setRoof] = useState("");
  const [kwh, setKwh] = useState("");
  const [result, setResult] = useState<SolarEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill from onboarding answers.
  useEffect(() => {
    api
      .household()
      .then(({ household }) => {
        setKwh(String(household.monthly_kwh));
        if (household.roof_area_sqm) setRoof(String(household.roof_area_sqm));
      })
      .catch(() => {});
  }, []);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api.solar({ roof_area_sqm: Number(roof), monthly_kwh: Number(kwh), district_id: user?.district_id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rooftop solar check</h1>
        <p className="mt-1 text-sm text-muted">
          See what a rooftop system would cost and save, using solar data for your district and the PM Surya Ghar subsidy.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <form onSubmit={calculate} className="space-y-4">
            <Field label="Shadow-free roof area (m²)" hint="About 10 m² is needed per kW of panels.">
              <input type="number" required min={1} value={roof} onChange={(e) => setRoof(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Average monthly units (kWh)">
              <input type="number" required min={1} value={kwh} onChange={(e) => setKwh(e.target.value)} className={inputClass} />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Calculating…" : "Calculate"}
            </Button>
          </form>
        </Card>

        {result ? (
          result.recommended_kwp === 0 ? (
            <Card>
              <p className="font-medium">Your roof is too small for a standard system.</p>
              <p className="mt-1 text-sm text-muted">
                You need at least 5 m² of shadow-free roof for a 0.5 kW system. Ask your society about a shared rooftop installation.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="border-sun/40 bg-sun-soft/40">
                <p className="text-sm text-muted">Recommended system</p>
                <p className="text-4xl font-semibold">{result.recommended_kwp} kW</p>
                <p className="mt-1 text-sm text-muted">
                  Sized by your {result.limited_by === "roof" ? "roof area" : "electricity use"} ·{" "}
                  {fmt.int(result.annual_generation_kwh)} kWh a year
                </p>
              </Card>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Saves per year" value={fmt.rs(result.annual_savings_rs)} />
                <Stat label="Pays back in" value={result.payback_years ? `${result.payback_years} yrs` : "–"} />
                <Stat label="CO₂ avoided" value={`${fmt.kg(result.annual_co2_avoided_kg)}/yr`} />
                <Stat label="25-year gain" value={fmt.rs(result.lifetime_savings_rs)} hint="After cost, with panel ageing" />
              </div>
              <Card>
                <CardTitle>Cost breakdown</CardTitle>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">System cost</dt>
                    <dd className="tabular-nums">{fmt.rs(result.gross_cost_rs)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">PM Surya Ghar subsidy</dt>
                    <dd className="tabular-nums text-brand">− {fmt.rs(result.subsidy_rs)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>You pay</dt>
                    <dd className="tabular-nums">{fmt.rs(result.net_cost_rs)}</dd>
                  </div>
                </dl>
                <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone={result.yield_source === "pvgis" ? "brand" : "muted"}>
                    {result.yield_source === "pvgis" ? "Live PVGIS data" : "Gujarat average"}
                  </Badge>
                  {fmt.int(result.specific_yield_kwh_per_kwp)} kWh per kW per year at your location. Prices are estimates; get
                  quotes from empanelled vendors on pmsuryaghar.gov.in.
                </p>
              </Card>
            </div>
          )
        ) : (
          <Card>
            <p className="text-sm text-muted">Enter your roof area to see sizing, cost, subsidy and payback.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
