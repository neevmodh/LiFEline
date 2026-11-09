"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryChart, WeeklySeries } from "@/components/AdminCharts";
import { BoothPanel } from "@/components/BoothPanel";
import { DistrictExplorer } from "@/components/DistrictExplorer";
import { SolarScenario } from "@/components/SolarScenario";
import { Badge, Button, Card, CardTitle, ErrorNote, Spinner, Stat, fmt, plural, useLoad } from "@/components/ui";
import { api, type ReviewItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// The AI only pre-screens; the reviewer makes every decision.
const AI_LABEL: Record<NonNullable<ReviewItem["ai_verdict"]>, string> = {
  likely: "looks genuine",
  unlikely: "looks unrelated",
  unsure: "unclear",
};
const AI_TONE: Record<NonNullable<ReviewItem["ai_verdict"]>, "brand" | "danger" | "muted"> = {
  likely: "brand",
  unlikely: "danger",
  unsure: "muted",
};

function ReviewRow({ item, onDecided, canDecide = true }: { item: ReviewItem; onDecided: () => void; canDecide?: boolean }) {
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
        {item.ai_verdict && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone={AI_TONE[item.ai_verdict]}>
              AI: {AI_LABEL[item.ai_verdict]}
              {item.ai_confidence !== null && ` · ${Math.round(item.ai_confidence * 100)}%`}
            </Badge>
            {item.ai_reason}
          </p>
        )}
        <ErrorNote message={error} />
      </div>
      {canDecide && (
        <div className="flex gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>
            Reject
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            Approve
          </Button>
        </div>
      )}
    </li>
  );
}

