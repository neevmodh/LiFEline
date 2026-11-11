// Motion used across the app: numbers that count up, sections that rise in, the streak flame, a burst
// of sparks, a spinning coin, a short haptic tap and the celebration that follows a logged action.
// Every loop and burst stands still when the phone's reduce-motion setting is on.
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { fonts, radius, space, type, useColors } from "@/theme";

/** A light tap on phones; nothing on the web. */
export function tap(kind: "light" | "success" = "light") {
  if (process.env.EXPO_OS === "web") return;
  if (kind === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Counts from 0 to `target` over `ms`, easing out. Reduced motion shows the number straight away. */
export function useCountUp(target: number, ms = 1100, delay = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = Date.now() + delay;
    const step = () => {
      const t = Math.max(0, Math.min(1, (Date.now() - start) / ms));
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, delay, reduced]);
  return value;
}

/** Rises into place, `index` steps after the first. */
export function Rise({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).duration(450)} style={style}>
      {children}
    </Animated.View>
  );
}

/** A progress bar that fills from empty to `value` (0 to 1). */
export function Bar({ value, color, track, height = 8, delay = 200 }: { value: number; color?: string; track?: string; height?: number; delay?: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, value));
  const w = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    w.value = reduced ? target : withDelay(delay, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [target, reduced, delay, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? c.track, overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color ?? c.green }, fill]} />
    </View>
  );
}

/** Gently rocks its child every few seconds, to say "tap me". */
export function Wiggle({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduced || !active) {
      r.value = 0;
      return;
    }
    r.value = withRepeat(withSequence(withTiming(0, { duration: 2400 }), withTiming(-10, { duration: 90 }), withTiming(10, { duration: 120 }), withTiming(0, { duration: 90 })), -1);
  }, [reduced, active, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The streak flame, flickering. */
export function Flame({ size = 16, color }: { size?: number; color?: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const f = useSharedValue(0);
  useEffect(() => {
    if (!reduced) f.value = withRepeat(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, f]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: size * 0.05 * f.value }, { scaleY: 1 + 0.14 * f.value }, { rotate: `${-3 + 6 * f.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size * 1.12} viewBox="0 0 16 18">
        <Path d="M8 1c1 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 2-6 1 1 2 2 2 3 0-3 1-5 2-7z" fill={color ?? c.saffron} />
      </Svg>
    </Animated.View>
  );
}

/** A small gold coin, the app's mark for points. */
export function CoinIcon({ size = 15 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill={c.saffronLight} />
      <Circle cx={12} cy={12} r={6} fill="none" stroke={c.saffron} strokeWidth={2} />
    </Svg>
  );
}

const SPARK_COLORS = ["#E9B872", "#8DB497", "#9DB4C9", "#E8C9B9", "#4E7D5E"];

function Spark({ angle, distance, color, delay }: { angle: number; distance: number; color: string; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: Math.cos(angle) * distance * p.value },
      { translateY: Math.sin(angle) * distance * p.value },
      { rotate: `${200 * p.value}deg` },
      { scale: 1 - 0.7 * p.value },
    ],
  }));
  return <Animated.View style={[styles.spark, { backgroundColor: color }, style]} />;
}

/** A burst of petal-shaped sparks from the centre of its box. Change `burstKey` to fire again. */
export function Sparks({ burstKey, count = 16, distance = 110 }: { burstKey: number; count?: number; distance?: number }) {
  const reduced = useReducedMotion();
  if (reduced || burstKey === 0) return null;
  return (
    <View pointerEvents="none" style={styles.sparkBox} key={burstKey}>
      {Array.from({ length: count }, (_, n) => (
        <Spark key={n} angle={(n / count) * Math.PI * 2} distance={distance + (n % 3) * 24} color={SPARK_COLORS[n % SPARK_COLORS.length]} delay={(n % 4) * 25} />
      ))}
    </View>
  );
}

/** The big gold coin that drops in and spins. */
export function SpinningCoin({ size = 150 }: { size?: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const drop = useSharedValue(reduced ? 0 : -40);
  useEffect(() => {
    if (reduced) return;
    drop.value = withSpring(0, { damping: 9 });
    spin.value = withRepeat(withSequence(withTiming(360, { duration: 900, easing: Easing.out(Easing.cubic) }), withTiming(360, { duration: 1600 }), withTiming(0, { duration: 0 })), -1);
  }, [reduced, spin, drop]);
  const style = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { translateY: drop.value }, { rotateY: `${spin.value}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.saffronLight, borderBottomWidth: 8, borderColor: c.saffron, alignItems: "center", justifyContent: "center" }, style]}>
      <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: 4, borderColor: c.saffron, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size * 0.36} height={size * 0.36} viewBox="0 0 24 24">
          <Path d="M12 22V10M12 10c0-4 3-7 8-7 0 5-3 8-8 7zM12 14c0-3-2-6-7-6 0 4 2 7 7 6z" stroke={c.saffronInk} strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
    </Animated.View>
  );
}

export type CelebrationInfo = { points: number; title: string; body: string; badge: string };

/** Shown after an action is logged: the coin spins in, sparks burst and the points count up. */
export function Celebration({ info, onClose, closeLabel }: { info: CelebrationInfo | null; onClose: () => void; closeLabel: string }) {
  const c = useColors();
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (info) {
      tap("success");
      setBurst((b) => b + 1);
    }
  }, [info]);
  const points = useCountUp(info?.points ?? 0, 900, 350);
  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop]}>
        <Animated.View entering={FadeInDown.springify().damping(14)} style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={styles.coinBox}>
            <SpinningCoin size={120} />
            <Sparks burstKey={burst} distance={100} />
          </View>
          <Text style={[styles.badge, { backgroundColor: c.greenSoft, color: c.greenDeep }]}>{info?.badge}</Text>
          <Text style={[type.number, { color: c.saffronInk, fontSize: 52 }]}>+{Math.round(points)}</Text>
          <Text style={[type.title, { color: c.text, fontSize: 24, textAlign: "center" }]}>{info?.title}</Text>
          <Text style={[type.body, { color: c.muted, textAlign: "center" }]}>{info?.body}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: c.onPrimary }}>{closeLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  spark: { position: "absolute", width: 10, height: 7, borderTopLeftRadius: 7, borderBottomRightRadius: 7 },
  sparkBox: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(35,49,42,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, paddingBottom: space.xxl + space.md, alignItems: "center", gap: space.sm, width: "100%", maxWidth: 560, alignSelf: "center" },
  coinBox: { width: 180, height: 160, alignItems: "center", justifyContent: "center" },
  badge: { fontFamily: fonts.bodyBold, fontSize: 13, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, overflow: "hidden" },
  close: { marginTop: space.md, minHeight: 54, alignSelf: "stretch", borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
