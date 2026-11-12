// Quests: the streak as a week of flames, the daily chest (opens once today's three moves are done
// and reveals today's real totals), this week's quests and the badges. All of it is worked out from
// the household's own action history, so nothing here hands out points of its own.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Columns, usePageWidth } from "@/components/layout";
import { PrizeShelf } from "@/components/prizes";
import { Chest } from "@/components/chest";
import { Bar, CoinIcon, Flame, Rise, useCountUp } from "@/components/motion";
import { ErrorText, Hero } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api } from "@/lib/api";
import { useChestOpened } from "@/lib/chest";
import { prizes } from "@/lib/prizes";
import { CHEST_GOAL, today, weekFlames, weeklyQuests, type QuestCode } from "@/lib/game";
import { fonts, radius, shadow, space, type, useColors } from "@/theme";

const QUEST_ICON: Record<QuestCode, React.ComponentProps<typeof Ionicons>["name"]> = {
  log10: "checkmark-done-outline",
  photos2: "camera-outline",
  peak3: "flash-outline",
  themes3: "color-palette-outline",
};

export default function Quests() {
  const { t, locale } = useI18n();
  const c = useColors();
  const mine = useQuery({ queryKey: ["actions", "mine"], queryFn: () => api.myActions() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const badges = useQuery({ queryKey: ["badges"], queryFn: api.badges });
  const refreshing = [mine, dashboard, badges].some((q) => q.isRefetching);

  const logs = mine.data ?? [];
  const day = today(logs);
  const [opened, markOpened] = useChestOpened(day.day);
  const [justOpened, setJustOpened] = useState(false);
  const ready = day.logs.length >= CHEST_GOAL;
  const flames = weekFlames(logs);
  const quests = weeklyQuests(logs);
  const streak = dashboard.data?.streak_days ?? 0;
  const page = usePageWidth();
  const prizeList =
    dashboard.data && badges.data && mine.data
      ? prizes({ points: dashboard.data.level.points, streakDays: streak, logs: mine.data, badges: badges.data })
      : null;
  const points = Math.round(useCountUp(dashboard.data?.level.points ?? 0, 1000));
  const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { weekday: "narrow" });
  const tones = [c.saffronSoft, c.greenSoft, c.skySoft, c.claySoft];
  const inks = [c.saffronInk, c.greenDeep, c.sky, c.clay];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => [mine, dashboard, badges].forEach((q) => q.refetch())} />}
    >
      <Hero title={t("nav.quests")}>
        <View style={[styles.pointsChip, { backgroundColor: c.greenSoft }]}>
          <CoinIcon />
          <Text style={[styles.chipText, { color: c.greenDeep }]}>{t("home.points", { n: points.toLocaleString("en-IN") })}</Text>
        </View>
      </Hero>
      <View style={[styles.page, page]}>
        {mine.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}

        <Columns
          left={
            <>
        <Rise index={0} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <Flame size={20} />
            <Text style={[type.heading, { color: c.text, fontSize: 20, lineHeight: 26, flex: 1 }]}>{streak > 0 ? t("quests.streak", { n: streak }) : t("quests.streakNone")}</Text>
          </View>
          <View style={styles.week}>
            {flames.map((f) => (
              <View key={f.day} style={styles.dayCol}>
                <Text style={[type.small, { color: c.muted }]}>{weekday(f.day)}</Text>
                <View
                  style={[
                    styles.dayBox,
                    { backgroundColor: f.lit ? (f.isToday ? c.saffronSoft : c.greenSoft) : c.surfaceAlt, borderColor: f.isToday ? c.saffron : "transparent", opacity: f.future ? 0.5 : 1 },
                  ]}
                >
                  {f.lit && (f.isToday ? <Flame size={14} /> : <Flame size={14} color={c.green} />)}
                </View>
              </View>
            ))}
          </View>
        </Rise>

        <Rise index={1} style={[styles.chestCard, { backgroundColor: c.primary }]}>
          <Chest
            state={opened ? "open" : ready ? "ready" : "locked"}
            label={t("quests.chestLabel")}
            onOpen={() => {
              setJustOpened(true);
              markOpened();
            }}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.eyebrow, { color: c.saffronLight }]}>{t("home.chest")}</Text>
            {opened ? (
              <Animated.View entering={justOpened ? ZoomIn.springify().damping(12) : undefined} style={{ gap: 4 }}>
                <Text style={[type.small, { color: c.onPrimary, opacity: 0.8 }]}>{t("quests.chestOpen")}</Text>
                <Text style={[type.title, { color: c.saffronLight, fontSize: 26 }]}>+{day.points}</Text>
                <Text style={[type.small, { color: c.onPrimary, opacity: 0.8 }]}>
                  {t("quests.chestHaul", { n: day.logs.length, points: day.points, kg: Math.round(day.co2Kg * 10) / 10 })}
                </Text>
              </Animated.View>
            ) : (
              <>
                <Text style={[type.title, { color: c.onPrimary, fontSize: 22 }]}>{ready ? t("home.chestReady") : t("home.chestLocked", { done: day.logs.length, goal: CHEST_GOAL })}</Text>
                <Text style={[type.small, { color: c.onPrimary, opacity: 0.75 }]}>
                  {ready ? t("quests.chestReady") : t("quests.chestLocked", { n: CHEST_GOAL - day.logs.length })}
                </Text>
              </>
            )}
          </View>
        </Rise>

            </>
          }
          right={
            <>
        <Rise index={2} style={styles.sectionHead}>
          <Text style={[type.heading, { color: c.text, fontSize: 19 }]}>{t("quests.week")}</Text>
          <Text style={[type.small, { color: c.muted }]}>{t("quests.resets")}</Text>
        </Rise>
        {quests.map((q, i) => (
          <Rise key={q.code} index={3 + i} style={[styles.quest, { backgroundColor: c.surface }]}>
            <View style={[styles.questIcon, { backgroundColor: tones[i % 4] }]}>
              <Ionicons name={QUEST_ICON[q.code]} size={22} color={inks[i % 4]} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.row}>
                <Text style={[type.small, { color: c.text, fontFamily: fonts.bodyBold, flex: 1 }]}>{t(`quests.${q.code}` as MessageKey)}</Text>
                <Text style={[type.small, { color: c.muted }]}>
                  {q.have}/{q.need}
                </Text>
              </View>
              <Bar value={q.have / q.need} color={inks[i % 4]} height={7} delay={300 + i * 100} />
            </View>
            {q.done && (
              <Animated.View entering={ZoomIn.delay(500 + i * 100)} style={[styles.doneTag, { backgroundColor: c.greenSoft }]}>
                <Ionicons name="checkmark" size={14} color={c.greenDeep} />
                <Text style={[styles.doneText, { color: c.greenDeep }]}>{t("quests.done")}</Text>
              </Animated.View>
            )}
          </Rise>
        ))}

        {prizeList && (
          <Rise index={8} style={{ marginTop: space.sm }}>
            <PrizeShelf list={prizeList} />
          </Rise>
        )}
            </>
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, gap: space.md },
  pointsChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 34, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  card: { borderRadius: 22, padding: space.lg, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  week: { flexDirection: "row", justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 4 },
  dayBox: { width: 38, height: 38, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  chestCard: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: 24, padding: space.md, paddingRight: space.lg, overflow: "hidden" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: space.sm },
  quest: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 18 },
  questIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  doneTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  doneText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
