// Drawn scenes: the sun rising over Gujarati rooftops with solar panels (Welcome) and a sprout whose
// leaves unfold (sign in). Flat shapes in the app's paper, sage, saffron and clay.
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { useColors } from "@/theme";

function useLoop(ms: number, from = 0, to = 1, reverse = true) {
  const reduced = useReducedMotion();
  const v = useSharedValue(from);
  useEffect(() => {
    if (!reduced) v.value = withRepeat(withTiming(to, { duration: ms, easing: Easing.inOut(Easing.quad) }), -1, reverse);
  }, [reduced, v, ms, to, reverse]);
  return v;
}

export function SunriseScene({ height = 380 }: { height?: number }) {
  const c = useColors();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, 560);
  const reduced = useReducedMotion();
  const sun = useSharedValue(reduced ? 0 : 70);
  useEffect(() => {
    if (!reduced) sun.value = withTiming(0, { duration: 2400, easing: Easing.out(Easing.cubic) });
  }, [reduced, sun]);
  const cloudA = useLoop(38000, -90, width + 20, false);
  const cloudB = useLoop(52000, width + 20, -90, false);
  const sway = useLoop(3500);

  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sun.value }] }));
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateX: cloudA.value }] }));
  const bStyle = useAnimatedStyle(() => ({ transform: [{ translateX: cloudB.value }] }));
  const treeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-2 + 4 * sway.value}deg` }] }));

  const s = width / 390;
  return (
    <View style={{ width, height, backgroundColor: "#EFE6D6", overflow: "hidden", alignSelf: "center" }} accessibilityRole="image" accessibilityLabel="The sun rising over rooftops with solar panels">
      <Animated.View style={[{ position: "absolute", left: 270 * s - 80, top: height * 0.4 - 80 }, sunStyle]}>
        <Svg width={160} height={160}>
          <Circle cx={80} cy={80} r={78} fill={c.saffronLight} opacity={0.2} />
          <Circle cx={80} cy={80} r={54} fill={c.saffronLight} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", top: 60 }, aStyle]}>
        <Svg width={72} height={26}><Path d="M0 24h70a16 16 0 0 0-22-20 22 22 0 0 0-40 6A12 12 0 0 0 0 24z" fill="#FBF7EF" /></Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", top: 110 }, bStyle]}>
        <Svg width={58} height={20}><Path d="M0 18h56a13 13 0 0 0-18-16 18 18 0 0 0-32 5A10 10 0 0 0 0 18z" fill="#FBF7EF" /></Svg>
      </Animated.View>
      <Svg width={width} height={height} viewBox={`0 0 390 ${height}`} preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", bottom: 0 }}>
        <G transform={`translate(0 ${height - 430})`}>
          <Path d="M0 300 60 262l50 26 70-44 60 30 50-24 100 40v140H0z" fill="#C9D3BE" />
          <Rect x={22} y={282} width={96} height={148} fill="#E3C9A8" />
          <Path d="M14 286 70 248l56 38z" fill="#B5674A" />
          <Rect x={40} y={320} width={20} height={26} rx={3} fill="#F6F2EA" />
          <Rect x={78} y={320} width={20} height={26} rx={3} fill="#F6F2EA" />
          <Rect x={140} y={250} width={110} height={180} fill="#EBDCC5" />
          <G transform="translate(150 232) skewX(-18)">
            <Rect width={40} height={14} fill="#476A86" />
            <Rect x={44} width={40} height={14} fill="#476A86" />
          </G>
          {[152, 186, 220].map((x) => <Rect key={`a${x}`} x={x} y={270} width={20} height={24} rx={3} fill="#F6F2EA" />)}
          {[152, 186, 220].map((x) => <Rect key={`b${x}`} x={x} y={312} width={20} height={24} rx={3} fill={x === 186 ? c.saffronLight : "#F6F2EA"} />)}
          <Rect x={270} y={296} width={100} height={134} fill="#DCC6A6" />
          <Path d="M262 300h116l-12-20h-92z" fill="#8E5A43" />
          <Rect x={286} y={330} width={22} height={26} rx={3} fill="#F6F2EA" />
          <Rect x={330} y={330} width={22} height={26} rx={3} fill="#F6F2EA" />
          <Rect x={0} y={406} width={390} height={30} fill={c.background} />
        </G>
      </Svg>
      <Animated.View style={[{ position: "absolute", left: 98 * s, bottom: 24, width: 56, height: 90, transformOrigin: "50% 100%" }, treeStyle]}>
        <Svg width={56} height={90} viewBox="0 0 56 90">
          <Rect x={24} y={30} width={8} height={60} fill={c.bark} />
          <Circle cx={28} cy={24} r={24} fill={c.green} />
          <Circle cx={14} cy={38} r={14} fill={c.greenBright} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A sprout whose two leaves unfold one after the other. */
export function Sprout({ size = 86 }: { size?: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const a = useSharedValue(reduced ? 1 : 0);
  const b = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    a.value = withDelay(200, withSpring(1, { damping: 8 }));
    b.value = withDelay(450, withSpring(1, { damping: 8 }));
  }, [reduced, a, b]);
  const left = useAnimatedStyle(() => ({ transform: [{ scale: a.value }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ scale: b.value }] }));
  const k = size / 86;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 86 86" style={{ position: "absolute" }}>
        <Circle cx={43} cy={43} r={43} fill={c.greenSoft} />
        <Path d="M43 70V40" stroke={c.bark} strokeWidth={4} strokeLinecap="round" />
      </Svg>
      <Animated.View style={[{ position: "absolute", left: 25 * k, top: 30 * k, transformOrigin: "100% 100%" }, left]}>
        <Svg width={18 * k} height={18 * k} viewBox="0 0 18 18"><Path d="M18 18C6 18 0 10 0 0c10 0 18 6 18 18z" fill={c.greenBright} /></Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: 43 * k, top: 20 * k, transformOrigin: "0% 100%" }, right]}>
        <Svg width={20 * k} height={20 * k} viewBox="0 0 20 20"><Path d="M0 20C0 8 8 0 20 0c0 12-8 20-20 20z" fill={c.green} /></Svg>
      </Animated.View>
    </View>
  );
}
