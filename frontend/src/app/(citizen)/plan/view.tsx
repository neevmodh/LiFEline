"use client";

import Link from "next/link";
import { Card, CardTitle, ErrorNote, Spinner, fmt, useLoad } from "@/components/ui";
import { PlanList } from "@/components/PlanList";
import { api } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

const GROUPS: { effort: "easy" | "medium" | "investment"; label: MessageKey }[] = [
  { effort: "easy", label: "plan.easy" },
  { effort: "medium", label: "plan.medium" },
  { effort: "investment", label: "plan.investment" },
];

export default function PlanView() {
  const { t } = useI18n();
  const plan = useLoad(api.plan);
  if (plan.loading && !plan.data) return <Spinner />;
  if (plan.error || !plan.data) return <ErrorNote message={plan.error ?? t("plan.loadFailed")} />;
  const p = plan.data;
  const rate = t("plan.perUnit", { rs: `₹${p.marginal_rs_per_kwh.toFixed(2)}` });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("plan.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("plan.intro")}</p>
      </div>

      <section className="rounded-[2rem] bg-gradient-to-br from-[#0a8157] to-[#10a073] p-6 text-white shadow-[var(--shadow-lg)] sm:p-8">
        <p className="text-3xl font-bold tracking-tight sm:text-4xl">
          {p.total_rs_month > 0
            ? t("plan.hero", { rs: fmt.rs(p.total_rs_month) })
            : t("plan.heroNone", { bill: fmt.rs(p.bill_rs), rate })}
        </p>
        {p.total_rs_month > 0 && (
          <p className="mt-2 max-w-2xl text-white/90">{t("plan.heroSub", { bill: fmt.rs(p.bill_rs), rate })}</p>
        )}
        <p className="mt-4 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">
          {t("plan.co2", { kg: p.total_co2_month_kg.toFixed(0) })}
        </p>
      </section>

      {p.slab_note && (
        <Card className="border-sun/40 bg-sun-soft/50">
          <CardTitle>{t("plan.slabTitle")}</CardTitle>
          <p className="-mt-2 text-sm">{p.slab_note}</p>
        </Card>
      )}

      {GROUPS.map(({ effort, label }) => {
        const items = p.items.filter((i) => i.effort === effort);
        return items.length ? (
          <section key={effort}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{t(label)}</h2>
            <PlanList items={items} onLogged={plan.reload} />
          </section>
        ) : null;
      })}

      <Card>
        <p className="text-sm">{t("plan.appliance")}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-brand">
          <Link href="/solar">{t("plan.applianceLink")}</Link>
          <Link href="/actions">{t("plan.allActions")}</Link>
        </div>
      </Card>
    </div>
  );
}
