"use client";

import { BillScanner } from "@/components/BillScanner";
import { Field, inputClass } from "@/components/ui";
import type { CommuteMode, Discom, HouseholdInput, TariffArea } from "@/lib/api";
import { useConfig } from "@/lib/config";
import { useI18n, type MessageKey } from "@/i18n";

export const DEFAULT_HOUSEHOLD: HouseholdInput = {
  members: 4,
  home_type: "apartment",
  roof_area_sqm: null,
  monthly_kwh: 250,
  ac_count: 1,
  has_geyser: true,
  has_washing_machine: true,
  has_ev: false,
  has_solar: false,
  lpg_cylinders_per_month: 1,
  commute_mode: "two_wheeler",
  commute_km_per_day: 12,
  discom: "ugvcl",
  area: "urban",
};

const COMMUTE_OPTIONS: { value: CommuteMode; label: MessageKey }[] = [
  { value: "two_wheeler", label: "household.commute.two_wheeler" },
  { value: "car", label: "household.commute.car" },
  { value: "bus", label: "household.commute.bus" },
  { value: "metro", label: "household.commute.metro" },
  { value: "cycle_walk", label: "household.commute.cycle_walk" },
];

export interface FieldsProps {
  form: HouseholdInput;
  set: <K extends keyof HouseholdInput>(key: K, value: HouseholdInput[K]) => void;
}

function numberHandler(set: FieldsProps["set"], key: keyof HouseholdInput) {
  return (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, (e.target.value === "" ? 0 : Number(e.target.value)) as never);
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`rounded-xl border px-3 py-2 text-sm transition ${
        checked ? "border-brand bg-brand-soft font-medium text-brand-strong" : "border-border bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}

export function HomeFields({ form, set }: FieldsProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("household.members")}>
          <input type="number" min={1} max={30} value={form.members} onChange={numberHandler(set, "members")} className={inputClass} />
        </Field>
        <Field label={t("household.homeType")}>
          <select
            value={form.home_type}
            onChange={(e) => set("home_type", e.target.value as HouseholdInput["home_type"])}
            className={inputClass}
          >
            <option value="apartment">{t("household.home.apartment")}</option>
            <option value="independent">{t("household.home.independent")}</option>
            <option value="row_house">{t("household.home.row_house")}</option>
          </select>
        </Field>
      </div>
      <Field label={t("household.roof")} hint={t("household.roofHint")}>
        <input
          type="number"
          min={0}
          value={form.roof_area_sqm ?? ""}
          onChange={(e) => set("roof_area_sqm", e.target.value === "" ? null : Number(e.target.value))}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

function TariffFields({ form, set }: FieldsProps) {
  const config = useConfig();
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("household.discom")} hint={t("household.discomHint")}>
        <select value={form.discom} onChange={(e) => set("discom", e.target.value as Discom)} className={inputClass}>
          {(config?.discoms ?? [{ code: form.discom, name: form.discom.toUpperCase() }]).map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("household.area")} hint={t("household.areaHint")}>
        <select value={form.area} onChange={(e) => set("area", e.target.value as TariffArea)} className={inputClass}>
          <option value="urban">{t("household.urban")}</option>
          <option value="rural">{t("household.rural")}</option>
        </select>
      </Field>
    </div>
  );
}

export function ElectricityFields({ form, set }: FieldsProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <BillScanner
        onResult={(r) => {
          set("monthly_kwh", Math.round(r.monthlyKwh));
          if (r.discom) set("discom", r.discom);
        }}
      />
      <TariffFields form={form} set={set} />
      <Field label={t("household.units")} hint={t("household.unitsHint")}>
        <input type="number" min={0} value={form.monthly_kwh} onChange={numberHandler(set, "monthly_kwh")} className={inputClass} />
      </Field>
      <Field label={t("household.acs")}>
        <input type="number" min={0} max={20} value={form.ac_count} onChange={numberHandler(set, "ac_count")} className={inputClass} />
      </Field>
      <div>
        <p className="text-sm font-medium">{t("household.appliances")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Toggle label={t("household.geyser")} checked={form.has_geyser} onChange={(v) => set("has_geyser", v)} />
          <Toggle label={t("household.washingMachine")} checked={form.has_washing_machine} onChange={(v) => set("has_washing_machine", v)} />
          <Toggle label={t("household.ev")} checked={form.has_ev} onChange={(v) => set("has_ev", v)} />
          <Toggle label={t("household.solar")} checked={form.has_solar} onChange={(v) => set("has_solar", v)} />
        </div>
      </div>
    </div>
  );
}

export function TravelFields({ form, set }: FieldsProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <Field label={t("household.lpg")} hint={t("household.lpgHint")}>
        <input
          type="number"
          min={0}
          step={0.5}
          value={form.lpg_cylinders_per_month}
          onChange={numberHandler(set, "lpg_cylinders_per_month")}
          className={inputClass}
        />
      </Field>
      <Field label={t("household.commute")}>
        <select value={form.commute_mode} onChange={(e) => set("commute_mode", e.target.value as CommuteMode)} className={inputClass}>
          {COMMUTE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("household.km")}>
        <input
          type="number"
          min={0}
          value={form.commute_km_per_day}
          onChange={numberHandler(set, "commute_km_per_day")}
          className={inputClass}
        />
      </Field>
    </div>
  );
}
