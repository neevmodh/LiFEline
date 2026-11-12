// Logging an action from any screen: send it (or keep it on the phone when offline), refresh what
// depends on it, and hand back what the celebration should say. With a photo the action waits for
// GEDA's review and earns its full points then; without one it counts now for 40%.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

import type { CelebrationInfo } from "@/components/celebration";
import { useI18n } from "@/i18n";
import { api, ApiError, type Photo } from "@/lib/api";
import { enqueue } from "@/lib/queue";

type Vars = { code: string; title: string; fullPoints: number; proof?: Photo };

export function useLogAction() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const log = useMutation({
    mutationFn: ({ code, proof }: Vars) => api.logAction(code, proof),
    onSuccess: (res, { title, fullPoints }) => {
      setError(null);
      setCelebration(
        res.status === "pending"
          ? { points: fullPoints, title: t("celebrate.pendingTitle"), body: t("celebrate.pendingBody", { title }), badge: t("celebrate.badgePending") }
          : { points: res.points_awarded, title: t("celebrate.loggedTitle", { title }), body: t("celebrate.loggedBody"), badge: t("celebrate.badgeLogged") },
      );
      void qc.invalidateQueries();
    },
    onError: async (e, { code, title, proof }) => {
      if (e instanceof ApiError && e.status === 0 && !proof) {
        await enqueue(code, title);
        setError(t("act.offlineQueued", { title }));
        return;
      }
      // 409: this photo was already used; 429: daily limit; 422: not for this home. The server says which.
      setError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown"));
    },
  });

  async function withPhoto(vars: Omit<Vars, "proof">) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
    const res = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) log.mutate({ ...vars, proof: res.assets[0] });
  }

  return {
    logNow: (vars: Omit<Vars, "proof">) => log.mutate(vars),
    withPhoto,
    busy: log.isPending,
    error,
    clearError: () => setError(null),
    celebration,
    closeCelebration: () => setCelebration(null),
  };
}
