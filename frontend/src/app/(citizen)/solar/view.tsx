"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardTitle, ErrorNote, Field, Stat, fmt, inputClass } from "@/components/ui";
import { api, type Household, type SolarEstimate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { useI18n } from "@/i18n";
import { ApplianceCalculator } from "@/components/ApplianceCalculator";
import { VendorDirectory } from "@/components/VendorDirectory";

export default function SolarView() {
  const { user } = useAuth();
  const [roof, setRoof] = useState("");
  const [kwh, setKwh] = useState("");
  const [result, setResult] = useState<SolarEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const config = useConfig();
  const [districtName, setDistrictName] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!user?.district_id) return;
    api
      .districts()
      .then((ds) => setDistrictName(ds.find((d) => d.id === user.district_id)?.name ?? null))
      .catch(() => {});
  }, [user?.district_id]);

  // Prefill from onboarding answers.
  useEffect(() => {
    api
      .household()
      .then(({ household }) => {
        setHousehold(household);
        setKwh(String(household.monthly_kwh));
        if (household.roof_area_sqm) setRoof(String(household.roof_area_sqm));
      })
      .catch(() => {});
  }, []);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.solar({
          roof_area_sqm: Number(roof),
          monthly_kwh: Number(kwh),
          district_id: user?.district_id,
          discom: household?.discom,
          area: household?.area,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("solar.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("solar.title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("solar.intro")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <form onSubmit={calculate} className="space-y-4">
            <Field label={t("solar.roof")} hint={t("solar.roofHint", { sqm: config?.sqm_per_kwp ?? 10 })}>
              <input type="number" required min={1} value={roof} onChange={(e) => setRoof(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("solar.units")}>
              <input type="number" required min={1} value={kwh} onChange={(e) => setKwh(e.target.value)} className={inputClass} />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t("solar.calculating") : t("solar.calculate")}
            </Button>
          </form>
        </Card>

        {result ? (
          result.recommended_kwp === 0 ? (
            <Card>
              <p className="font-medium">{t("solar.tooSmall")}</p>
              <p className="mt-1 text-sm text-muted">
                {t("solar.tooSmallHint")}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="border-sun/40 bg-sun-soft/40">
                <p className="text-sm text-muted">{t("solar.recommended")}</p>
                <p className="text-4xl font-semibold">{result.recommended_kwp} kW</p>
                <p className="mt-1 text-sm text-muted">
                  {t(result.limited_by === "roof" ? "solar.sizedByRoof" : "solar.sizedByUse")} ·{" "}
                  {t("solar.perYear", { kwh: fmt.int(result.annual_generation_kwh) })}
                </p>
              </Card>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label={t("solar.saves")} value={fmt.rs(result.annual_savings_rs)} />
                <Stat label={t("solar.payback")} value={result.payback_years ? t("solar.years", { n: result.payback_years }) : "–"} />
                <Stat label={t("dashboard.co2")} value={t("solar.perYr", { v: fmt.kg(result.annual_co2_avoided_kg) })} />
                <Stat label={t("solar.gain")} value={fmt.rs(result.lifetime_savings_rs)} hint={t("solar.gainHint")} />
              </div>
              <Card>
                <CardTitle>{t("solar.breakdown")}</CardTitle>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("solar.cost")}</dt>
                    <dd className="tabular-nums">{fmt.rs(result.gross_cost_rs)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("solar.subsidy")}</dt>
                    <dd className="tabular-nums text-brand">− {fmt.rs(result.subsidy_rs)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>{t("solar.youPay")}</dt>
                    <dd className="tabular-nums">{fmt.rs(result.net_cost_rs)}</dd>
                  </div>
                </dl>
                <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone={result.yield_source === "pvgis" ? "brand" : "muted"}>
                    {result.yield_source === "pvgis" ? t("solar.pvgis") : t("solar.average")}
                  </Badge>
                  {t("solar.yieldNote", { kwh: fmt.int(result.specific_yield_kwh_per_kwp) })}
                </p>
              </Card>
              <Card>
                <CardTitle>{t("solar.nextSteps")}</CardTitle>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  <li>
                    {t("solar.step1")}{" "}
                    <a className="font-medium text-brand underline" href="https://pmsuryaghar.gov.in/" target="_blank" rel="noreferrer">
                      {t("solar.step1Link")}
                    </a>
                    . {t("solar.step1After")}
                  </li>
                  <li>
                    {t("solar.step2")}{" "}
                    <a className="font-medium text-brand underline" href="https://suryagujarat.guvnl.in/" target="_blank" rel="noreferrer">
                      SURYA Gujarat
                    </a>
                    .
                  </li>
                  <li>{t("solar.step3")}</li>
                </ol>
              </Card>
            </div>
          )
        ) : (
          <Card>
            <p className="text-sm text-muted">{t("solar.empty")}</p>
          </Card>
        )}
      </div>

      <VendorDirectory district={districtName} />

      <ApplianceCalculator />
    </div>
  );
}
