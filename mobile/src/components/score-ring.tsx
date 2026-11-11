// The LiFE Score as a ring: one arc per part (efficiency 50, consistency 30, verified 20), drawn in
// order around a 100-point circle, with the total in the middle.
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { fonts } from "@/theme";

const PARTS = [
  { key: "efficiency", color: "#7FB8FF" },
  { key: "consistency", color: "#2FB36A" },
  { key: "verified", color: "#F2A23A" },
] as const;

export function ScoreRing({
  score,
  efficiency,
  consistency,
  verified,
  size = 148,
  label,
}: {
  score: number;
  efficiency: number;
  consistency: number;
  verified: number;
  size?: number;
  label: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const values = { efficiency, consistency, verified };
  let offset = 0;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`${label} ${score} / 100`}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" />
        {PARTS.map((p) => {
          const len = (Math.max(0, values[p.key]) / 100) * circ;
          const el = (
            <Circle
              key={p.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.of}>/ 100</Text>
      </View>
    </View>
  );
}

export const SCORE_COLORS = Object.fromEntries(PARTS.map((p) => [p.key, p.color])) as Record<(typeof PARTS)[number]["key"], string>;

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  score: { fontFamily: fonts.display, fontSize: 46, color: "#F4F1E8", letterSpacing: -1 },
  of: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#BFD8D5" },
});
