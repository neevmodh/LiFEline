// My progress: each month's electricity against where the household started, so improvement over
// time is visible. Bars below the dashed "your start" line are sage, above it clay. A month's units
// can be typed or read from a bill photo, and saving redraws the chart.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePageWidth } from "@/components/layout";
import { Rise, tap, useCountUp } from "@/components/motion";
import { Button, ErrorText, Field } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, ApiError, type Reading } from "@/lib/api";
import { useBillScan } from "@/lib/bill-scan";
import { goalStatus, monthKey, parseUnits, summarise } from "@/lib/progress";
import { fonts, shadow, space, type, useColors } from "@/theme";

const CHART_H = 150;

export default function Progress() {
  const { t, locale } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePageWidth(true);
  const qc = useQueryClient();
  const readings = useQuery({ queryKey: ["readings"], queryFn: api.readings });
  const household = useQuery({ queryKey: ["household"], queryFn: api.household });
  const base = household.data?.household.monthly_kwh ?? null;
  const s = summarise(readings.data ?? [], base);
  const shown = (readings.data ?? []).filter((r) => Number.isFinite(r.kwh)).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  const monthName = (key: string, style: "short" | "long" = "short") =>
    new Date(`${key}-15T00:00:00Z`).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { month: style, ...(style === "long" ? { year: "numeric" } : {}) });

  const now = new Date();
  const months = [0, 1, 2].map((back) => monthKey(now, back));
  const [month, setMonth] = useState(months[0]);
  const [units, setUnits] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanned, setScanned] = useState<number | null>(null);
  const { scan, pick } = useBillScan((kwh) => {
    setUnits(String(kwh));
    setScanned(kwh);
  });
  const goalPct = household.data?.household.goal_pct ?? null;
  const goal = goalStatus(s.latest?.kwh, base, goalPct);
  const setGoal = useMutation({
    mutationFn: (pct: number | null) => api.setGoal(pct),
    onSuccess: () => {
      tap();
      void qc.invalidateQueries({ queryKey: ["household"] });
    },
  });

  const save = useMutation({
    // The server marks it as from a photo only if it read that very bill a moment ago.
    mutationFn: (kwh: number) => api.addReading(month, kwh, scanned !== null && kwh === scanned),
    onSuccess: () => {
      tap("success");
      setNote({ ok: true, text: t("progress.done") });
      setUnits("");
      void qc.invalidateQueries({ queryKey: ["readings"] });
      void qc.invalidateQueries({ queryKey: ["score"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => setNote({ ok: false, text: e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown") }),
  });

  const change = useCountUp(Math.abs(s.changePct ?? 0), 900);
  const better = (s.changePct ?? 0) <= 0;
  const perUnit = s.latest && s.latest.kwh > 0 ? s.latest.bill_rs / s.latest.kwh : 0;
  const max = Math.max(1, base ?? 0, ...shown.map((r) => r.kwh)) * 1.1;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[styles.page, page, { paddingTop: insets.top + space.md }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={readings.isRefetching} onRefresh={() => void readings.refetch()} />}
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
          style={[styles.back, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <Text style={[type.title, { color: c.text, fontSize: 24, flex: 1 }]}>{t("progress.title")}</Text>
      </View>

      <Rise index={0} style={[styles.hero, { backgroundColor: c.primary }]}>
        <Text style={[type.eyebrow, { color: c.onPrimary, opacity: 0.7 }]}>{t("progress.vsStart")}</Text>
        {s.latest && s.changePct !== null ? (
          <>
            <Text style={[styles.big, { color: better ? c.leaf : c.saffronLight }]}>
              {Math.abs(s.changePct ?? 0) < 0.05 ? "" : better ? "−" : "+"}
              {change.toFixed(1)}%
            </Text>
            <Text style={[type.small, { color: c.onPrimary }]}>{t("progress.used", { kwh: s.latest.kwh, base: Math.round(base ?? 0), month: monthName(s.latest.month, "long") })}</Text>
            <Text style={[type.small, { color: c.saffronLight }]}>
              {s.savedKwh === 0 && better
                ? t("progress.same")
                : better
                  ? t("progress.saved", { kwh: s.savedKwh, rs: Math.round(s.savedKwh * perUnit).toLocaleString("en-IN") })
                  : t("progress.above", { kwh: Math.round(s.latest.kwh - (base ?? 0)) })}
            </Text>
          </>
        ) : (
          <Text style={[type.body, { color: c.onPrimary }]}>{t("progress.none")}</Text>
        )}
      </Rise>

      {shown.length > 0 && (
        <Rise index={1} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
          <View style={styles.head}>
            <Text style={[type.heading, { color: c.text }]}>{t("progress.chart")}</Text>
            {base ? (
              <View style={styles.legend}>
                <View style={[styles.dash, { borderColor: c.saffron }]} />
                <Text style={[type.small, { color: c.muted }]}>{t("progress.start", { kwh: Math.round(base) })}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.chart, { borderBottomColor: c.border }]} accessibilityRole="image" accessibilityLabel={shown.map((r) => `${monthName(r.month)} ${r.kwh}`).join(", ")}>
            {base ? <View pointerEvents="none" style={[styles.baseLine, { bottom: (base / max) * CHART_H, borderColor: c.saffron }]} /> : null}
            {goal ? <View pointerEvents="none" style={[styles.baseLine, { bottom: (goal.target / max) * CHART_H, borderColor: c.green }]} /> : null}
            {shown.map((r, i) => (
              <MonthBar key={r.month} reading={r} share={r.kwh / max} below={base === null || r.kwh <= base} index={i} label={monthName(r.month)} />
            ))}
          </View>
          {s.monthsBelowInARow >= 2 && (
            <Text style={[type.small, { color: c.greenDeep, fontFamily: fonts.bodyBold }]}>{t("progress.inARow", { n: s.monthsBelowInARow })}</Text>
          )}
          {s.best && s.hasTrend && <Text style={[type.small, { color: c.muted }]}>{t("progress.best", { month: monthName(s.best.month, "long"), kwh: s.best.kwh })}</Text>}
          <Text style={[type.small, { color: c.muted }]}>{t("progress.coverage")}</Text>
        </Rise>
      )}

      {base ? (
        <Rise index={2} style={[styles.card, shadow, { backgroundColor: goal?.onTrack ? c.greenSoft : c.surface }]}>
          <View style={styles.head}>
            <Text style={[type.heading, { color: c.text }]}>{t("progress.goalTitle")}</Text>
            {goal && (
              <View style={styles.legend}>
                <View style={[styles.dash, { borderColor: c.green }]} />
                <Text style={[type.small, { color: c.muted }]}>{t("progress.goalLine", { kwh: goal.target })}</Text>
              </View>
            )}
          </View>
          <Text style={[type.small, { color: c.muted }]}>{t("progress.goalSub")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t("progress.goalTitle")}>
            {[5, 10, 15, 20, 25].map((p) => (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ checked: goalPct === p }}
                disabled={setGoal.isPending}
                onPress={() => setGoal.mutate(goalPct === p ? null : p)}
                style={[styles.chip, { borderColor: goalPct === p ? c.green : c.border, backgroundColor: goalPct === p ? c.green : c.surface }]}
              >
                <Text style={[type.small, { color: goalPct === p ? c.onPrimary : c.text }]}>{`−${p}%`}</Text>
              </Pressable>
            ))}
          </View>
          {goal && (
            <Text style={[type.small, { color: goal.onTrack ? c.greenDeep : c.text, fontFamily: fonts.bodyBold }]}>
              {!s.latest ? t("progress.goalFirst", { kwh: goal.target }) : goal.onTrack ? t("progress.goalOn") : t("progress.goalToGo", { kwh: goal.toGo })}
            </Text>
          )}
        </Rise>
      ) : null}

      <Rise index={2} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
        <Text style={[type.heading, { color: c.text }]}>{t("progress.add")}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t("progress.month")}>
          {months.map((m) => (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ checked: month === m }}
              onPress={() => setMonth(m)}
              style={[styles.chip, { borderColor: month === m ? c.primary : c.border, backgroundColor: month === m ? c.primary : c.surface }]}
            >
              <Text style={[type.small, { color: month === m ? c.onPrimary : c.text }]}>{monthName(m, "long")}</Text>
            </Pressable>
          ))}
        </View>
        <Field label={t("progress.units")} value={units} onChangeText={(v) => { setUnits(v); setScanned(null); }} keyboardType="number-pad" inputMode="numeric" placeholder="240" />
        <Button variant="plain" icon="camera-outline" title={scan.state === "busy" ? t("onboard.scanning") : t("progress.scan")} busy={scan.state === "busy"} onPress={() => void pick("camera")} />
        {scan.state === "error" && <ErrorText>{t(scan.message)}</ErrorText>}
        <Button
          title={t("progress.save")}
          busy={save.isPending}
          onPress={() => {
            const kwh = parseUnits(units);
            if (kwh === null) setNote({ ok: false, text: t("progress.badUnits") });
            else save.mutate(kwh);
          }}
        />
        {note && (note.ok ? <Text style={[type.small, { color: c.greenDeep }]}>{note.text}</Text> : <ErrorText>{note.text}</ErrorText>)}
      </Rise>
    </ScrollView>
  );
}

function MonthBar({ reading, share, below, index, label }: { reading: Reading; share: number; below: boolean; index: number; label: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    h.value = reduced ? share : withDelay(120 + index * 70, withTiming(share, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [share, reduced, index, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(3, h.value * CHART_H) }));
  return (
    <View style={styles.barCell}>
      <Text style={[styles.barValue, { color: below ? c.greenDeep : c.clay }]}>{reading.kwh}</Text>
      <Animated.View style={[styles.bar, { backgroundColor: below ? c.green : c.clay, borderRightColor: below ? c.greenDeep : "#7A3F2D" }, style]} />
      <Text style={[styles.barLabel, { color: c.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 22, padding: space.lg, gap: 6 },
  big: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60, letterSpacing: -1.5 },
  card: { borderRadius: 22, padding: space.lg, gap: space.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  dash: { width: 18, borderTopWidth: 2, borderStyle: "dashed" },
  chart: { height: CHART_H + 44, flexDirection: "row", alignItems: "flex-end", gap: 6, borderBottomWidth: 1, paddingBottom: 18 },
  baseLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 2, borderStyle: "dashed", marginBottom: 18 },
  barCell: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, maxWidth: 56 },
  bar: { width: "78%", borderTopLeftRadius: 6, borderTopRightRadius: 6, borderRightWidth: 5 },
  barValue: { fontFamily: fonts.bodyBold, fontSize: 10 },
  barLabel: { position: "absolute", bottom: -17, fontFamily: fonts.bodyMedium, fontSize: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" },
});
