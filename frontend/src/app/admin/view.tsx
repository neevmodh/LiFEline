"use client";

import { useEffect, useState } from "react";
import { CategoryChart, DistrictMap, WeeklyChart } from "@/components/AdminCharts";
import { Badge, Button, Card, CardTitle, ErrorNote, Spinner, Stat, fmt, useLoad } from "@/components/ui";
import { api, type ReviewItem } from "@/lib/api";

function ReviewRow({ item, onDecided }: { item: ReviewItem; onDecided: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    api
      .proofUrl(item.id)
      .then((u) => {
        url = u;
        setSrc(u);
      })
      .catch(() => setSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.id]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      await api.decideReview(item.id, approve);
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-4 py-3">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-xs text-muted">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL, not optimisable
          <img src={src} alt={`Proof for ${item.action_title}`} className="h-full w-full object-cover" />
        ) : (
          "No image"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.action_title}</p>
        <p className="text-xs text-muted">
          {item.user_name}
          {item.district && ` · ${item.district}`} · {new Date(item.created_at).toLocaleDateString("en-IN")}
        </p>
        {item.note && <p className="mt-1 text-xs">“{item.note}”</p>}
        <ErrorNote message={error} />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>
          Reject
        </Button>
        <Button disabled={busy} onClick={() => decide(true)}>
          Approve
        </Button>
      </div>
    </li>
  );
}

export default function AdminView() {
  const overview = useLoad(api.adminOverview);
  const reviews = useLoad(api.reviews);

  if (overview.loading && !overview.data) return <Spinner />;
  if (overview.error || !overview.data) return <ErrorNote message={overview.error ?? "Could not load overview"} />;
  const o = overview.data;
  const districts = [...o.districts].filter((d) => d.citizens > 0).sort((a, b) => b.co2_saved_30d_kg - a.co2_saved_30d_kg);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Gujarat Energy Development Agency</p>
        <h1 className="text-2xl font-semibold">Mission LiFE regional overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Citizens" value={fmt.int(o.citizens)} hint={`${fmt.int(o.onboarded)} completed onboarding`} />
        <Stat
          label="Active this week"
          value={fmt.int(o.active_7d)}
          hint={o.citizens ? `${Math.round((o.active_7d / o.citizens) * 100)}% of citizens` : undefined}
        />
        <Stat label="CO₂ avoided" value={fmt.kg(o.co2_saved_total_kg)} hint={`${fmt.int(o.actions_total)} actions logged`} />
        <Stat label="Electricity saved" value={`${fmt.int(o.kwh_saved_total)} kWh`} hint={`${o.pending_reviews} proofs awaiting review`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>Weekly impact</CardTitle>
          <WeeklyChart data={o.weekly} />
        </Card>
        <Card>
          <CardTitle>Impact by action type</CardTitle>
          <CategoryChart data={o.categories} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardTitle>Districts by impact (30 days)</CardTitle>
          <DistrictMap data={o.districts} />
        </Card>
        <Card className="overflow-x-auto">
          <CardTitle>District performance</CardTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">District</th>
                <th className="pb-2 text-right font-medium">Citizens</th>
                <th className="pb-2 text-right font-medium">Active 7d</th>
                <th className="pb-2 text-right font-medium">CO₂ 30d</th>
                <th className="pb-2 text-right font-medium">Avg baseline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {districts.map((d) => (
                <tr key={d.district_id}>
                  <td className="py-2 font-medium">{d.district}</td>
                  <td className="py-2 text-right tabular-nums">{d.citizens}</td>
                  <td className="py-2 text-right tabular-nums">
                    {d.active_7d}{" "}
                    <span className="text-xs text-muted">({Math.round((d.active_7d / d.citizens) * 100)}%)</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt.kg(d.co2_saved_30d_kg)}</td>
                  <td className="py-2 text-right tabular-nums">{d.avg_baseline_kg != null ? fmt.kg(d.avg_baseline_kg) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <CardTitle aside={<Badge tone="sun">{reviews.data?.length ?? 0} pending</Badge>}>Proof review queue</CardTitle>
        {reviews.loading && !reviews.data ? (
          <Spinner />
        ) : reviews.data?.length ? (
          <ul className="divide-y divide-border">
            {reviews.data.map((item) => (
              <ReviewRow
                key={item.id}
                item={item}
                onDecided={() => {
                  reviews.setData((list) => list?.filter((r) => r.id !== item.id) ?? null);
                  overview.reload();
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">All caught up.</p>
        )}
      </Card>
    </div>
  );
}
