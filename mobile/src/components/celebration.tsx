// The celebration after a logged action, a GEDA approval or a prize: a whole screen like the design's
// "Verified" page. Rays turn behind a spinning coin (or trophy), petals fall, sparks burst, the points
// count up, and a card shows the level bar, the streak, the photo quest and today's points.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Bar, Petals, Rays, Sparks, SpinningCoin, tap, useCountUp } from "@/components/motion";
import { Trophy } from "@/components/prizes";
import { useI18n, type MessageKey } from "@/i18n";
import { api } from "@/lib/api";
import { STAGE_KEYS, stageProgress, today, weeklyQuests } from "@/lib/game";
import type { PrizeTier } from "@/lib/prizes";
import { useShareCard } from "@/lib/use-share";
import { fonts, radius, space, type, useColors } from "@/theme";

export type CelebrationInfo = {
  points: number;
  title: string;
  body: string;
  badge: string;
  kind?: "coin" | "prize";
  tier?: PrizeTier;
};

// Celebrations queue rather than stack: one for a just-logged action is shown first, and a deferred
// one (a GEDA approval or a prize, raised by the tabs) waits until no other celebration is open.
let openNow = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => listeners.forEach((fn) => fn());

function useOthersOpen(): boolean {
  return useSyncExternalStore(subscribe, () => openNow > 0, () => false);
}

export function Celebration({ info, onClose, deferred = false }: { info: CelebrationInfo | null; onClose: () => void; deferred?: boolean }) {
  const othersOpen = useOthersOpen();
  const visible = !!info && !(deferred && othersOpen);
  useEffect(() => {
    if (!visible || deferred) return;
    openNow += 1;
    notify();
    return () => {
      openNow -= 1;
      notify();
    };
  }, [visible, deferred]);
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {visible && info && <CelebrationScreen info={info} onClose={onClose} />}
    </Modal>
  );
}

function CelebrationScreen({ info, onClose }: { info: CelebrationInfo; onClose: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    tap("success");
    const id = setTimeout(() => setBurst((b) => b + 1), 450);
    return () => clearTimeout(id);
  }, []);
  const points = Math.round(useCountUp(info.points, 900, 450));

  // Already cached by Home and the tabs; read here for the level card.
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const mine = useQuery({ queryKey: ["actions", "mine"], queryFn: () => api.myActions() });
  const level = dashboard.data?.level;
  const stage = stageProgress(level?.points ?? 0);
  const next = stage.index < STAGE_KEYS.length - 1 ? t(STAGE_KEYS[stage.index + 1]) : null;
  const photos = weeklyQuests(mine.data ?? []).find((q) => q.code === "photos2");
  const todayPoints = today(mine.data ?? []).points;
  const prize = info.kind === "prize";
  const sharer = useShareCard();

  const go = (path: "/quests" | "/") => {
    onClose();
    router.navigate(path);
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <Petals height={height} count={22} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}
        bounces={false}
      >
        <Animated.Text entering={FadeInDown.delay(100)} style={[styles.chip, { backgroundColor: prize ? c.saffronSoft : c.greenSoft, color: prize ? c.saffronInk : c.greenDeep }]}>
          {info.badge}
        </Animated.Text>

        <View style={styles.coinBox}>
          <Rays size={340} />
          <Animated.View entering={ZoomIn.delay(150).springify().damping(10)}>
            {prize ? <Trophy tier={info.tier ?? "gold"} size={170} spin /> : <SpinningCoin size={170} />}
          </Animated.View>
          <Animated.View entering={FadeIn.delay(700)} style={styles.leaf} pointerEvents="none">
            <Svg width={44} height={44} viewBox="0 0 24 24">
              <Path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill={c.greenBright} />
            </Svg>
          </Animated.View>
          <Sparks burstKey={burst} distance={130} count={20} />
        </View>

        {info.points > 0 && (
          <Animated.Text entering={FadeInDown.delay(300)} style={[styles.points, { color: c.saffronInk }]} accessibilityLabel={t("celebrate.pointsA11y", { n: info.points })}>
            +{points}
          </Animated.Text>
        )}
        <Animated.Text entering={FadeInDown.delay(380)} style={[styles.title, { color: c.text }]}>
          {info.title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(440)} style={[type.body, styles.body, { color: c.muted }]}>
          {info.body}
        </Animated.Text>

        {level && (
          <Animated.View entering={FadeInDown.delay(520)} style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.row}>
              <Text style={[styles.level, { color: c.text }]}>{t("stage.level", { n: stage.index + 1, stage: t(STAGE_KEYS[stage.index]) })}</Text>
              <Text style={[type.small, { color: c.muted }]}>{next ? t("stage.toNext", { n: stage.toNext, stage: next }) : t("stage.top")}</Text>
            </View>
            <Bar value={stage.share} height={10} delay={700} />
            <View style={styles.stats}>
              <Stat value={String(dashboard.data?.streak_days ?? 0)} label={t("celebrate.streak")} color={c.greenDeep} />
              <Stat value={photos ? `${photos.have}/${photos.need}` : "0/2"} label={t("celebrate.photoQuest")} color={c.sky} />
              <Stat value={`+${todayPoints}`} label={t("celebrate.today")} color={c.clay} />
            </View>
          </Animated.View>
        )}

        <View style={{ flex: 1, minHeight: space.xl }} />
        <Animated.View entering={FadeInDown.delay(620)} style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("share.button")}
            disabled={sharer.busy}
            onPress={() => void sharer.share()}
            style={({ pressed }) => [styles.btn, styles.shareBtn, { borderColor: c.border, opacity: sharer.busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Ionicons name="share-social-outline" size={22} color={c.text} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => go("/quests")} style={({ pressed }) => [styles.btn, { flex: 1, borderWidth: 1, borderColor: c.border, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={[styles.btnText, { color: c.text }]}>{t("celebrate.quests")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => go("/")} style={({ pressed }) => [styles.btn, { flex: 1.4, backgroundColor: c.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={[styles.btnText, { color: c.onPrimary }]}>{t("celebrate.back")}</Text>
          </Pressable>
        </Animated.View>
        {sharer.error && <Text style={[type.small, { color: c.red, marginTop: space.sm }]}>{sharer.error}</Text>}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Keys the celebration reads, so a missing translation shows up in the i18n test. */
export const CELEBRATION_KEYS: MessageKey[] = ["celebrate.streak", "celebrate.photoQuest", "celebrate.today", "celebrate.quests", "celebrate.back"];

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: space.xl, width: "100%", maxWidth: 520, alignSelf: "center" },
  chip: { fontFamily: fonts.bodyBold, fontSize: 13, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, overflow: "hidden" },
  coinBox: { width: 260, height: 240, alignItems: "center", justifyContent: "center", marginTop: space.md },
  leaf: { position: "absolute", right: 30, top: 18 },
  points: { fontFamily: fonts.display, fontSize: 58, lineHeight: 66, letterSpacing: -2 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, textAlign: "center" },
  body: { textAlign: "center", marginTop: space.sm, paddingHorizontal: space.md },
  card: { alignSelf: "stretch", marginTop: space.lg, padding: space.lg, borderRadius: 18, gap: space.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  level: { fontFamily: fonts.bodyBold, fontSize: 14 },
  stats: { flexDirection: "row", marginTop: space.xs },
  statValue: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24 },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15 },
  buttons: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  btn: { minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md },
  shareBtn: { width: 56, borderWidth: 1, paddingHorizontal: 0 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
