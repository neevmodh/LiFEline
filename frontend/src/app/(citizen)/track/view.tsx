"use client";

import { useState } from "react";
import { BadgesCard } from "@/components/BadgesCard";
import { BillScanner } from "@/components/BillScanner";
import { FootprintBar } from "@/components/FootprintBar";
import { FootprintHistory } from "@/components/FootprintHistory";
import { TrendChart } from "@/components/TrendChart";
import { WeatherCard } from "@/components/WeatherCard";
import { Button, Card, CardTitle, ErrorNote, Spinner, fmt, inputClass, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Your bills, footprint and savings over time. */
export default function TrackView() {
  const { t } = useI18n();
  const dash = useLoad(api.dashboard);
  const household = useLoad(api.household);
  const weather = useLoad(api.weatherInsight);
  const history = useLoad(api.footprintHistory);
  const badges = useLoad(api.badges);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState({ month: currentMonth(), kwh: "" });

  async function saveReading(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.addReading({ month: reading.month, kwh: Number(reading.kwh) });
      setFlash(
        t("dashboard.flashReading", {
          month: fmt.month(r.month),
          change: `${r.change_vs_baseline_pct > 0 ? "+" : ""}${r.change_vs_baseline_pct}`,
        }),
      );
      setReading((s) => ({ ...s, kwh: "" }));
      dash.reload();
      weather.reload();
      history.reload();
      badges.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.readingFailed"));
    }
  }

  if (dash.loading && !dash.data) return <Spinner />;
  if (dash.error || !dash.data) return <ErrorNote message={dash.error ?? t("dashboard.loadFailed")} />;
  const d = dash.data;
  const baselineKwh = household.data?.household.monthly_kwh ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("track.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("track.intro")}</p>
        </div>
        {flash && (
          <p className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong" role="status">
            {flash}
          </p>
        )}
      </div>
      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t("dashboard.trend")}</CardTitle>
          {d.trend.length ? (
            <TrendChart data={d.trend} baseline={baselineKwh} />
          ) : (
            <p className="text-sm text-muted">{t("dashboard.noReadings")}</p>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <BillScanner
              compact
              title={t("dashboard.addBillTitle")}
              onResult={(r) =>
                setReading({
                  month: r.month && r.month <= currentMonth() ? r.month : reading.month,
                  kwh: String(Math.round(r.monthlyKwh)),
                })
              }
            />
          </div>
          <form onSubmit={saveReading} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="text-xs text-muted">{t("dashboard.month")}</span>
              <input
                type="month"
                required
                max={currentMonth()}
                value={reading.month}
                onChange={(e) => setReading((s) => ({ ...s, month: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="flex-1">
              <span className="text-xs text-muted">{t("dashboard.units")}</span>
              <input
                type="number"
                required
                min={0}
                value={reading.kwh}
                onChange={(e) => setReading((s) => ({ ...s, kwh: e.target.value }))}
                className={inputClass}
              />
            </label>
            <Button type="submit">{t("dashboard.addBill")}</Button>
          </form>
        </Card>

        <WeatherCard insight={weather.data} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t("history.title")}</CardTitle>
          {history.data ? <FootprintHistory data={history.data} /> : <Spinner />}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardTitle>{t("dashboard.footprintSources")}</CardTitle>
            <FootprintBar footprint={d.footprint} />
          </Card>
          <BadgesCard badges={badges.data} />
        </div>
      </div>
    </div>
  );
}
