// The LiFE Score as a ring that draws itself in, with a small light circling it and the total
// counting up in the middle. The three parts (efficiency 50, consistency 30, verified 20) are listed
// beside it by the caller with SCORE_COLORS.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useCountUp } from "@/components/motion";
import { fonts, useColors } from "@/theme";

export const SCORE_COLORS = { efficiency: "#45678A", consistency: "#4E7D5E", verified: "#C9873E" } as const;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ScoreRing({ score, size = 116, label }: { score: number; size?: number; label: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = circ * (1 - Math.max(0, Math.min(100, score)) / 100);

  const offset = useSharedValue(reduced ? target : circ);
  const turn = useSharedValue(0);
  useEffect(() => {
    offset.value = reduced ? target : withTiming(target, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [target, reduced, offset]);
  useEffect(() => {
    if (!reduced) turn.value = withRepeat(withTiming(360, { duration: 7000, easing: Easing.linear }), -1);
  }, [reduced, turn]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const shown = Math.round(useCountUp(score, 1200));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`${label} ${score} / 100`}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={c.green} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${circ} ${circ}`} animatedProps={arc} />
      </Svg>
      {!reduced && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, orbit]}>
          <View style={[styles.dot, { left: size / 2 - 5, top: 0, backgroundColor: c.saffronLight, borderColor: c.surface }]} />
        </Animated.View>
      )}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.score, { color: c.text, fontSize: size * 0.31 }]}>{shown}</Text>
        <Text style={[styles.of, { color: c.muted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  score: { fontFamily: fonts.display, letterSpacing: -1, lineHeight: undefined },
  of: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase" },
  dot: { position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
