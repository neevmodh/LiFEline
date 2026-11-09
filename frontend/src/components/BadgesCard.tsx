"use client";

import { Card, CardTitle, ProgressBar } from "@/components/ui";
import type { Badge } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

const ICON: Record<string, string> = {
  first_step: "🌱",
  peak_shifter: "🌙",
  week_streak: "🔥",
  co2_10: "🌍",
  verified: "✅",
  tree_planter: "🌳",
  solar_step: "☀️",
  bill_tracker: "📊",
};

/** Milestones earned from the citizen's real actions and bills. */
export function BadgesCard({ badges }: { badges: Badge[] | null }) {
  const { t } = useI18n();
  if (!badges) return null;
  const earned = badges.filter((b) => b.earned).length;
  return (
    <Card>
      <CardTitle aside={<span className="text-xs text-muted">{t("badges.count", { n: earned, total: badges.length })}</span>}>
        {t("badges.title")}
      </CardTitle>
      <ul className="grid grid-cols-2 gap-2">
        {badges.map((b) => (
          <li
            key={b.code}
            className={`rounded-xl border p-3 ${b.earned ? "border-brand bg-brand-soft" : "border-border opacity-80"}`}
            title={t(`badge.${b.code}.how` as MessageKey, { n: b.target })}
          >
            <p className="text-sm font-medium">
              <span aria-hidden className={b.earned ? "" : "grayscale"}>
                {ICON[b.code] ?? "🏅"}
              </span>{" "}
              {t(`badge.${b.code}` as MessageKey)}
            </p>
            <p className="mt-0.5 text-xs text-muted">{t(`badge.${b.code}.how` as MessageKey, { n: b.target })}</p>
            {!b.earned && (
              <div className="mt-2">
                <ProgressBar value={b.progress * 100} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
