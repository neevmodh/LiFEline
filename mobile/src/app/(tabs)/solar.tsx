// Solar: from "is it worth it?" to a GEDA site survey. Measure the roof on a satellite map (or type it),
// say how shaded it is, and POST /api/solar/estimate sizes the system with PVGIS sunshine for the
// district, prices it at the household's own DISCOM tariff month by month (the bill with and without
// solar), and applies the PM Surya Ghar subsidy. Today's output comes from the live solar forecast.
// Then ask GEDA for a site survey and follow it, how to apply, and the government's vendor list.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { Columns, usePageWidth } from "@/components/layout";
import { Bar, Rise, tap } from "@/components/motion";
import { BigNumber, Body, Button, Card, ErrorText, Field, Hero } from "@/components/ui";
import { districtName, useI18n, type MessageKey } from "@/i18n";
import { api, ApiError, type Shade, type SolarEstimate, type SolarToday } from "@/lib/api";
import { inr } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { hourLabel, LEAD_STEPS, leadIsOpen, leadStepIndex, parseRoof, roofFromUrl, roofMeasureUrl, todaySeries, websiteBase } from "@/lib/solar-view";
import { fonts, radius, space, type, useColors } from "@/theme";

const PORTAL = "https://pmsuryaghar.gov.in/";
const VENDORS = "https://pmsuryaghar.gov.in/#/registered-vendors";
const DEACTIVATED = "https://pmsuryaghar.gov.in/#/list-of-deactivated-vendors";
const SURYA_GUJARAT = "https://suryagujarat.guvnl.in/";
const WEBSITE = websiteBase(process.env.EXPO_PUBLIC_CONSOLE_URL);
const SHADES: Shade[] = ["none", "partial", "heavy"];

export default function Solar() {
  const { t, locale } = useI18n();
  const c = useColors();
  const page = usePageWidth();
  const { user } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ roof?: string }>();
  const home = useQuery({ queryKey: ["household"], queryFn: api.household });
  const districts = useQuery({ queryKey: ["districts"], queryFn: api.districts });
  const h = home.data?.household;
  const myDistrict = districts.data?.find((d) => d.id === user?.district_id);

  const [roof, setRoof] = useState("");
  const [units, setUnits] = useState("");
  const [shade, setShade] = useState<Shade>("none");
  const [measured, setMeasured] = useState(false);
  // Start from the household's own answers once they arrive; a measured roof (?roof=) wins.
  useEffect(() => {
    if (!h) return;
    setRoof((r) => r || (h.roof_area_sqm ? String(h.roof_area_sqm) : ""));
    setUnits((u) => u || String(Math.round(h.monthly_kwh)));
  }, [h]);
  useEffect(() => {
    const fromMap = parseRoof(params.roof);
    if (fromMap) {
      setRoof(String(fromMap));
      setMeasured(true);
      router.setParams({ roof: undefined });
    }
  }, [params.roof, router]);

  async function measureRoof() {
    tap();
    if (Platform.OS === "web") {
      window.location.href = roofMeasureUrl(WEBSITE, `${window.location.origin}/solar`, myDistrict?.lat, myDistrict?.lon);
      return;
    }
    const back = Linking.createURL("/solar");
    const result = await WebBrowser.openAuthSessionAsync(roofMeasureUrl(WEBSITE, back, myDistrict?.lat, myDistrict?.lon), back);
    if (result.type === "success") {
      const area = roofFromUrl(result.url);
      if (area) {
        setRoof(String(area));
        setMeasured(true);
      }
    }
  }

  const input = useDebounced(
    { roof_area_sqm: Number(roof) || 0, monthly_kwh: Number(units) || 0, district_id: user?.district_id ?? null, discom: h?.discom, area: h?.area, shade },
    400,
  );
  const estimate = useQuery({
    queryKey: ["solar", input],
    queryFn: () => api.solarEstimate(input),
    enabled: input.roof_area_sqm > 0 && input.monthly_kwh > 0 && !!h,
    placeholderData: (prev) => prev,
  });
  const e = estimate.data;
  const today = useQuery({ queryKey: ["solar-today", user?.district_id], queryFn: () => api.solarToday(user?.district_id as number), enabled: !!user?.district_id, staleTime: 30 * 60_000 });
  const month = (m: number) => new Date(Date.UTC(2026, m - 1, 15)).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { month: "narrow" });

  const inputs = (
    <>
      <Rise index={0} style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Field label={t("solar.roofArea")} value={roof} onChangeText={(v) => { setRoof(v); setMeasured(false); }} keyboardType="numeric" />
        <Pressable accessibilityRole="button" onPress={() => void measureRoof()} style={({ pressed }) => [styles.measure, { borderColor: c.saffron, backgroundColor: c.saffronSoft, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="map-outline" size={20} color={c.saffronInk} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.measureTitle, { color: c.saffronInk }]}>{t("solar.measure")}</Text>
            <Text style={[type.small, { color: c.saffronInk }]}>{measured ? t("solar.measured", { m2: roof }) : t("solar.measureHint")}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={c.saffronInk} />
        </Pressable>
        <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t("solar.shade")}>
          <Text style={[type.small, { color: c.muted }]}>{t("solar.shade")}</Text>
          <View style={styles.chips}>
            {SHADES.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ checked: shade === s }}
                onPress={() => setShade(s)}
                style={[styles.chip, { borderColor: shade === s ? c.primary : c.border, backgroundColor: shade === s ? c.primary : c.surface }]}
              >
                <Text style={[type.small, { color: shade === s ? c.onPrimary : c.text }]}>{t(`solar.shade.${s}` as MessageKey)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Field label={t("solar.units")} value={units} onChangeText={setUnits} keyboardType="numeric" />
      </Rise>
      {today.data && <TodayCard kwp={e && e.recommended_kwp > 0 ? e.recommended_kwp : 1} data={today.data} district={districtName(locale, today.data.district)} />}
    </>
  );

  const results = (
    <>
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
            {e.shade !== "none" && <Text style={[type.small, { color: c.muted }]}>{t("solar.usable", { m2: Math.round(e.usable_roof_sqm) })}</Text>}
            <Text style={[type.small, { color: c.muted }]}>
              {e.yield_source === "pvgis" ? `${t("solar.pvgis")} · ` : `${t("solar.average")} · `}
              {t("solar.yieldNote", { kwh: Math.round(e.specific_yield_kwh_per_kwp) })}
            </Text>
          </Card>
          <BillCard e={e} month={month} />
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
          <SurveyCard e={e} roof={Number(roof) || 0} units={Number(units) || 0} />
        </>
      )}
    </>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={estimate.isRefetching} onRefresh={() => void estimate.refetch()} />}
    >
      <Hero eyebrow="PM Surya Ghar" title={t("solar.title")} subtitle={t("solar.intro")} />
      <View style={[styles.page, page]}>
        {h?.has_solar && (
          <Card tone="green">
            <Body>{t("solar.hasSolar")}</Body>
          </Card>
        )}
        <Columns left={inputs} right={results} ratio={0.9} />
        <Columns
          left={
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
          }
          right={
            <Card>
              <Text style={type.heading}>{t("vendors.title")}</Text>
              <Body muted>{t("vendors.intro")}</Body>
              <Body>{t("solar.vendorsHow")}</Body>
              <Button title={t("solar.vendors")} onPress={() => WebBrowser.openBrowserAsync(VENDORS)} />
              <Button variant="plain" title={t("solar.deactivated")} onPress={() => WebBrowser.openBrowserAsync(DEACTIVATED)} />
              <Text style={[type.small, { color: c.muted }]}>{t("vendors.note")}</Text>
            </Card>
          }
          ratio={1}
        />
      </View>
    </ScrollView>
  );
}