/** The review queue on its own, for reviewers. */
function ReviewerQueue() {
  const reviews = useLoad(api.reviews);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Gujarat Energy Development Agency · Reviewer</p>
        <h1 className="text-2xl font-bold tracking-tight">Proof review queue</h1>
      </div>
      <Card>
        <CardTitle aside={<Badge tone="sun">{reviews.data?.length ?? 0} pending</Badge>}>Photos to review</CardTitle>
        {reviews.loading && !reviews.data ? (
          <Spinner />
        ) : reviews.error ? (
          <ErrorNote message={reviews.error} />
        ) : reviews.data?.length ? (
          <ul className="divide-y divide-border">
            {reviews.data.map((item) => (
              <ReviewRow
                key={item.id}
                item={item}
                onDecided={() => reviews.setData((list) => list?.filter((r) => r.id !== item.id) ?? null)}
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

export default function AdminView() {
  const { user } = useAuth();
  if (user?.role === "reviewer") return <ReviewerQueue />;
  return <Analytics readOnly={user?.role === "auditor"} />;
}

function Analytics({ readOnly }: { readOnly: boolean }) {
  const { user } = useAuth();
  const officer = user?.role === "officer";
  const overview = useLoad(api.adminOverview);
  // Auditors can read every dashboard but not the review queue (they can't act on it).
  const reviews = useLoad(readOnly ? async () => [] as ReviewItem[] : api.reviews);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [booth, setBooth] = useState(false);
  const explorerRef = useRef<HTMLDivElement>(null);

  if (overview.loading && !overview.data) return <Spinner />;
  if (overview.error || !overview.data) return <ErrorNote message={overview.error ?? "Could not load overview"} />;
  const o = overview.data;
  const ranked = [...o.districts].sort((a, b) => b.co2_saved_30d_kg - a.co2_saved_30d_kg);
  const active = ranked.filter((d) => d.citizens > 0);
  const notReached = ranked.filter((d) => d.citizens === 0);
  // Open on the district with the most impact until the admin picks one.
  // District officers open on their own district; the state team on the most active one.
  const shownId = selectedId ?? (officer ? user?.district_id : active[0]?.district_id) ?? null;
  const officerDistrict = officer ? o.districts.find((d) => d.district_id === user?.district_id)?.district : null;
  const totalSolarKw = o.districts.reduce((sum, d) => sum + d.solar_potential_kwp, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Gujarat Energy Development Agency{officerDistrict && ` · District officer, ${officerDistrict}`}{readOnly && " · Auditor (read-only)"}
          </p>
          <h1 className="text-2xl font-semibold">Mission LiFE regional overview</h1>
        </div>
        <Button variant={booth ? "primary" : "ghost"} onClick={() => setBooth((b) => !b)} aria-pressed={booth}>
          {booth ? "Booth mode on" : "Booth mode"}
        </Button>
      </div>

      {/* New sign-ups and actions refresh the map and totals below as they arrive. */}
      {booth && (
        <BoothPanel
          onActivity={() => {
            overview.reload();
            reviews.reload();
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat tone="brand" label="Citizens" value={fmt.int(o.citizens)} hint={`${active.length} of 33 districts reached`} />
        <Stat tone="sky"
          label="Active this week"
          value={fmt.int(o.active_7d)}
          hint={o.citizens ? `${Math.round((o.active_7d / o.citizens) * 100)}% of citizens` : undefined}
        />
        <Stat tone="sun"
          label="CO₂ avoided"
          value={fmt.kg(o.co2_saved_total_kg)}
          hint={`${fmt.kg(o.co2_verified_total_kg)} photo-verified · ${plural(o.actions_total, "action")}`}
        />
        <Stat tone="plain" label="Electricity saved" value={`${fmt.int(o.kwh_saved_total)} kWh`} hint={`${o.pending_reviews} proofs awaiting review`} />
        <Stat tone="brand" label="Rooftop solar potential" value={`${fmt.int(totalSolarKw)} kW`} hint="on registered homes without solar" />
      </div>

      <Card>
        <CardTitle>Rooftop solar: what scaling up would mean for Gujarat</CardTitle>
        <SolarScenario title="All registered homes statewide" refreshKey={o.citizens} />
      </Card>

      <div ref={explorerRef} className="scroll-mt-20">
        <DistrictExplorer districts={o.districts} selectedId={shownId} onSelect={setSelectedId} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle>CO₂ avoided per week</CardTitle>
          <WeeklySeries data={o.weekly} measure="co2" />
        </Card>
        <Card>
          <CardTitle>Active citizens per week</CardTitle>
          <WeeklySeries data={o.weekly} measure="active" />
        </Card>
        <Card>
          <CardTitle>Impact by action type</CardTitle>
          <CategoryChart data={o.categories} />
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <CardTitle aside={<span className="text-xs text-muted">Click a row to open it on the map</span>}>
          District performance
        </CardTitle>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">District</th>
              <th className="pb-2 text-right font-medium">Citizens</th>
              <th className="pb-2 text-right font-medium">Active 7d</th>
              <th className="pb-2 text-right font-medium">CO₂ 30d</th>
              <th className="pb-2 text-right font-medium">Per citizen</th>
              <th className="pb-2 text-right font-medium">Avg footprint</th>
              <th className="pb-2 text-right font-medium">Solar potential</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {active.map((d) => (
              <tr
                key={d.district_id}
                onClick={() => {
                  setSelectedId(d.district_id);
                  explorerRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`cursor-pointer hover:bg-surface-2 ${d.district_id === shownId ? "bg-brand-soft/60" : ""}`}
              >
                <td className="py-2 font-medium">{d.district}</td>
                <td className="py-2 text-right tabular-nums">{d.citizens}</td>
                <td className="py-2 text-right tabular-nums">
                  {d.active_7d} <span className="text-xs text-muted">({Math.round(d.participation_pct ?? 0)}%)</span>
                </td>
                <td className="py-2 text-right tabular-nums">{fmt.kg(d.co2_saved_30d_kg)}</td>
                <td className="py-2 text-right tabular-nums">
                  {d.co2_per_citizen_30d_kg != null ? fmt.kg(d.co2_per_citizen_30d_kg) : "–"}
                </td>
                <td className="py-2 text-right tabular-nums">{d.avg_baseline_kg != null ? fmt.kg(d.avg_baseline_kg) : "–"}</td>
                <td className="py-2 text-right tabular-nums">{fmt.int(d.solar_potential_kwp)} kW</td>
              </tr>
            ))}
          </tbody>
        </table>
        {notReached.length > 0 && (
          <p className="mt-4 rounded-xl bg-sun-soft px-3 py-2 text-sm">
            <span className="font-medium">Not reached yet ({notReached.length}):</span>{" "}
            <span className="text-muted">{notReached.map((d) => d.district).join(", ")}</span>
          </p>
        )}
      </Card>

      {!readOnly && (
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
      )}
    </div>
  );
}
