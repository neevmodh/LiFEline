"use client";

import { useEffect, useState } from "react";
import { GujaratMap } from "@/components/map";
import { Card, CardTitle, ErrorNote, ProgressBar, Spinner, fmt, plural } from "@/components/ui";
import { api, type DistrictRank, type Period, type UserRank } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1 ${value === o.value ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function CommunityView() {
  const [period, setPeriod] = useState<Period>("week");
  const { user } = useAuth();
  const [scope, setScope] = useState<"ward" | "district" | "state">("district");
  const [users, setUsers] = useState<UserRank[] | null>(null);
  const [districts, setDistricts] = useState<DistrictRank[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.userLeaderboard(period, scope), api.districtLeaderboard()])
      .then(([u, d]) => {
        if (cancelled) return;
        setUsers(u);
        setDistricts(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [period, scope]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community</h1>
          <p className="mt-1 text-sm text-muted">Every action counts towards your district&apos;s monthly goal.</p>
        </div>
        <Segmented value={period} options={PERIODS} onChange={setPeriod} />
      </div>
      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle
            aside={
              <Segmented
                value={scope}
                options={[
                  ...(user?.ward ? [{ value: "ward" as const, label: "My ward" }] : []),
                  { value: "district" as const, label: "District" },
                  { value: "state" as const, label: "Gujarat" },
                ]}
                onChange={setScope}
              />
            }
          >
            Top citizens
          </CardTitle>
          {!users ? (
            <Spinner />
          ) : (
            <ol className="space-y-1">
              {users.map((u) => (
                <li
                  key={u.user_id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${u.is_me ? "bg-brand-soft" : ""}`}
                >
                  <span className={`w-7 text-sm font-semibold tabular-nums ${u.rank <= 3 ? "text-sun" : "text-muted"}`}>
                    {u.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name} {u.is_me && <span className="text-xs text-brand-strong">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{[u.ward, u.district].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmt.int(u.points)}</p>
                    <p className="text-xs text-muted">{fmt.kg(u.co2_saved_kg)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle>District goals this month</CardTitle>
          <p className="-mt-2 mb-4 text-xs text-muted">
            Each district aims to avoid 10% of its citizens&apos; combined monthly footprint. Ranked by progress, so smaller
            districts can win too.
          </p>
          {!districts ? (
            <Spinner />
          ) : (
            <>
              <div className="mb-5">
                <GujaratMap
                  height={340}
                  highlight={districts.find((d) => d.district_id === user?.district_id)?.district}
                  metric={{
                    label: "Progress to this month's goal",
                    format: (v) => `${Math.round(v)}%`,
                    values: Object.fromEntries(districts.map((d) => [d.district, d.goal_progress_pct])),
                  }}
                  tooltipExtra={(name) => {
                    const d = districts.find((x) => x.district === name);
                    return d ? [`${fmt.kg(d.co2_saved_kg)} of ${fmt.kg(d.monthly_goal_kg)} · rank #${d.rank}`] : [];
                  }}
                />
                <p className="mt-2 text-xs text-muted">Your district has a dashed outline.</p>
              </div>
              <ol className="space-y-4">
                {districts.map((d) => (
                  <li key={d.district_id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span>
                        <span className="mr-2 font-semibold text-muted tabular-nums">{d.rank}</span>
                        <span className="font-medium">{d.district}</span>
                        <span className="ml-2 text-xs text-muted">{plural(d.participants, "citizen")}</span>
                      </span>
                      <span className="text-xs text-muted tabular-nums">
                        {fmt.kg(d.co2_saved_kg)} / {fmt.kg(d.monthly_goal_kg)}
                      </span>
                    </div>
                    <ProgressBar value={d.goal_progress_pct} tone={d.goal_progress_pct >= 100 ? "sun" : "brand"} />
                  </li>
                ))}
              </ol>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