/** Today: what this roof's system would make, hour by hour, from the live solar forecast. */
function TodayCard({ kwp, data, district }: { kwp: number; data: SolarToday; district: string }) {
  const { t } = useI18n();
  const c = useColors();
  if (data.sky === "unknown") return null;
  const series = todaySeries(data.hours, kwp);
  const peak = Math.max(0.01, ...series.map((s) => s.kwh));
  const total = Math.round(data.kwh_per_kwp * kwp * 10) / 10;
  const icon = data.sky === "sunny" ? "sunny" : data.sky === "cloudy" ? "cloudy" : "partly-sunny";
  return (
    <Rise index={1} style={[styles.panel, { backgroundColor: c.saffronSoft, borderColor: "transparent" }]}>
      <View style={styles.todayHead}>
        <Ionicons name={icon} size={22} color={c.saffronInk} />
        <Text style={[type.eyebrow, { color: c.saffronInk, flex: 1 }]}>{t("solar.today", { district })}</Text>
      </View>
      <Text style={[styles.todayBig, { color: c.text }]}>{t("solar.todayUnits", { kwh: total, kwp })}</Text>
      {data.best_hour != null && <Text style={[type.small, { color: c.saffronInk }]}>{t("solar.todayBest", { hour: hourLabel(data.best_hour) })}</Text>}
      <View style={styles.hours} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {series.map((s) => (
          <View key={s.hour} style={styles.hourCol}>
            <View style={[styles.hourBar, { height: 6 + (s.kwh / peak) * 56, backgroundColor: s.hour === data.best_hour ? c.saffron : c.saffronLight }]} />
            <Text style={[styles.hourLabel, { color: c.saffronInk }]}>{s.hour % 3 === 0 ? hourLabel(s.hour).replace(" ", "") : ""}</Text>
          </View>
        ))}
      </View>
      <Text style={[type.small, { color: c.muted }]}>{t("solar.todayNote")}</Text>
    </Rise>
  );
}

