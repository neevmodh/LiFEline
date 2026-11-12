// Spots a prize won since the app last looked, so it can be celebrated once. The prizes already seen
// are kept on the phone; the first time, everything already won counts as seen, so a fresh install
// doesn't celebrate old wins.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { CelebrationInfo } from "@/components/celebration";
import { useI18n, type MessageKey } from "@/i18n";
import { api } from "@/lib/api";
import { newlyWon, prizes } from "@/lib/prizes";
import { getItem, setItem } from "@/lib/storage";

const KEY = "nidhi.prizesSeen";

export function usePrizeCelebration(): [CelebrationInfo | null, () => void] {
  const { t } = useI18n();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const badges = useQuery({ queryKey: ["badges"], queryFn: api.badges });
  const mine = useQuery({ queryKey: ["actions", "mine"], queryFn: () => api.myActions() });
  const [info, setInfo] = useState<CelebrationInfo | null>(null);

  useEffect(() => {
    if (!dashboard.data || !badges.data || !mine.data) return;
    const list = prizes({ points: dashboard.data.level.points, streakDays: dashboard.data.streak_days, logs: mine.data, badges: badges.data });
    let cancelled = false;
    (async () => {
      const raw = await getItem(KEY);
      const won = list.filter((p) => p.won).map((p) => p.code);
      if (raw === null) {
        await setItem(KEY, JSON.stringify(won));
        return;
      }
      let seenList: string[] = [];
      try {
        seenList = JSON.parse(raw) as string[];
      } catch {
        // A damaged record: start again from what's won now rather than celebrate everything.
        await setItem(KEY, JSON.stringify(won));
        return;
      }
      const fresh = newlyWon(list, new Set(seenList));
      if (fresh.length === 0) return;
      await setItem(KEY, JSON.stringify([...new Set([...seenList, ...won])]));
      if (cancelled) return;
      const first = fresh[0];
      setInfo({
        kind: "prize",
        tier: first.tier,
        points: 0,
        badge: t("prize.won"),
        title: t(`prize.${first.code}` as MessageKey),
        body: fresh.length > 1 ? t("prize.wonMany", { n: fresh.length }) : t(`prize.${first.code}.how` as MessageKey),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboard.data, badges.data, mine.data, t]);

  return [info, () => setInfo(null)];
}
