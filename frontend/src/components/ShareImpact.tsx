"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

/** Share a picture of your real impact; falls back to downloading it where sharing files isn't supported. */
export function ShareImpact() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const blob = await api.shareCard();
      const file = new File([blob], "my-mission-life-impact.png", { type: "image/png" });
      const text = t("share.text", { url: window.location.origin });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), { href: url, download: file.name }).click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Cancelled by the user, or offline: nothing to do.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" onClick={share} disabled={busy}>
      {busy ? t("common.wait") : t("share.button")}
    </Button>
  );
}
