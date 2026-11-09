"use client";

import { useEffect, useState } from "react";
import { FootprintPreview } from "@/components/FootprintPreview";
import { ElectricityFields, HomeFields, TravelFields } from "@/components/HouseholdFields";
import { Button, Card, CardTitle, ErrorNote, Field, Spinner, inputClass } from "@/components/ui";
import { api, type District, type HouseholdInput } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";

function AccountCard() {
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const [districts, setDistricts] = useState<District[]>([]);
  const [account, setAccount] = useState({ name: user?.name ?? "", district_id: user?.district_id ?? 0, ward: user?.ward ?? "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.districts().then(setDistricts).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.updateProfile({ name: account.name, district_id: account.district_id, ward: account.ward.trim() || null });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  return (
    <Card>
      <CardTitle>{t("profile.account")}</CardTitle>
      <form onSubmit={save} className="space-y-4" onChange={() => setSaved(false)}>
        <Field label={t("profile.name")}>
          <input
            required
            maxLength={120}
            value={account.name}
            onChange={(e) => setAccount((a) => ({ ...a, name: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.district")}>
            <select
              value={account.district_id}
              onChange={(e) => setAccount((a) => ({ ...a, district_id: Number(e.target.value) }))}
              className={inputClass}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("auth.ward")} hint={t("profile.wardHint")}>
            <input
              maxLength={80}
              value={account.ward}
              onChange={(e) => setAccount((a) => ({ ...a, ward: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        <ErrorNote message={error} />
        <div className="flex items-center gap-3">
          <Button type="submit">{t("profile.saveAccount")}</Button>
          {saved && <span className="text-sm text-brand" role="status">{t("common.saved")}</span>}
        </div>
      </form>
    </Card>
  );
}

export default function ProfileView() {
  const { t } = useI18n();
  const [form, setForm] = useState<HouseholdInput | null>(null);
  const [baseline, setBaseline] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .household()
      .then(({ household }) => {
        const { baseline_kg_co2_month, ...answers } = household;
        setForm(answers);
        setBaseline(baseline_kg_co2_month);
      })
      .catch((e) => setError(e.message));
  }, []);

  const set = <K extends keyof HouseholdInput>(key: K, value: HouseholdInput[K]) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  async function saveHousehold() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.saveHousehold(form);
      setBaseline(res.household.baseline_kg_co2_month);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.profile")}</h1>
        <p className="mt-1 text-sm text-muted">{t("profile.intro")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <AccountCard />
          {!form ? (
            error ? <ErrorNote message={error} /> : <Spinner />
          ) : (
            <Card>
              <CardTitle>{t("profile.household")}</CardTitle>
              <div className="space-y-8">
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-muted">{t("profile.home")}</h3>
                  <HomeFields form={form} set={set} />
                </section>
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-muted">{t("onboarding.step2")}</h3>
                  <ElectricityFields form={form} set={set} />
                </section>
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-muted">{t("profile.cookingTravel")}</h3>
                  <TravelFields form={form} set={set} />
                </section>
              </div>
              <p className="mt-6 text-xs text-muted">{t("profile.resetNote")}</p>
              <ErrorNote message={error} />
              <div className="mt-3 flex items-center gap-3">
                <Button onClick={saveHousehold} disabled={busy}>
                  {busy ? t("common.saving") : t("profile.saveHousehold")}
                </Button>
                {saved && <span className="text-sm text-brand" role="status">{t("common.saved")}</span>}
              </div>
            </Card>
          )}
        </div>
        {form && <FootprintPreview input={form} baselineKg={baseline} />}
      </div>
    </div>
  );
}
