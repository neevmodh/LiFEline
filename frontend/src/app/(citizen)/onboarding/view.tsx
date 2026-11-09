"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FootprintPreview } from "@/components/FootprintPreview";
import { DEFAULT_HOUSEHOLD, ElectricityFields, HomeFields, TravelFields } from "@/components/HouseholdFields";
import { Button, Card, ErrorNote } from "@/components/ui";
import { api, type HouseholdInput } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/i18n";

const STEPS: { label: MessageKey; heading: MessageKey; Fields: typeof HomeFields }[] = [
  { label: "onboarding.step1", heading: "onboarding.step1Heading", Fields: HomeFields },
  { label: "onboarding.step2", heading: "onboarding.step2Heading", Fields: ElectricityFields },
  { label: "onboarding.step3", heading: "onboarding.step3Heading", Fields: TravelFields },
];

export default function OnboardingView() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<HouseholdInput>(DEFAULT_HOUSEHOLD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start with the distribution company that serves most of the user's district.
  useEffect(() => {
    if (!user?.district_id) return;
    api
      .districts()
      .then((ds) => {
        const suggested = ds.find((d) => d.id === user.district_id)?.suggested_discom;
        if (suggested) setForm((f) => ({ ...f, discom: suggested }));
      })
      .catch(() => {});
  }, [user?.district_id]);

  const set = <K extends keyof HouseholdInput>(key: K, value: HouseholdInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const { heading, Fields } = STEPS[step];

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api.saveHousehold(form);
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.saveFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <ol className="mb-6 flex gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s.label}
              aria-current={i === step ? "step" : undefined}
              className={`flex-1 rounded-full py-1.5 text-center ${
                i === step ? "bg-brand text-white dark:text-bg" : i < step ? "bg-brand-soft text-brand-strong" : "bg-surface-2 text-muted"
              }`}
            >
              {i + 1}. {t(s.label)}
            </li>
          ))}
        </ol>

        <h1 className="mb-5 text-xl font-semibold">{t(heading)}</h1>
        <Fields form={form} set={set} />

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            {t("common.back")}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>{t("common.continue")}</Button>
          ) : (
            <Button onClick={finish} disabled={busy}>
              {busy ? t("common.saving") : t("onboarding.finish")}
            </Button>
          )}
        </div>
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      </Card>

      <FootprintPreview input={form} />
    </div>
  );
}
