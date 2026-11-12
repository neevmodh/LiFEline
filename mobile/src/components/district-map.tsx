// Gujarat's 33 districts, coloured by progress toward this month's goal relative to the leader (the
// same standings as the list below it). Your district has a saffron outline; tap any district to see its numbers.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { DISTRICT_PATHS, MAP_VIEWBOX } from "@/components/gujarat-paths";
import { useI18n } from "@/i18n";
import type { DistrictRank } from "@/lib/api";
import { districtAt, parsePath, rampIndex } from "@/lib/ramp";

const SHAPES = DISTRICT_PATHS.map((p) => ({ name: p.name, polygons: parsePath(p.d) }));
import { fonts, space, type, useColors } from "@/theme";

/** Sage, light to deep: the leading district is deepest. */
const RAMP = ["#DCE8D9", "#B9D2B6", "#8DB497", "#5F8E6F", "#3F6B4E"];

export function DistrictMap({ standings, mine }: { standings: DistrictRank[]; mine?: number | null }) {
  const { t, district } = useI18n();
  const c = useColors();
  const byName = new Map(standings.map((d) => [d.district, d]));
  const myName = standings.find((d) => d.district_id === mine)?.district;
  const [picked, setPicked] = useState<string | null>(myName ?? null);
  const sel = picked ? byName.get(picked) : undefined;
  const maxPct = useMemo(() => Math.max(0, ...standings.map((d) => d.goal_progress_pct)), [standings]);
  const [box, setBox] = useState({ width: 1, height: 1 });

  return (
    <View style={{ gap: space.sm }}>
      {/* One press handler on the whole map with a point-in-district test: SVG shapes can't take presses on the web. */}
      <Pressable
        style={styles.mapBox}
        accessibilityLabel={t("map.a11y")}
        onLayout={(e) => setBox(e.nativeEvent.layout)}
        onPress={(e) => {
          // Phones report locationX/Y; in the web build the press is a browser click with offsetX/Y.
          const ev = e.nativeEvent as typeof e.nativeEvent & { offsetX?: number; offsetY?: number };
          const x = ((ev.locationX ?? ev.offsetX ?? -1) / box.width) * MAP_VIEWBOX.width;
          const y = ((ev.locationY ?? ev.offsetY ?? -1) / box.height) * MAP_VIEWBOX.height;
          const hit = districtAt(x, y, SHAPES);
          if (hit) setPicked(hit);
        }}
      >
        {/* The SVG ignores touches so the press lands on the map itself, and locationX/Y are measured from its corner. */}
        <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} pointerEvents="none">
          <G>
            {DISTRICT_PATHS.map((p) => {
              const i = rampIndex(byName.get(p.name)?.goal_progress_pct, maxPct);
              return (
                <Path
                  key={p.name}
                  d={p.d}
                  fill={i < 0 ? c.track : RAMP[i]}
                  stroke={c.surface}
                  strokeWidth={2}
                />
              );
            })}
            {/* Mine and the picked one on top, so their outlines aren't hidden by neighbours. */}
            {DISTRICT_PATHS.filter((p) => p.name === myName || p.name === picked).map((p) => (
              <Path key={`o-${p.name}`} d={p.d} fill="none" stroke={p.name === myName ? c.saffron : c.primary} strokeWidth={p.name === myName ? 6 : 4} />
            ))}
          </G>
        </Svg>
      </Pressable>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: c.muted }]}>{t("map.less")}</Text>
        {RAMP.map((col) => (
          <View key={col} style={[styles.swatch, { backgroundColor: col }]} />
        ))}
        <Text style={[styles.legendText, { color: c.muted }]}>{t("map.more")}</Text>
      </View>
      {sel ? (
        <View style={[styles.card, { backgroundColor: c.surfaceAlt }]} accessibilityLiveRegion="polite">
          <Text style={[type.body, { color: c.text, fontFamily: fonts.bodyBold }]}>{`#${sel.rank} ${district(sel.district)}`}</Text>
          <Text style={[type.small, { color: c.muted }]}>
            {t("map.detail", { pct: Math.round(sel.goal_progress_pct), kg: sel.co2_saved_per_participant_kg, n: sel.participants })}
          </Text>
        </View>
      ) : picked ? (
        <View style={[styles.card, { backgroundColor: c.surfaceAlt }]}>
          <Text style={[type.body, { color: c.text, fontFamily: fonts.bodyBold }]}>{district(picked)}</Text>
          <Text style={[type.small, { color: c.muted }]}>{t("map.none")}</Text>
        </View>
      ) : (
        <Text style={[type.small, { color: c.muted }]}>{t("map.tap")}</Text>
      )}
      {/* Districts as buttons too, for screen readers and keyboards (the map itself isn't focusable). */}
      <View style={styles.hidden}>
        {DISTRICT_PATHS.map((p) => (
          <Pressable key={p.name} accessibilityRole="button" accessibilityLabel={district(p.name)} onPress={() => setPicked(p.name)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapBox: { width: "100%", aspectRatio: MAP_VIEWBOX.width / MAP_VIEWBOX.height },
  legend: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "center" },
  legendText: { fontFamily: fonts.bodyMedium, fontSize: 11, marginHorizontal: 4 },
  swatch: { width: 26, height: 10, borderRadius: 3 },
  card: { borderRadius: 14, padding: space.md, gap: 2 },
  hidden: { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 },
});
