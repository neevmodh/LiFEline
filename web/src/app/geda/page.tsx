"use client";

// Overview: the headline figures, what needs attention now, the trend, top districts and the live feed.
import Link from "next/link";
import { KpiRow, LiveFeed, TrendPanel } from "@/components/Console";
import { useConsole } from "@/components/geda/ConsoleContext";
import { PageIcon, type PageId } from "@/components/geda/nav";
import { ErrorNote, Spinner, fmt, useLoad } from "@/components/ui";
import { districtName, useI18n, type MessageKey } from "@/i18n";
import { api } from "@/lib/api";

function Attention({ id, href, n, label }: { id: PageId; href: string; n: number; label: MessageKey }) {
  const { t } = useI18n();
  return (
    <Link href={href} className={`flex items-center gap-4 rounded-3xl p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 ${n ? "bg-sun-soft" : "bg-surface"}`}>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${n ? "bg-sun text-text" : "bg-surface-2 text-muted"}`}><PageIcon id={id} /></span>
      <span className="min-w-0 flex-1">
        <span className="num block text-2xl font-bold">{fmt.int(n)}</span>
        <span className="block text-sm text-muted">{t(label, { n: fmt.int(n) })}</span>
      </span>
      <span aria-hidden className="text-muted">→</span>
    </Link>
  );
}

export default function OverviewPage() {
  const { t, locale } = useI18n();
  const { overview: o, error } = useConsole();
  const leads = useLoad(api.adminSolarLeads);
  const campaigns = useLoad(api.adminCampaigns);
  if (error) return <ErrorNote message={error} />;
  if (!o) return <Spinner />;
  const top = [...o.districts].sort((a, b) => b.co2_saved_30d_kg - a.co2_saved_30d_kg).slice(0, 5);

  return (
    <div className="space-y-6">
      <KpiRow o={o} />
      {o.citizens === 0 && <p className="rounded-2xl bg-sun-soft px-5 py-4 text-sm">{t("geda.noCitizens")}</p>}

      <section aria-labelledby="att">
        <h2 id="att" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t("con.attention")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Attention id="reviews" href="/geda/reviews" n={o.pending_reviews} label="con.att.reviews" />
          <Attention id="leads" href="/geda/leads" n={leads.data?.counts.new ?? 0} label="con.att.leads" />
          <Attention id="campaigns" href="/geda/campaigns" n={campaigns.data?.filter((c) => c.status === "active").length ?? 0} label="con.att.campaigns" />
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <TrendPanel o={o} />
          <section className="rounded-3xl bg-surface p-6 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{t("con.topDistricts")}</h2>
              <Link href="/geda/districts" className="text-sm font-semibold text-brand hover:underline">{t("con.allDistricts")}</Link>
            </div>
            <ol className="mt-3 divide-y divide-border">
              {top.map((d, i) => (
                <li key={d.district_id}>
                  <Link href={`/geda/districts?d=${encodeURIComponent(d.district)}`} className="flex items-center gap-4 py-3 hover:bg-bg">
                    <span className="num w-6 text-center font-bold text-muted">{i + 1}</span>
                    <span className="flex-1 font-semibold">{districtName(locale, d.district)}</span>
                    <span className="num text-sm text-muted">{fmt.int(d.citizens)} · {fmt.kg(d.co2_saved_30d_kg)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}
