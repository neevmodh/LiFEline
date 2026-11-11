// Spots actions that GEDA verified since the app last looked, so the app can celebrate them. The ids
// already seen are kept on the phone; the first time, everything already verified counts as seen,
// so a fresh install doesn't celebrate old approvals.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { CelebrationInfo } from "@/components/motion";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { getItem, setItem } from "@/lib/storage";

const KEY = "nidhi.verifiedSeen";

export function useVerifiedCelebration(): [CelebrationInfo | null, () => void] {
  const { t } = useI18n();
  const mine = useQuery({ queryKey: ["actions", "mine"], queryFn: () => api.myActions(), refetchInterval: 5 * 60_000 });
  const [info, setInfo] = useState<CelebrationInfo | null>(null);

  useEffect(() => {
    const logs = mine.data;
    if (!logs) return;
    let cancelled = false;
    (async () => {
      const verified = logs.filter((l) => l.status === "verified");
      const raw = await getItem(KEY);
      const seen = new Set<number>(raw ? (JSON.parse(raw) as number[]) : verified.map((l) => l.id));
      const fresh = verified.filter((l) => !seen.has(l.id));
      await setItem(KEY, JSON.stringify(verified.map((l) => l.id)));
      if (cancelled || fresh.length === 0) return;
      const kg = Math.round(fresh.reduce((s, l) => s + l.co2_saved_kg, 0) * 10) / 10;
      const title = fresh.length === 1 ? fresh[0].action.title : `${fresh.length} × ${fresh[0].action.title}`;
      setInfo({
        points: fresh.reduce((s, l) => s + l.points_awarded, 0),
        badge: t("verified.title"),
        title: t("verified.title"),
        body: kg > 0 ? t("verified.body", { title, kg }) : t("verified.bodyNoCo2", { title }),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [mine.data, t]);

  return [info, () => setInfo(null)];
}
