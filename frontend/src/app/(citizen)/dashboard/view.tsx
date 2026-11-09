"use client";

import Link from "next/link";
import { useState } from "react";
import { GreenHoursCard } from "@/components/GreenHoursCard";
import { PlanList } from "@/components/PlanList";
import { Badge, Button, Card, CardTitle, ErrorNote, ProgressBar, Spinner, Stat, fmt, useLoad } from "@/components/ui";
import { ApiError, api, type Nudge } from "@/lib/api";
import { useConfig } from "@/lib/config";
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

/** Home: what matters today, in one glance. The detail lives on Plan, Track and Community. */
export default function DashboardView() {
  const { t } = useI18n();
  const dash = useLoad(api.dashboard);
  const nudges = useLoad(api.nudges);
  const plan = useLoad(api.plan);
  const green = useLoad(api.greenHours);
  const config = useConfig();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function logAction(code: string) {
    setError(null);
    try {
      const log = await api.logAction(code);
      setFlash(t("dashboard.flashAction", { points: log.points_awarded, co2: fmt.kg(log.co2_saved_kg) }));
      dash.reload();
      plan.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        queueAction(code);
        setFlash(t("dashboard.flashQueued"));
        return;
      }
      setError(e instanceof Error ? e.message : t("actions.logFailed"));
    }
  }

  if (dash.loading && !dash.data) return <Spinner />;
  if (dash.error || !dash.data) return <ErrorNote message={dash.error ?? t("dashboard.loadFailed")} />;

  const d = dash.data;
  const challenge = d.daily_challenge;
  const levelProgress = d.level.next_level_at > 0 ? (d.level.points / d.level.next_level_at) * 100 : 100;
  const top = plan.data?.items.filter((i) => i.kind === "habit").slice(0, 3) ?? [];
  // The plan above already covers these; don't repeat them as nudges.
  const shown = new Set(top.map((i) => i.action_code));
  const rightNow = nudges.data?.nudges.filter((n) => !n.action_code || !shown.has(n.action_code)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{t("dashboard.greeting", { name: d.user.name.split(" ")[0] })}</p>
          <h1 className="text-2xl font-bold tracking-tight">{t("home.today")}</h1>
        </div>
        {flash && (
          <p className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong" role="status">
            {flash}
          </p>
        )}
      </div>
      <ErrorNote message={error} />

      {plan.data && (
        <section className="rounded-[2rem] bg-gradient-to-br from-[#0a8157] to-[#10a073] p-6 text-white shadow-[var(--shadow-lg)] sm:p-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">{t("plan.startHere")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {plan.data.total_rs_month > 0
              ? t("plan.hero", { rs: fmt.rs(plan.data.total_rs_month) })
              : t("plan.title")}
          </p>
          <Link href="/plan" className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold hover:bg-white/30">
            {t("plan.fullPlan")}
          </Link>
        </section>
      )}
      {top.length > 0 && <PlanList items={top} showWhy={false} onLogged={() => { dash.reload(); plan.reload(); }} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          tone="brand"
          label={t("dashboard.footprint")}
          value={fmt.kg(d.footprint.total_kg)}
          hint={t("dashboard.perPerson", { kg: fmt.kg(d.footprint.per_capita_kg) })}
        />
        <Stat
          tone="sky"
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
          tone="sun"
          label={t("dashboard.streak")}
          value={t(d.streak_days === 1 ? "dashboard.day" : "dashboard.days", { n: d.streak_days })}
          hint={t("dashboard.streakHint")}
        />
        <Stat
          tone="plain"
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
                  <span className="text-xs text-muted">
                    {t("dashboard.outside", { temp: nudges.data.temperature_c.toFixed(0) })}
                  </span>
                )
              }
            >
              {t("dashboard.rightNow")}
            </CardTitle>
            {nudges.loading && !nudges.data ? (
              <Spinner />
            ) : rightNow.length ? (
              <ul className="space-y-3">
                {rightNow.slice(0, 3).map((n) => (
                  <li key={n.code} className="rounded-2xl border border-border p-4">
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
        </div>

        <div className="space-y-6">
          <GreenHoursCard data={green.data} />
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
          </Card>
        </div>
      </div>
    </div>
  );
}
