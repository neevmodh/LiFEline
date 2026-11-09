"use client";

import Link from "next/link";
import { useState } from "react";
import { BillScanner } from "@/components/BillScanner";
import { FootprintBar } from "@/components/FootprintBar";
import { TrendChart } from "@/components/TrendChart";
import { WeatherCard } from "@/components/WeatherCard";
import { GreenHoursCard } from "@/components/GreenHoursCard";
import { BadgesCard } from "@/components/BadgesCard";
import { ShareImpact } from "@/components/ShareImpact";
import { AlertsToggle } from "@/components/AlertsToggle";
import { FootprintHistory } from "@/components/FootprintHistory";
import { useConfig } from "@/lib/config";
import { Badge, Button, Card, CardTitle, ErrorNote, ProgressBar, Spinner, Stat, fmt, inputClass, useLoad } from "@/components/ui";
import { ApiError, api, type Nudge } from "@/lib/api";
import { queueAction } from "@/lib/offline";
import { useI18n, type MessageKey } from "@/i18n";

const NUDGE_TONE: Record<Nudge["category"], "brand" | "sun" | "muted" | "danger"> = {
  peak_shift: "sun",
  efficiency: "brand",
  mobility: "brand",
  progress: "muted",
};
const NUDGE_LABEL: Record<Nudge["category"], MessageKey> = {
  peak_shift: "nudge.category.peak_shift",
  efficiency: "nudge.category.efficiency",
  mobility: "nudge.category.mobility",
  progress: "nudge.category.progress",
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardView() {
  const { t } = useI18n();
  const dash = useLoad(api.dashboard);
  const nudges = useLoad(api.nudges);
  const household = useLoad(api.household);
  const weather = useLoad(api.weatherInsight);
  const green = useLoad(api.greenHours);
  const history = useLoad(api.footprintHistory);
  const badges = useLoad(api.badges);
  const config = useConfig();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState({ month: currentMonth(), kwh: "" });

  async function logAction(code: string) {
    setError(null);
    try {
      const log = await api.logAction(code);
      setFlash(t("dashboard.flashAction", { points: log.points_awarded, co2: fmt.kg(log.co2_saved_kg) }));
      dash.reload();
      badges.reload();
      history.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        queueAction(code);
        setFlash(t("dashboard.flashQueued"));
        return;
      }
      setError(e instanceof Error ? e.message : t("actions.logFailed"));
    }
  }

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
      nudges.reload();
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
  const challenge = d.daily_challenge;
  const levelProgress = d.level.next_level_at > 0 ? (d.level.points / d.level.next_level_at) * 100 : 100;
  const baselineKwh = household.data?.household.monthly_kwh ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{t("dashboard.greeting", { name: d.user.name.split(" ")[0] })}</p>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        </div>
        <ShareImpact />
        {flash && (
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong" role="status">
            {flash}
          </p>
        )}
      </div>
      <ErrorNote message={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("dashboard.footprint")}
          value={fmt.kg(d.footprint.total_kg)}
          hint={t("dashboard.perPerson", { kg: fmt.kg(d.footprint.per_capita_kg) })}
        />
        <Stat
          label={t("dashboard.co2")}
          value={fmt.kg(d.co2_saved_kg)}
          hint={
            config && d.co2_saved_kg > 0
              ? t("dashboard.equivalents", {
                  km: fmt.int(d.co2_saved_kg / config.car_kg_co2_per_km),
                  trees: (d.co2_saved_kg / config.tree_kg_co2_per_year).toFixed(1),
                })
              : t("dashboard.greenActions", { n: d.actions_logged })
          }
        />
        <Stat
          label={t("dashboard.streak")}
          value={t(d.streak_days === 1 ? "dashboard.day" : "dashboard.days", { n: d.streak_days })}
          hint={t("dashboard.streakHint")}
        />
        <Stat
          label={t("dashboard.rank")}
          value={d.district_rank ? `#${d.district_rank}` : "–"}
          hint={t("dashboard.rankHint", { n: d.district_participants })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="border-sun/40 bg-sun-soft/40">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge tone="sun">{t("dashboard.challenge", { x: challenge.multiplier })}</Badge>
                <h2 className="mt-2 text-lg font-semibold">{challenge.action.title}</h2>
                <p className="mt-1 text-sm text-muted">{challenge.action.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {challenge.action.applicable
                    ? t("dashboard.challengeEveryone")
                    : t("dashboard.challengeNotForYou", { reason: challenge.action.not_applicable_reason ?? "" })}
                </p>
              </div>
              {challenge.completed ? (
                <Badge>{t("dashboard.done")}</Badge>
              ) : !challenge.action.applicable ? null : (
                <Button onClick={() => logAction(challenge.action.code)}>{t("dashboard.didThis")}</Button>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle
              aside={
                nudges.data?.temperature_c != null && (
                  <span className="text-xs text-muted">{t("dashboard.outside", { temp: nudges.data.temperature_c.toFixed(0) })}</span>
                )
              }
            >
              {t("dashboard.rightNow")}
            </CardTitle>
            {nudges.loading && !nudges.data ? (
              <Spinner />
            ) : nudges.data?.nudges.length ? (
              <ul className="space-y-3">
                {nudges.data.nudges.map((n) => (
                  <li key={n.code} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone={NUDGE_TONE[n.category]}>{t(NUDGE_LABEL[n.category])}</Badge>
                        <p className="mt-2 font-medium">{n.title}</p>
                        <p className="mt-1 text-sm text-muted">{n.body}</p>
                      </div>
                      {n.action_code && (
                        <Button variant="ghost" className="shrink-0" onClick={() => logAction(n.action_code!)}>
                          {t("dashboard.nudgeDone")}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("dashboard.noNudges")}</p>
            )}
          </Card>

          <GreenHoursCard data={green.data} />
          <AlertsToggle />

          <Card>
            <CardTitle>{t("history.title")}</CardTitle>
            {history.data ? <FootprintHistory data={history.data} /> : <Spinner />}
          </Card>

          <BadgesCard badges={badges.data} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle aside={<Badge>{t("dashboard.level", { n: d.level.level })}</Badge>}>
              {t(`level.${d.level.level}` as MessageKey)}
            </CardTitle>
            <p className="text-3xl font-semibold tabular-nums">
              {fmt.int(d.level.points)} <span className="text-base font-normal text-muted">{t("dashboard.points")}</span>
            </p>
            <div className="mt-3">
              <ProgressBar value={levelProgress} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {d.level.points >= d.level.next_level_at
                ? t("dashboard.topLevel")
                : t("dashboard.toNextLevel", { n: fmt.int(d.level.next_level_at - d.level.points) })}
            </p>
            <Link href="/actions" className="mt-4 inline-block text-sm font-medium text-brand">
              {t("dashboard.moreActions")}
            </Link>
          </Card>

          <Card>
            <CardTitle>{t("dashboard.footprintSources")}</CardTitle>
            <FootprintBar footprint={d.footprint} />
          </Card>

          <Card>
            <CardTitle>{t("dashboard.trend")}</CardTitle>
            {d.trend.length ? <TrendChart data={d.trend} baseline={baselineKwh} /> : <p className="text-sm text-muted">{t("dashboard.noReadings")}</p>}
            <div className="mt-4 border-t border-border pt-4">
              <BillScanner
                compact
                title={t("dashboard.addBillTitle")}
                onResult={(r) => setReading({ month: r.month && r.month <= currentMonth() ? r.month : reading.month, kwh: String(Math.round(r.monthlyKwh)) })}
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
      </div>
    </div>
  );
}
