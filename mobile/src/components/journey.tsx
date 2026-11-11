// The level journey (Seedling to LiFE Champion) as five stops with the current one pulsing, and the
// Impact Ledger's four columns rising side by side, never stacked or added together.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";

import { useI18n, type MessageKey } from "@/i18n";
import type { Ledger } from "@/lib/api";
import { fonts, space, type, useColors } from "@/theme";

export function Journey({ level }: { level: number }) {
  const { t } = useI18n();
  const c = useColors();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1);
  }, [reduced, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.9 }] }));
  const current = Math.max(1, Math.min(5, level));
  return (
    <View style={styles.journey} accessibilityLabel={t(`journey.${current}` as MessageKey)}>
      <View style={[styles.line, { backgroundColor: c.track }]} />
      <View style={[styles.line, { backgroundColor: c.green, right: `${(1 - (current - 1) / 4) * 90 + 5}%` }]} />
      {[1, 2, 3, 4, 5].map((n) => {
        const past = n < current;
        const here = n === current;
        return (
          <View key={n} style={styles.stop}>
            <View style={styles.dotBox}>
              {here && <Animated.View style={[styles.halo, { backgroundColor: c.saffronLight }, ring]} />}
              <View style={[here ? styles.here : styles.dot, { backgroundColor: here ? c.saffronLight : past ? c.green : c.track, borderColor: c.surface }]} />
            </View>
            <Text style={[styles.label, { color: here ? c.saffronInk : c.muted }]} numberOfLines={2}>
              {t(`journey.${n}` as MessageKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const STATUSES = ["estimated", "self_reported", "pending", "verified"] as const;

function Column({ share, color, side, dashed, index }: { share: number; color: string; side: string; dashed: boolean; index: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    h.value = reduced ? share : withDelay(150 + index * 110, withTiming(share, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [share, reduced, index, h]);
  const style = useAnimatedStyle(() => ({ height: `${Math.max(2, h.value * 100)}%` }));
  return (
    <Animated.View
      style={[
        styles.col,
        dashed ? { borderWidth: 2, borderStyle: "dashed", borderBottomWidth: 0, borderColor: c.border } : { backgroundColor: color, borderRightWidth: 7, borderRightColor: side },
        style,
      ]}
    />
  );
}

export function LedgerColumns({ ledger }: { ledger: Ledger }) {
  const { t } = useI18n();
  const c = useColors();
  const look = {
    estimated: [c.border, c.border, c.muted],
    self_reported: [c.skyLight, "#7D98B1", c.sky],
    pending: [c.saffronLight, "#C9A26C", c.saffronInk],
    verified: [c.green, c.greenDeep, c.greenDeep],
  } as const;
  const max = Math.max(1, ...STATUSES.map((k) => ledger.by_status[k].co2_kg));
  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.cols, { borderBottomColor: c.border }]}>
        {STATUSES.map((k, i) => (
          <View key={k} style={styles.colCell}>
            <Text style={[styles.value, { color: look[k][2] }]}>{Math.round(ledger.by_status[k].co2_kg * 10) / 10}</Text>
            <View style={styles.colTrack}>
              <Column share={ledger.by_status[k].co2_kg / max} color={look[k][0]} side={look[k][1]} dashed={k === "estimated"} index={i} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {STATUSES.map((k) => (
          <Text key={k} style={[type.small, styles.colLabel, { color: c.muted }]}>
            {t(`me.${k}` as MessageKey)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  journey: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4 },
  line: { position: "absolute", left: "5%", right: "5%", top: 16, height: 5, borderRadius: 3 },
  stop: { width: "20%", alignItems: "center", gap: 6 },
  dotBox: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 3 },
  here: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  halo: { position: "absolute", width: 30, height: 30, borderRadius: 15 },
  label: { fontFamily: fonts.bodyBold, fontSize: 10, textAlign: "center" },
  cols: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: space.md, borderBottomWidth: 1, paddingHorizontal: space.xs },
  colCell: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  colTrack: { width: 46, height: 110, justifyContent: "flex-end" },
  col: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  value: { fontFamily: fonts.display, fontSize: 17 },
  labels: { flexDirection: "row", gap: space.md },
  colLabel: { flex: 1, textAlign: "center", fontSize: 11 },
});
