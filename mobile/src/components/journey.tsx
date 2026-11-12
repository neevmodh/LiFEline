// The journey (Seed, Sprout, Sapling, Tree, Grove) and the Impact Ledger's four columns rising side by
// side as 3D blocks, never stacked or added together.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useI18n, type MessageKey } from "@/i18n";
import type { Ledger } from "@/lib/api";
import { STAGE_KEYS, stageProgress } from "@/lib/game";
import { fonts, space, type, useColors } from "@/theme";

// The five stops as the design draws them: a winding path from Seed to Grove, the travelled part in
// sage drawing itself in, past stops filled, the current one saffron and pulsing.
const PATH = "M18 44 C40 30 60 22 85 24 S130 34 155 36 S200 50 228 46 S280 26 300 18";
const PATH_LENGTH = 300; // close enough to the drawn length for the dash animation
const STOPS = [
  { x: 18, y: 44 },
  { x: 85, y: 24 },
  { x: 155, y: 36 },
  { x: 228, y: 46 },
  { x: 300, y: 18 },
];
const VIEW_W = 318;
const VIEW_H = 62;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function Journey({ points }: { points: number }) {
  const { t } = useI18n();
  const c = useColors();
  const reduced = useReducedMotion();
  const progress = stageProgress(points);
  const here = progress.index;
  // How much of the path is travelled: whole segments up to here, plus the share of the next one.
  const travelled = here >= STOPS.length - 1 ? 1 : (here + progress.share) / (STOPS.length - 1);

  const pulse = useSharedValue(0);
  const draw = useSharedValue(reduced ? travelled : 0);
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
    draw.value = reduced ? travelled : withDelay(200, withTiming(travelled, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [reduced, pulse, draw, travelled]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.9 }] }));
  const dash = useAnimatedProps(() => ({ strokeDashoffset: PATH_LENGTH * (1 - draw.value) }));

  const next = here < STOPS.length - 1 ? t(STAGE_KEYS[here + 1]) : null;
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Text style={[type.heading, { color: c.text }]}>{t("me.journey")}</Text>
        <Text style={[styles.toNext, { color: c.muted }]}>{next ? t("stage.toNext", { n: progress.toNext, stage: next }) : t("stage.top")}</Text>
      </View>
      <View style={styles.track} accessibilityRole="image" accessibilityLabel={t("stage.level", { n: here + 1, stage: t(STAGE_KEYS[here]) })}>
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
          <Path d={PATH} fill="none" stroke={c.track} strokeWidth={5} strokeLinecap="round" />
          <AnimatedPath d={PATH} fill="none" stroke={c.green} strokeWidth={5} strokeLinecap="round" strokeDasharray={[PATH_LENGTH, PATH_LENGTH]} animatedProps={dash} />
        </Svg>
        {STOPS.map((p, i) => {
          const past = i < here;
          const now = i === here;
          const size = now ? 22 : 14;
          return (
            <View key={i} pointerEvents="none" style={[styles.stop, { left: `${(p.x / VIEW_W) * 100}%`, top: p.y - size / 2, width: size, height: size, marginLeft: -size / 2 }]}>
              {now && <Animated.View style={[styles.halo, { backgroundColor: c.saffronLight }, ring]} />}
              <View style={[styles.dot, { borderRadius: size, backgroundColor: now ? c.saffronLight : past ? c.green : c.surface, borderColor: now ? c.saffron : past ? c.green : c.border }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.stageLabels}>
        {STAGE_KEYS.map((k, i) => (
          <Text
            key={k}
            numberOfLines={1}
            style={[
              styles.label,
              // The end labels hug the card's edges instead of hanging off them.
              i === 0 ? { left: 0, marginLeft: 0, textAlign: "left" } : i === STAGE_KEYS.length - 1 ? { right: 0, marginLeft: 0, textAlign: "right" } : { left: `${(STOPS[i].x / VIEW_W) * 100}%` },
              { color: i === here ? c.saffronInk : c.muted, fontFamily: i === here ? fonts.bodyBold : fonts.bodyMedium },
            ]}
          >
            {t(k)}
          </Text>
        ))}
      </View>
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
    >
      {/* The lid: a lighter top face, so each column reads as a block standing on the line. */}
      {!dashed && <View style={[styles.lid, { backgroundColor: "#FFFFFF" }]} />}
    </Animated.View>
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
            {t(`me.col.${k}` as MessageKey)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.sm },
  toNext: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  track: { height: VIEW_H, width: "100%" },
  stop: { position: "absolute", alignItems: "center", justifyContent: "center" },
  dot: { width: "100%", height: "100%", borderWidth: 3 },
  halo: { position: "absolute", width: 22, height: 22, borderRadius: 11 },
  stageLabels: { height: 18, width: "100%" },
  label: { position: "absolute", width: 72, marginLeft: -36, textAlign: "center", fontSize: 11, lineHeight: 16 },
  cols: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: space.md, borderBottomWidth: 1, paddingHorizontal: space.xs },
  colCell: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  colTrack: { width: 46, height: 110, justifyContent: "flex-end" },
  col: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: "hidden" },
  lid: { height: 6, opacity: 0.35, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  value: { fontFamily: fonts.display, fontSize: 17 },
  labels: { flexDirection: "row", gap: space.md },
  colLabel: { flex: 1, textAlign: "center", fontSize: 11 },
});
