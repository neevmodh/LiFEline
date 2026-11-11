// Solar: from "is it worth it?" to the official application. Sizing, PVGIS yield for the district,
// savings at the household's own DISCOM tariff, PM Surya Ghar subsidy, net cost, payback and the
// 25-year gain all come from POST /api/solar/estimate; the app only formats them. Then how to apply
// in Gujarat, and the government's own vendor list (linked, not copied, so it's always current).
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BigNumber, Body, Button, Card, ErrorText, Field, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { radius, space, type, useColors } from "@/theme";

const PORTAL = "https://pmsuryaghar.gov.in/";
const VENDORS = "https://pmsuryaghar.gov.in/#/registered-vendors";
const DEACTIVATED = "https://pmsuryaghar.gov.in/#/list-of-deactivated-vendors";
const SURYA_GUJARAT = "https://suryagujarat.guvnl.in/";

export default function Solar() {
  const { t } = useI18n();
  const c = useColors();
  const { user } = useSession();
  const home = useQuery({ queryKey: ["household"], queryFn: api.household });
  const h = home.data?.household;

  const [roof, setRoof] = useState("");
  const [units, setUnits] = useState("");
  // Start from the household's own answers once they arrive.
  useEffect(() => {
    if (!h) return;
    setRoof((r) => r || (h.roof_area_sqm ? String(h.roof_area_sqm) : ""));
    setUnits((u) => u || String(Math.round(h.monthly_kwh)));
  }, [h]);

  const input = useDebounced(
    { roof_area_sqm: Number(roof) || 0, monthly_kwh: Number(units) || 0, district_id: user?.district_id ?? null, discom: h?.discom, area: h?.area },
    400,
  );
  const estimate = useQuery({
    queryKey: ["solar", input],
    queryFn: () => api.solarEstimate(input),
    enabled: input.roof_area_sqm > 0 && input.monthly_kwh > 0 && !!h,
    placeholderData: (prev) => prev,
  });
  const e = estimate.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={estimate.isRefetching} onRefresh={() => void estimate.refetch()} />}
      >
        <Title>{t("solar.title")}</Title>
        <Body muted>{t("solar.intro")}</Body>
        {h?.has_solar && (
          <Card tone="green">
            <Body>{t("solar.hasSolar")}</Body>
          </Card>
        )}

        <Field label={t("solar.roof")} value={roof} onChangeText={setRoof} keyboardType="numeric" />
        <Field label={t("solar.units")} value={units} onChangeText={setUnits} keyboardType="numeric" />

        {!e && !estimate.isError && <Body muted>{t("solar.empty")}</Body>}
        {estimate.isError && <ErrorText>{t("solar.failed")}</ErrorText>}

        {e && e.recommended_kwp <= 0 && (
          <Card tone="saffron">
            <Text style={type.heading}>{t("solar.tooSmall")}</Text>
            <Body muted>{t("solar.tooSmallHint")}</Body>
          </Card>
        )}

        {e && e.recommended_kwp > 0 && (
          <>
            <Card tone="green">
              <Body muted>{t("solar.recommended")}</Body>
              <BigNumber color={c.green}>{t("solar.kw", { kwp: e.recommended_kwp })}</BigNumber>
              <Body muted>
                {e.limited_by === "roof" ? t("solar.sizedByRoof") : t("solar.sizedByUse")} · {t("solar.perYear", { kwh: inr(e.annual_generation_kwh) })}
              </Body>
              <Text style={[type.small, { color: c.muted }]}>
                {e.yield_source === "pvgis" ? `${t("solar.pvgis")} · ` : `${t("solar.average")} · `}
                {t("solar.yieldNote", { kwh: Math.round(e.specific_yield_kwh_per_kwp) })}
              </Text>
            </Card>

            <View style={styles.grid}>
              <Stat label={t("solar.saves")} value={`₹${inr(e.annual_savings_rs)}`} />
              <Stat label={t("solar.payback")} value={e.payback_years ? t("solar.yrs", { n: e.payback_years }) : "–"} />
              <Stat label={t("solar.gain")} value={`₹${inr(e.lifetime_savings_rs)}`} hint={t("solar.gainHint")} />
              <Stat label="CO₂" value={t("solar.perYr", { v: `${inr(e.annual_co2_avoided_kg)} kg` })} />
            </View>

            <Card>
              <Text style={type.heading}>{t("solar.breakdown")}</Text>
              <Line label={t("solar.cost")} value={`₹${inr(e.gross_cost_rs)}`} />
              <Line label={t("solar.subsidy")} value={`− ₹${inr(e.subsidy_rs)}`} color={c.green} />
              <Line label={t("solar.youPay")} value={`₹${inr(e.net_cost_rs)}`} bold />
            </Card>
          </>
        )}

        <Card>
          <Text style={type.heading}>{t("solar.apply")}</Text>
          {(["solar.applyStep1", "solar.applyStep2", "solar.applyStep3", "solar.applyStep4"] as const).map((k, i) => (
            <Body key={k}>
              {i + 1}. {t(k)}
            </Body>
          ))}
          <Body muted>{t("solar.step3")}</Body>
          <Button title={t("solar.openPortal")} onPress={() => WebBrowser.openBrowserAsync(PORTAL)} />
          <Button variant="plain" title={t("solar.openSurya")} onPress={() => WebBrowser.openBrowserAsync(SURYA_GUJARAT)} />
        </Card>

        <Card>
          <Text style={type.heading}>{t("vendors.title")}</Text>
          <Body muted>{t("vendors.intro")}</Body>
          <Body>{t("solar.vendorsHow")}</Body>
          <Button title={t("solar.vendors")} onPress={() => WebBrowser.openBrowserAsync(VENDORS)} />
          <Button variant="plain" title={t("solar.deactivated")} onPress={() => WebBrowser.openBrowserAsync(DEACTIVATED)} />
          <Text style={[type.small, { color: c.muted }]}>{t("vendors.note")}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
      <Text style={[type.heading, { color: c.text, fontSize: 22 }]}>{value}</Text>
      {hint ? <Text style={[type.small, { color: c.muted }]}>{hint}</Text> : null}
    </View>
  );
}

function Line({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.line}>
      <Text style={[type.body, { color: c.muted, flex: 1 }]}>{label}</Text>
      <Text style={[type.body, { color: color ?? c.text, fontWeight: bold ? "800" : "600" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  line: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
});
