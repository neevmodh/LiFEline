"use client";

import Link from "next/link";
import { useState } from "react";
import { BillScanner } from "@/components/BillScanner";
import { FootprintBar } from "@/components/FootprintBar";
import { TrendChart } from "@/components/TrendChart";
import { WeatherCard } from "@/components/WeatherCard";
import { Badge, Button, Card, CardTitle, ErrorNote, ProgressBar, Spinner, Stat, fmt, inputClass, useLoad } from "@/components/ui";
import { api, type Nudge } from "@/lib/api";

const NUDGE_TONE: Record<Nudge["category"], "brand" | "sun" | "muted" | "danger"> = {
  peak_shift: "sun",
  efficiency: "brand",
  mobility: "brand",
  progress: "muted",
};
const NUDGE_LABEL: Record<Nudge["category"], string> = {
  peak_shift: "Grid timing",
  efficiency: "Efficiency",
  mobility: "Travel",
  progress: "Progress",
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardView() {
  const dash = useLoad(api.dashboard);
  const nudges = useLoad(api.nudges);
  const household = useLoad(api.household);
  const weather = useLoad(api.weatherInsight);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState({ month: currentMonth(), kwh: "" });

  async function logAction(code: string) {
    setError(null);
    try {
      const log = await api.logAction(code);
      setFlash(`+${log.points_awarded} points · ${fmt.kg(log.co2_saved_kg)} CO₂ avoided`);
      dash.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log action");
    }
  }

  async function saveReading(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.addReading({ month: reading.month, kwh: Number(reading.kwh) });
      setFlash(`Saved ${fmt.month(r.month)}: ${r.change_vs_baseline_pct > 0 ? "+" : ""}${r.change_vs_baseline_pct}% vs baseline`);
      setReading((s) => ({ ...s, kwh: "" }));
      dash.reload();
      nudges.reload();
      weather.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save reading");
    }
  }

  if (dash.loading && !dash.data) return <Spinner />;
  if (dash.error || !dash.data) return <ErrorNote message={dash.error ?? "Could not load dashboard"} />;

  const d = dash.data;
  const challenge = d.daily_challenge;
  const levelProgress = d.level.next_level_at > 0 ? (d.level.points / d.level.next_level_at) * 100 : 100;
  const baselineKwh = household.data?.household.monthly_kwh ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Namaste, {d.user.name.split(" ")[0]}</p>
          <h1 className="text-2xl font-semibold">Your Mission LiFE dashboard</h1>
        </div>
        {flash && (
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong" role="status">
            {flash}
          </p>
        )}
      </div>
      <ErrorNote message={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Monthly footprint" value={fmt.kg(d.footprint.total_kg)} hint={`${fmt.kg(d.footprint.per_capita_kg)} per person`} />
        <Stat label="CO₂ avoided" value={fmt.kg(d.co2_saved_kg)} hint={`${d.actions_logged} green actions`} />
        <Stat label="Streak" value={`${d.streak_days} day${d.streak_days === 1 ? "" : "s"}`} hint="Log one action a day to keep it" />
        <Stat
          label="District rank"
          value={d.district_rank ? `#${d.district_rank}` : "–"}
          hint={`of ${d.district_participants} this month`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="border-sun/40 bg-sun-soft/40">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge tone="sun">Today&apos;s challenge · {challenge.multiplier}× points</Badge>
                <h2 className="mt-2 text-lg font-semibold">{challenge.action.title}</h2>
                <p className="mt-1 text-sm text-muted">{challenge.action.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {challenge.action.applicable
                    ? "Everyone in Gujarat gets the same challenge today."
                    : `Not for your home today (${challenge.action.not_applicable_reason?.toLowerCase()}). Try another action.`}
                </p>
              </div>
              {challenge.completed ? (
                <Badge>Done ✓</Badge>
              ) : !challenge.action.applicable ? null : (
                <Button onClick={() => logAction(challenge.action.code)}>I did this</Button>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle
              aside={
                nudges.data?.temperature_c != null && (
                  <span className="text-xs text-muted">{nudges.data.temperature_c.toFixed(0)}°C outside now</span>
                )
              }
            >
              Right now
            </CardTitle>
            {nudges.loading && !nudges.data ? (
              <Spinner />
            ) : nudges.data?.nudges.length ? (
              <ul className="space-y-3">
                {nudges.data.nudges.map((n) => (
                  <li key={n.code} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={NUDGE_TONE[n.category]}>{NUDGE_LABEL[n.category]}</Badge>
                        <p className="mt-2 font-medium">{n.title}</p>
                        <p className="mt-1 text-sm text-muted">{n.body}</p>
                      </div>
                      {n.action_code && (
                        <Button variant="ghost" className="shrink-0" onClick={() => logAction(n.action_code!)}>
                          Done
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No nudges right now. You&apos;re all set.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle aside={<Badge>Level {d.level.level}</Badge>}>{d.level.title}</CardTitle>
            <p className="text-3xl font-semibold tabular-nums">
              {fmt.int(d.level.points)} <span className="text-base font-normal text-muted">points</span>
            </p>
            <div className="mt-3">
              <ProgressBar value={levelProgress} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {d.level.points >= d.level.next_level_at
                ? "Top level reached"
                : `${fmt.int(d.level.next_level_at - d.level.points)} points to the next level`}
            </p>
            <Link href="/actions" className="mt-4 inline-block text-sm font-medium text-brand">
              Log more actions →
            </Link>
          </Card>

          <Card>
            <CardTitle>Where your footprint comes from</CardTitle>
            <FootprintBar footprint={d.footprint} />
          </Card>

          <Card>
            <CardTitle>Electricity trend</CardTitle>
            {d.trend.length ? <TrendChart data={d.trend} baseline={baselineKwh} /> : <p className="text-sm text-muted">No readings yet.</p>}
            <div className="mt-4 border-t border-border pt-4">
              <BillScanner
                compact
                title="Add this month's bill"
                onResult={(r) => setReading({ month: r.month && r.month <= currentMonth() ? r.month : reading.month, kwh: String(Math.round(r.monthlyKwh)) })}
              />
            </div>
            <form onSubmit={saveReading} className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex-1">
                <span className="text-xs text-muted">Month</span>
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
                <span className="text-xs text-muted">Units (kWh)</span>
                <input
                  type="number"
                  required
                  min={0}
                  value={reading.kwh}
                  onChange={(e) => setReading((s) => ({ ...s, kwh: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <Button type="submit">Add bill</Button>
            </form>
          </Card>

          <WeatherCard insight={weather.data} />
        </div>
      </div>
    </div>
  );
}
