"use client";

import { useState } from "react";
import { Button, Card, CardTitle, ErrorNote, Field, inputClass } from "@/components/ui";
import { api, type Forecast } from "@/lib/api";

const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Read the meter today; see where the month is heading before the bill arrives. */
export function BillForecast() {
  const [used, setUsed] = useState("");
  const [result, setResult] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api.forecastBill(Number(used)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not forecast");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>This month&apos;s bill, before it arrives</CardTitle>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Field label="Units your meter shows so far this month (kWh)" hint="Units used since your last bill, not the meter's total reading.">
          <input className={inputClass} type="number" min={0} max={5000} step="any" required value={used} onChange={(e) => setUsed(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy || !used}>{busy ? "Working…" : "Forecast my bill"}</Button>
      </form>
      <ErrorNote message={error} />
      {result && (
        <div className="mt-4 space-y-2 text-sm" data-testid="forecast">
          <p>
            <span className="text-2xl font-bold">{rs(result.projected_bill_rs)}</span>{" "}
            <span className="text-muted">for about {Math.round(result.projected_kwh)} units this month ({result.daily_kwh} a day, day {result.day} of {result.days_in_month}).</span>
          </p>
          {result.daily_budget_kwh !== null && result.next_slab_kwh !== null && (
            <p className="rounded-xl bg-sun-soft px-3 py-2">
              At this pace you will cross the {result.next_slab_kwh} unit slab, where each unit costs more. Keep to about{" "}
              <strong>{result.daily_budget_kwh} units a day</strong> for the rest of the month to stay under it
              {result.saving_if_budget_rs ? ` and save about ${rs(result.saving_if_budget_rs)}` : ""}.
            </p>
          )}
          <p className="text-xs text-muted">{result.note}</p>
        </div>
      )}
    </Card>
  );
}
