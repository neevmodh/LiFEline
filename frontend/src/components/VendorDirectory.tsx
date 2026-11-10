"use client";

import { Card, CardTitle } from "@/components/ui";
import { useI18n } from "@/i18n";

// Official sources only. The national portal lists every registered installer by state and
// district with ratings, installations and contacts; Nidhi links to it rather than keeping
// a copy that would go stale.
const PORTAL = "https://pmsuryaghar.gov.in/#/registered-vendors";
const DEACTIVATED = "https://pmsuryaghar.gov.in/#/list-of-deactivated-vendors";
const SURYA_GUJARAT = "https://suryagujarat.guvnl.in/";

/** Find a government-registered rooftop solar installer in the citizen's own district. */
export function VendorDirectory({ district }: { district?: string | null }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardTitle>{t("vendors.title")}</CardTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{t("vendors.intro")}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          {t("vendors.step1")}{" "}
          <a href={PORTAL} target="_blank" rel="noreferrer" className="font-medium text-brand underline">
            {t("vendors.portal")}
          </a>
        </li>
        <li>{t("vendors.step2", { district: district ?? t("vendors.yourDistrict") })}</li>
        <li>{t("vendors.step3")}</li>
        <li>
          {t("vendors.step4")}{" "}
          <a href={DEACTIVATED} target="_blank" rel="noreferrer" className="font-medium text-brand underline">
            {t("vendors.deactivated")}
          </a>
          .
        </li>
        <li>
          {t("vendors.step5")}{" "}
          <a href={SURYA_GUJARAT} target="_blank" rel="noreferrer" className="font-medium text-brand underline">
            SURYA Gujarat
          </a>
          .
        </li>
      </ol>
      <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t("vendors.note")}</p>
    </Card>
  );
}
