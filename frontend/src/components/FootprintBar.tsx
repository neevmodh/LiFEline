"use client";

import type { Footprint } from "@/lib/api";
import { fmt } from "@/components/ui";
import { useI18n } from "@/i18n";

const PARTS = [
  { key: "electricity_kg", label: "footprint.electricity", color: "var(--chart-1)" },
  { key: "cooking_kg", label: "footprint.cooking", color: "var(--chart-2)" },
  { key: "commute_kg", label: "footprint.commute", color: "var(--chart-3)" },
] as const;

/** Stacked bar of the monthly footprint split by source, with a legend. */
export function FootprintBar({ footprint }: { footprint: Footprint }) {
  const { t } = useI18n();
  const total = footprint.total_kg || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
        {PARTS.map((p) => (
          <div
            key={p.key}
            style={{ width: `${(footprint[p.key] / total) * 100}%`, background: p.color }}
            title={`${t(p.label)}: ${fmt.kg(footprint[p.key])}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {PARTS.map((p) => (
          <li key={p.key}>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {t(p.label)}
            </span>
            <span className="font-medium tabular-nums">{fmt.kg(footprint[p.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
