"use client";

import { Badge, Card, CardTitle } from "@/components/ui";
import type { GreenHours, GreenWindow } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

const SKY: Record<GreenWindow["sky"], { key: MessageKey; tone: "sun" | "brand" | "muted" }> = {
  sunny: { key: "green.sky.sunny", tone: "sun" },
  partly_cloudy: { key: "green.sky.partly_cloudy", tone: "brand" },
  cloudy: { key: "green.sky.cloudy", tone: "muted" },
};

function hour(h: number): string {
  const suffix = h < 12 || h === 24 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

function Row({ label, w }: { label: string; w: GreenWindow }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-semibold tabular-nums">
          {hour(w.start_hour)} – {hour(w.end_hour)}
        </p>
      </div>
      <div className="text-right">
        <Badge tone={SKY[w.sky].tone}>{t(SKY[w.sky].key)}</Badge>
        <p className="mt-1 text-xs text-muted tabular-nums">{t("green.radiation", { w: w.avg_radiation_w_m2 })}</p>
      </div>
    </div>
  );
}

/** Cleanest hours to run heavy appliances, from the district's real solar forecast. */
export function GreenHoursCard({ data }: { data: GreenHours | null }) {
  const { t } = useI18n();
  if (!data || (!data.today && !data.tomorrow)) return null;
  return (
    <Card>
      <CardTitle aside={<Badge tone="sun">{t("green.badge")}</Badge>}>{t("green.title")}</CardTitle>
      <p className="-mt-2 mb-3 text-sm text-muted">{t("green.intro")}</p>
      <div className="space-y-2">
        {data.today && <Row label={t("green.today")} w={data.today} />}
        {data.tomorrow && <Row label={t("green.tomorrow")} w={data.tomorrow} />}
      </div>
      <p className="mt-3 text-xs text-muted">
        {t("green.note", { district: data.district ?? "", peak: `${hour(data.peak_hours[0])}–${hour(data.peak_hours[1])}` })}
      </p>
    </Card>
  );
}
