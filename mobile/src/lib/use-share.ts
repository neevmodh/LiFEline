// The share button's state: busy while the card downloads, and a message if it couldn't.
import { useState } from "react";

import { useI18n } from "@/i18n";
import { shareImpactCard } from "@/lib/share-card";

export function useShareCard() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return {
    busy,
    error,
    share: async () => {
      setBusy(true);
      setError(null);
      try {
        await shareImpactCard(t("share.title"));
      } catch {
        setError(t("share.failed"));
      } finally {
        setBusy(false);
      }
    },
  };
}
