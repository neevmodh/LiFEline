// The top three as a podium: second, first, third, the steps rising in one after another with a
// slight 3D tilt and a crown bobbing over first place.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { fonts, space, useColors } from "@/theme";

export type PodiumItem = { rank: number; name: string; value: string; mine?: boolean };

function Crown() {
  const c = useColors();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * t.value }, { rotate: `${-6 + 12 * t.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Svg width={30} height={22} viewBox="0 0 34 26">
        <Path d="M2 8l8 7 7-13 7 13 8-7-3 16H5z" fill={c.saffron} />
      </Svg>
    </Animated.View>
  );
}

function Step({ item, height, delay, bg, ink }: { item: PodiumItem; height: number; delay: number; bg: string; ink: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? height : 0);
  useEffect(() => {
    h.value = reduced ? height : withDelay(delay, withSpring(height, { damping: 13, stiffness: 110 }));
  }, [height, delay, reduced, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={styles.col}>
      {item.rank === 1 && <Crown />}
      <Text style={[styles.name, { color: item.mine ? c.greenDeep : c.text }]} numberOfLines={2}>
        {item.name}
      </Text>
      <Animated.View style={[styles.step, { backgroundColor: bg, borderColor: item.mine ? c.green : "transparent" }, style]}>
        <Text style={[styles.rank, { color: ink }]}>{item.rank}</Text>
        <Text style={[styles.value, { color: ink }]} numberOfLines={1}>
          {item.value}
        </Text>
      </Animated.View>
    </View>
  );
}

export function Podium({ items }: { items: PodiumItem[] }) {
  const c = useColors();
  const look: Record<number, [string, string, number, number]> = {
    1: [c.saffronLight, "#5B3A12", 150, 150],
    2: ["#D6DFD0", "#1F3A29", 116, 0],
    3: [c.clayLight, "#6B3524", 88, 300],
  };
  const order = [2, 1, 3].map((r) => items.find((i) => i.rank === r)).filter((i): i is PodiumItem => !!i);
  return (
    <View style={styles.podium} accessibilityLabel={items.map((i) => `${i.rank}. ${i.name} ${i.value}`).join(", ")}>
      {order.map((item) => {
        const [bg, ink, height, delay] = look[item.rank];
        return <Step key={item.rank} item={item} height={height} delay={delay} bg={bg} ink={ink} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, height: 230, transform: [{ perspective: 700 }, { rotateX: "8deg" }] },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  name: { fontFamily: fonts.bodyBold, fontSize: 12, textAlign: "center" },
  step: { width: "100%", borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: "center", paddingTop: 8, borderWidth: 2, overflow: "hidden" },
  rank: { fontFamily: fonts.display, fontSize: 28 },
  value: { fontFamily: fonts.bodyBold, fontSize: 11, paddingHorizontal: 4 },
});
