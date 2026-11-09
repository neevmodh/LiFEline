"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ErrorNote, fmt } from "@/components/ui";
import { ApiError, api, type PlanItem } from "@/lib/api";
import { queueAction } from "@/lib/offline";
import { useI18n } from "@/i18n";

/** Steps from the household's own plan, each with what it's worth and why. */
export function PlanList({
  items,
  onLogged,
  showWhy = true,
}: {
  items: PlanItem[];
  onLogged: () => void;
  showWhy?: boolean;
}) {
  const { t } = useI18n();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function log(code: string, actionCode: string) {
    setError(null);
    try {
      await api.logAction(actionCode);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) queueAction(actionCode);
      else return setError(e instanceof Error ? e.message : t("actions.logFailed"));
    }
    setDone((d) => new Set(d).add(code));
    onLogged();
  }

  return (
    <div>
      <ErrorNote message={error} />
      <ul className="space-y-3">
        {items.map((item) => {
          const finished = item.logged_today || done.has(item.code);
          return (
            <li key={item.code} className="rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    {item.rs_month > 0 && (
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-strong">
                        {t("plan.perMonth", { rs: fmt.rs(item.rs_month) })}
                      </span>
                    )}
                    {item.kwh_month > 0 && (
                      <span className="rounded-full bg-sky-soft px-2.5 py-1 text-sky">
                        {t("plan.units", { n: fmt.int(item.kwh_month) })}
                      </span>
                    )}
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">
                      {t("plan.co2", { kg: item.co2_month_kg.toFixed(item.co2_month_kg < 10 ? 1 : 0) })}
                    </span>
                  </div>
                  {showWhy && <p className="mt-3 text-sm leading-relaxed text-muted">{item.why}</p>}
                </div>
                {item.action_code ? (
                  finished ? (
                    <span className="rounded-2xl bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-strong">
                      {t("plan.doneToday")}
                    </span>
                  ) : (
                    <Button variant="ghost" onClick={() => log(item.code, item.action_code!)}>
                      {t("plan.didThis")}
                    </Button>
                  )
                ) : item.code === "solar" ? (
                  <Link href="/solar" className="rounded-2xl bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-strong">
                    {t("plan.seeSolar")}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
