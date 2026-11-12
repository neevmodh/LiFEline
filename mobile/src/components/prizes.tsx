// The prize shelf on Me: a trophy for each prize, bronze, silver or gold. Won ones shine and stand
// on the shelf; the rest are drawn faint with how far along they are. The trophy also spins in the
// celebration when a prize is won.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, ZoomIn } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";

import { Bar } from "@/components/motion";
import { useI18n, type MessageKey } from "@/i18n";
import type { Prize, PrizeTier } from "@/lib/prizes";
import { fonts, space, useColors } from "@/theme";

export const TIER_LOOK: Record<PrizeTier, { metal: string; shade: string; ink: string; soft: string }> = {
  bronze: { metal: "#D39A6A", shade: "#A86B3D", ink: "#5E3517", soft: "#F4E3D3" },
  silver: { metal: "#C9D1D6", shade: "#93A0A8", ink: "#3B4850", soft: "#E8EDF0" },
  gold: { metal: "#E9B872", shade: "#C9873E", ink: "#5B3A12", soft: "#F5E6D2" },
};

/** A trophy cup in the tier's metal. Faint when not yet won. */
export function Trophy({ tier, size = 56, won = true, spin = false }: { tier: PrizeTier; size?: number; won?: boolean; spin?: boolean }) {
  const look = TIER_LOOK[tier];
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  const drop = useSharedValue(spin && !reduced ? -40 : 0);
  useEffect(() => {
    if (!spin || reduced) return;
    drop.value = withSpring(0, { damping: 9 });
    turn.value = withRepeat(withSequence(withTiming(360, { duration: 1000, easing: Easing.out(Easing.cubic) }), withTiming(360, { duration: 1800 }), withTiming(0, { duration: 0 })), -1);
  }, [spin, reduced, turn, drop]);
  const style = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { translateY: drop.value }, { rotateY: `${turn.value}deg` }] }));
  const metal = won ? look.metal : "#E7E0D3";
  const shade = won ? look.shade : "#D9D0BF";
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {/* handles */}
        <Path d="M13 12H7c0 7 3 11 8 12M35 12h6c0 7-3 11-8 12" stroke={shade} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* cup */}
        <Path d="M12 8h24v8c0 8-5 14-12 14S12 24 12 16z" fill={metal} />
        <Path d="M30 8h6v8c0 8-5 14-12 14 4-2 6-8 6-14z" fill={shade} opacity={0.55} />
        {won && <Path d="M16 11v5c0 3 1 6 3 8" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} fill="none" strokeLinecap="round" />}
        {/* stem and base */}
        <Rect x={21} y={29} width={6} height={6} fill={shade} />
        <Rect x={15} y={35} width={18} height={6} rx={2} fill={metal} />
        <Rect x={13} y={40} width={22} height={4} rx={2} fill={shade} />
        {/* star */}
        {won && <Path d="M24 12l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill={look.ink} opacity={0.75} />}
      </Svg>
    </Animated.View>
  );
}

function Shine({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-60);
  useEffect(() => {
    if (!reduced) x.value = withDelay(delay, withRepeat(withSequence(withTiming(90, { duration: 900 }), withTiming(90, { duration: 2600 }), withTiming(-60, { duration: 0 })), -1));
  }, [reduced, delay, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: "20deg" }] }));
  if (reduced) return null;
  return <Animated.View pointerEvents="none" style={[styles.shine, style]} />;
}

export function PrizeShelf({ list }: { list: Prize[] }) {
  const { t } = useI18n();
  const c = useColors();
  const won = list.filter((p) => p.won).length;
  // Won prizes first, then the closest to being won.
  const sorted = [...list].sort((a, b) => Number(b.won) - Number(a.won) || b.share - a.share);
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>{t("prize.title")}</Text>
        <Text style={[styles.count, { color: c.muted }]}>{t("prize.count", { won, total: list.length })}</Text>
      </View>
      <Text style={[styles.sub, { color: c.muted }]}>{t("prize.sub")}</Text>
      <View style={styles.grid}>
        {sorted.map((p, i) => {
          const look = TIER_LOOK[p.tier];
          const name = t(`prize.${p.code}` as MessageKey);
          return (
            <Animated.View
              key={p.code}
              entering={ZoomIn.delay(100 + i * 60).springify().damping(13)}
              style={[styles.card, { backgroundColor: p.won ? look.soft : c.surface, borderColor: p.won ? "transparent" : c.border }]}
              accessibilityLabel={p.won ? `${name}, ${t("prize.wonShort")}` : `${name}, ${p.have}/${p.need}`}
            >
              <View style={styles.cupBox}>
                <Trophy tier={p.tier} won={p.won} size={52} />
                {p.won && <Shine delay={i * 500} />}
              </View>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
                {name}
              </Text>
              <Text style={[styles.how, { color: p.won ? look.ink : c.muted }]} numberOfLines={2}>
                {p.won ? t(`prize.tier.${p.tier}` as MessageKey) : t(`prize.${p.code}.how` as MessageKey)}
              </Text>
              {!p.won && (
                <View style={{ width: "100%", gap: 3 }}>
                  <Bar value={p.share} height={6} color={look.shade} />
                  <Text style={[styles.progress, { color: c.muted }]}>{`${p.have.toLocaleString("en-IN")} / ${p.need.toLocaleString("en-IN")}`}</Text>
                </View>
              )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontFamily: fonts.display, fontSize: 19 },
  count: { fontFamily: fonts.bodyBold, fontSize: 12 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  card: { flexBasis: "47%", flexGrow: 1, borderRadius: 20, borderWidth: 1, padding: space.md, alignItems: "center", gap: 4, overflow: "hidden" },
  cupBox: { width: 64, height: 60, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  shine: { position: "absolute", top: -10, width: 14, height: 90, backgroundColor: "rgba(255,255,255,0.55)" },
  name: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17, textAlign: "center" },
  how: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, textAlign: "center" },
  progress: { fontFamily: fonts.bodyBold, fontSize: 10, textAlign: "center" },
});
