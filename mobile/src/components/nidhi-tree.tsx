// The Nidhi tree: a drawing only, growing in stages with verified CO2 (photo-approved actions).
// The canopy grows into its new size when the stage changes; with the phone's reduce-motion setting
// on, it simply appears at that size.
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { useColors } from "@/theme";

/** Stage 0 (seed) to 4 (full tree), by verified kg CO2. */
export function treeStage(verifiedKg: number): number {
  if (verifiedKg <= 0) return 0;
  if (verifiedKg < 5) return 1;
  if (verifiedKg < 25) return 2;
  if (verifiedKg < 100) return 3;
  return 4;
}

const CANOPY = [0, 28, 48, 68, 88];
const TRUNK = [0, 10, 22, 34, 44];

export function NidhiTree({ verifiedKg }: { verifiedKg: number }) {
  const c = useColors();
  const stage = treeStage(verifiedKg);
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0.4);

  useEffect(() => {
    grow.value = reduced ? 1 : 0.4;
    if (!reduced) grow.value = withSpring(1, { damping: 9, stiffness: 90 });
  }, [stage, reduced, grow]);

  const canopyStyle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  const canopy = CANOPY[stage];
  return (
    <View style={styles.box} accessibilityRole="image" accessibilityLabel={`Nidhi tree, stage ${stage} of 4`}>
      {stage === 0 ? (
        <View style={[styles.seed, { backgroundColor: c.saffron }]} />
      ) : (
        <>
          <Animated.View style={[{ width: canopy, height: canopy, borderRadius: canopy / 2, backgroundColor: c.green }, canopyStyle]}>
            {stage >= 3 && <View style={[styles.fruit, { backgroundColor: c.saffron, top: canopy * 0.3, left: canopy * 0.65 }]} />}
          </Animated.View>
          <View style={{ width: 8 + stage * 2, height: TRUNK[stage], backgroundColor: "#7A5230", borderRadius: 3, marginTop: -6 }} />
        </>
      )}
      <View style={[styles.ground, { backgroundColor: c.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 140, height: 150, alignItems: "center", justifyContent: "flex-end" },
  seed: { width: 14, height: 10, borderRadius: 7, marginBottom: 2 },
  fruit: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  ground: { width: 120, height: 6, borderRadius: 3 },
});