/** The bill, a typical month without and with solar, and each month's generation. */
function BillCard({ e, month }: { e: SolarEstimate; month: (m: number) => string }) {
  const { t } = useI18n();
  const c = useColors();
  const top = Math.max(1, ...e.months.map((m) => m.generation_kwh));
  const cut = e.bill_before_rs > 0 ? 1 - e.bill_after_rs / e.bill_before_rs : 0;
  return (
    <Card>
      <Text style={type.heading}>{t("solar.billTitle")}</Text>
      <View style={styles.billRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.small, { color: c.muted }]}>{t("solar.billNow")}</Text>
          <Text style={[styles.billNum, { color: c.text }]}>₹{inr(e.bill_before_rs)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={c.muted} />
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[type.small, { color: c.muted }]}>{t("solar.billWith")}</Text>
          <Text style={[styles.billNum, { color: c.green }]}>₹{inr(e.bill_after_rs)}</Text>
        </View>
      </View>
      <Bar value={cut} color={c.green} height={8} />
      <Text style={[type.small, { color: c.greenDeep }]}>{t("solar.billCut", { pct: Math.round(cut * 100) })}</Text>
      <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>{t("solar.monthly")}</Text>
      <View style={styles.months} accessibilityLabel={e.months.map((m) => `${month(m.month)} ${m.generation_kwh}`).join(", ")}>
        {e.months.map((m) => (
          <View key={m.month} style={styles.monthCol}>
            <View style={[styles.monthBar, { height: 6 + (m.generation_kwh / top) * 64, backgroundColor: m.exported_kwh > 0 ? c.saffron : c.saffronLight }]} />
            <Text style={[styles.hourLabel, { color: c.muted }]}>{month(m.month)}</Text>
          </View>
        ))}
      </View>
      {e.months.some((m) => m.exported_kwh > 0) && <Text style={[type.small, { color: c.muted }]}>{t("solar.exportNote")}</Text>}
    </Card>
  );
}

/** Ask GEDA for a site survey, then follow it from new to installed. */
function SurveyCard({ e, roof, units }: { e: SolarEstimate; roof: number; units: number }) {
  const { t } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["solar-lead"], queryFn: api.mySolarLead });
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = useMutation({
    mutationFn: () => api.requestSolarSurvey({ kwp: e.recommended_kwp, roof_area_sqm: roof, monthly_kwh: units, note, consent }),
    onSuccess: () => {
      tap("success");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["solar-lead"] });
    },
    onError: (err) => setError(err instanceof ApiError && err.status !== 0 ? err.message : t("mobile.serverDown")),
  });
  const lead = mine.data;

  if (lead && leadIsOpen(lead.status)) {
    const at = leadStepIndex(lead.status);
    return (
      <Card tone="green">
        <Text style={type.heading}>{t("survey.trackTitle")}</Text>
        <Body muted>{t("survey.trackSub", { kwp: lead.kwp })}</Body>
        <View style={{ gap: 8, marginTop: space.xs }}>
          {LEAD_STEPS.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={[styles.stepDot, { backgroundColor: i <= at ? c.green : c.surface, borderColor: i <= at ? c.green : c.border }]}>
                {i < at && <Ionicons name="checkmark" size={12} color={c.onPrimary} />}
              </View>
              <Text style={[type.small, { color: i <= at ? c.text : c.muted, fontFamily: i === at ? fonts.bodyBold : fonts.bodyMedium }]}>{t(`survey.step.${s}` as MessageKey)}</Text>
            </View>
          ))}
        </View>
      </Card>
    );
  }
  return (
    <Card tone="saffron">
      <Text style={type.heading}>{lead?.status === "installed" ? t("survey.installed") : t("survey.title")}</Text>
      <Body muted>{t("survey.body", { kwp: e.recommended_kwp })}</Body>
      <Field label={t("survey.note")} value={note} onChangeText={(v) => setNote(v.slice(0, 300))} placeholder={t("survey.notePlaceholder")} />
      <View style={styles.consent}>
        <Switch accessibilityLabel={t("survey.consent")} value={consent} onValueChange={setConsent} trackColor={{ true: c.green, false: c.track }} thumbColor={c.surface} />
        <Text style={[type.small, { color: c.text, flex: 1 }]}>{t("survey.consent")}</Text>
      </View>
      <Button title={t("survey.ask")} icon="sunny-outline" busy={ask.isPending} onPress={() => (consent ? ask.mutate() : setError(t("survey.needConsent")))} />
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
      <Text style={[type.heading, { color: c.text, fontSize: 22, lineHeight: 28 }]}>{value}</Text>
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
  page: { padding: space.lg, gap: space.lg },
  panel: { borderRadius: 22, borderWidth: 1, padding: space.lg, gap: space.md },
  measure: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  measureTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" },
  todayHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  todayBig: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  hours: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 84 },
  hourCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  hourBar: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  hourLabel: { fontFamily: fonts.bodyMedium, fontSize: 9, lineHeight: 12, height: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  line: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  billRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  billNum: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  months: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 92 },
  monthCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  monthBar: { width: "100%", borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  step: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  consent: { flexDirection: "row", alignItems: "center", gap: space.md },
});
