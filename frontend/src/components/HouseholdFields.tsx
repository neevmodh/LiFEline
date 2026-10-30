"use client";

import { BillScanner } from "@/components/BillScanner";
import { Field, inputClass } from "@/components/ui";
import type { CommuteMode, HouseholdInput } from "@/lib/api";

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
};

const COMMUTE_OPTIONS: { value: CommuteMode; label: string }[] = [
  { value: "two_wheeler", label: "Two-wheeler" },
  { value: "car", label: "Car" },
  { value: "bus", label: "Bus" },
  { value: "metro", label: "Metro" },
  { value: "cycle_walk", label: "Cycle / walk" },
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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="People in the household">
          <input type="number" min={1} max={30} value={form.members} onChange={numberHandler(set, "members")} className={inputClass} />
        </Field>
        <Field label="Home type">
          <select
            value={form.home_type}
            onChange={(e) => set("home_type", e.target.value as HouseholdInput["home_type"])}
            className={inputClass}
          >
            <option value="apartment">Apartment</option>
            <option value="independent">Independent house</option>
            <option value="row_house">Row house</option>
          </select>
        </Field>
      </div>
      <Field label="Usable roof area (m²)" hint="Shadow-free area for solar panels. Leave empty if you don't know.">
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

export function ElectricityFields({ form, set }: FieldsProps) {
  return (
    <div className="space-y-4">
      <BillScanner onResult={(r) => set("monthly_kwh", Math.round(r.monthlyKwh))} />
      <Field label="Units (kWh) per month" hint="From your bill. Bi-monthly bill? Divide the units by two.">
        <input type="number" min={0} value={form.monthly_kwh} onChange={numberHandler(set, "monthly_kwh")} className={inputClass} />
      </Field>
      <Field label="Number of air conditioners">
        <input type="number" min={0} max={20} value={form.ac_count} onChange={numberHandler(set, "ac_count")} className={inputClass} />
      </Field>
      <div>
        <p className="text-sm font-medium">Which of these do you have?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Toggle label="Electric geyser" checked={form.has_geyser} onChange={(v) => set("has_geyser", v)} />
          <Toggle label="Washing machine" checked={form.has_washing_machine} onChange={(v) => set("has_washing_machine", v)} />
          <Toggle label="Electric vehicle" checked={form.has_ev} onChange={(v) => set("has_ev", v)} />
          <Toggle label="Rooftop solar" checked={form.has_solar} onChange={(v) => set("has_solar", v)} />
        </div>
      </div>
    </div>
  );
}

export function TravelFields({ form, set }: FieldsProps) {
  return (
    <div className="space-y-4">
      <Field label="LPG cylinders used per month" hint="A 14.2 kg cylinder every two months = 0.5">
        <input
          type="number"
          min={0}
          step={0.5}
          value={form.lpg_cylinders_per_month}
          onChange={numberHandler(set, "lpg_cylinders_per_month")}
          className={inputClass}
        />
      </Field>
      <Field label="How do you usually commute?">
        <select value={form.commute_mode} onChange={(e) => set("commute_mode", e.target.value as CommuteMode)} className={inputClass}>
          {COMMUTE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kilometres per day (round trip)">
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
