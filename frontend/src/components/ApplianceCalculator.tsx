"use client";

import { useState } from "react";
import { Button, Card, CardTitle, ErrorNote, Field, Stat, fmt, inputClass } from "@/components/ui";
import { api, type ApplianceComparison } from "@/lib/api";
import { useI18n, type MessageKey } from "@/i18n";

const APPLIANCES: { value: string; label: MessageKey }[] = [
  { value: "ac", label: "appliance.ac" },
  { value: "refrigerator", label: "appliance.refrigerator" },
  { value: "geyser", label: "appliance.geyser" },
  { value: "fan", label: "appliance.fan" },
  { value: "tv", label: "appliance.tv" },
  { value: "other", label: "appliance.other" },
];

/** Compare two appliances by the annual units printed on their BEE star labels. */
export function ApplianceCalculator() {
  const { t } = useI18n();
  const [form, setForm] = useState({ appliance: "ac", old: "", next: "", price: "" });
  const [result, setResult] = useState<ApplianceComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.compareAppliances({
          appliance: form.appliance,
          old_kwh_per_year: Number(form.old),
          new_kwh_per_year: Number(form.next),
          new_price_rs: form.price ? Number(form.price) : null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setResult(null);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  return (
    <Card>
      <CardTitle>{t("appliance.title")}</CardTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{t("appliance.intro")}</p>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t("appliance.type")}>
          <select value={form.appliance} onChange={set("appliance")} className={inputClass}>
            {APPLIANCES.map((a) => (
              <option key={a.value} value={a.value}>
                {t(a.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("appliance.price")} hint={t("common.optional")}>
          <input type="number" min={0} value={form.price} onChange={set("price")} className={inputClass} />
        </Field>
        <Field label={t("appliance.old")} hint={t("appliance.labelHint")}>
          <input type="number" required min={1} value={form.old} onChange={set("old")} className={inputClass} />
        </Field>
        <Field label={t("appliance.new")} hint={t("appliance.labelHint")}>
          <input type="number" required min={1} value={form.next} onChange={set("next")} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? t("solar.calculating") : t("appliance.compare")}
          </Button>
        </div>
      </form>
      {result &&
        (result.kwh_saved_per_year <= 0 ? (
          <p className="mt-4 rounded-xl bg-sun-soft px-3 py-2 text-sm">{t("appliance.noSaving")}</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("appliance.units")} value={`${fmt.int(result.kwh_saved_per_year)} kWh`} hint={t("appliance.perYear")} />
            <Stat label={t("appliance.rupees")} value={fmt.rs(result.rs_saved_per_year)} hint={t("appliance.atYourTariff")} />
            <Stat label={t("dashboard.co2")} value={fmt.kg(result.co2_saved_kg_per_year)} hint={t("appliance.perYear")} />
            <Stat
              label={t("solar.payback")}
              value={result.payback_years ? t("solar.years", { n: result.payback_years }) : "–"}
              hint={result.payback_years ? t("appliance.tenYear", { rs: fmt.rs(result.ten_year_savings_rs) }) : undefined}
            />
          </div>
        ))}
    </Card>
  );
}
