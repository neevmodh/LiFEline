// The daily chest: locked until today's three moves are done, then it bobs, shakes when tapped and
// flips its lid open with a burst of sparks. What it reveals is decided by the screen that owns it.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";

import { Sparks, tap } from "@/components/motion";
import { useColors } from "@/theme";

export type ChestState = "locked" | "ready" | "open";

export function Chest({ state, onOpen, size = 140, label }: { state: ChestState; onOpen?: () => void; size?: number; label: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);
  const shake = useSharedValue(0);
  const lid = useSharedValue(state === "open" ? 1 : 0);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (state === "ready" && !reduced) {
      bob.value = withRepeat(withSequence(withTiming(0, { duration: 1800 }), withTiming(-8, { duration: 160 }), withTiming(0, { duration: 220 })), -1);
    } else {
      bob.value = 0;
    }
  }, [state, reduced, bob]);
  useEffect(() => {
    if (state === "open") lid.value = reduced ? 1 : withSpring(1, { damping: 8, stiffness: 120 });
  }, [state, reduced, lid]);

  const body = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }, { rotate: `${shake.value}deg` }] }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -6 * lid.value }, { translateY: -12 * lid.value }, { rotate: `${-36 * lid.value}deg` }],
  }));

  function press() {
    if (state !== "ready") return;
    tap();
    if (reduced) {
      onOpen?.();
      return;
    }
    shake.value = withSequence(
      withTiming(-8, { duration: 70, easing: Easing.linear }),
      withTiming(8, { duration: 110 }),
      withTiming(-6, { duration: 110 }),
      withTiming(5, { duration: 110 }),
      withTiming(0, { duration: 90 }),
    );
    setTimeout(() => {
      setBurst((b) => b + 1);
      tap("success");
      onOpen?.();
    }, 520);
  }

  const w = size;
  const h = size;
  const locked = state === "locked";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: state !== "ready" }} onPress={press} style={{ width: w, height: h }}>
      <Animated.View style={[{ width: w, height: h, opacity: locked ? 0.55 : 1 }, body]}>
        <Svg width={w} height={h} viewBox="0 0 150 150" style={StyleSheet.absoluteFill}>
          <Ellipse cx={75} cy={134} rx={52} ry={8} fill="rgba(35,49,42,0.18)" />
          <Rect x={25} y={68} width={100} height={62} rx={8} fill={c.saffron} />
          <Rect x={25} y={88} width={100} height={8} fill="#A86E2E" />
          <Rect x={66} y={80} width={18} height={22} rx={4} fill={c.ink} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: "17% 47%" }, lidStyle]}>
          <Svg width={w} height={h} viewBox="0 0 150 150">
            <Path d="M25 70c0-26 18-38 50-38s50 12 50 38z" fill={c.saffronLight} />
            <Rect x={25} y={62} width={100} height={10} rx={3} fill="#D9A15A" />
          </Svg>
        </Animated.View>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Sparks burstKey={burst} distance={80} count={14} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** A thin version for list rows. */
export function ChestIcon({ size = 40 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size * 0.9} viewBox="0 0 40 36">
      <Rect x={3} y={14} width={34} height={20} rx={3} fill={c.saffron} />
      <Path d="M3 14c0-8 6-12 17-12s17 4 17 12z" fill={c.saffronLight} />
      <Rect x={17} y={12} width={6} height={9} rx={1.5} fill={c.ink} />
    </Svg>
  );
}
