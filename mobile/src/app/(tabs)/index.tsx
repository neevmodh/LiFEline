// Home: how am I doing (LiFE Score, homes like yours, level), today's chest and Green Hours, and
// the Action Engine's three moves for today with one tap to log. Numbers count up, sections rise in.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { themeLook } from "@/components/action-look";
import { ChestIcon } from "@/components/chest";
import { GreenHoursBar } from "@/components/green-hours";
import { Bar, Celebration, CoinIcon, Flame, Rise, useCountUp, Wiggle } from "@/components/motion";
import { NidhiTree } from "@/components/nidhi-tree";
import { PeakEventCard } from "@/components/peak-event";
import { SCORE_COLORS, ScoreRing } from "@/components/score-ring";
import { Body, ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type EngineCard } from "@/lib/api";
import { useChestOpened } from "@/lib/chest";
import { CHEST_GOAL, today } from "@/lib/game";
import { useLogAction } from "@/lib/log-action";
import { useSession } from "@/lib/session";
import { fonts, radius, shadow, space, type, useColors } from "@/theme";

export default function Home() {
  const { t, locale } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const score = useQuery({ queryKey: ["score"], queryFn: api.score });
  const engine = useQuery({ queryKey: ["engine"], queryFn: api.engineToday });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const ledger = useQuery({ queryKey: ["ledger", "month"], queryFn: () => api.ledger("month") });
  const ledgerAll = useQuery({ queryKey: ["ledger", "all"], queryFn: () => api.ledger("all") });
  const green = useQuery({ queryKey: ["green-hours"], queryFn: api.greenHours });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: api.campaigns });
  const coach = useQuery({ queryKey: ["coach"], queryFn: api.coachWeekly });
  const mine = useQuery({ queryKey: ["actions", "mine"], queryFn: () => api.myActions() });
  const all = [score, engine, dashboard, ledger, ledgerAll, green, campaigns, coach, mine];
  const refreshing = all.some((q) => q.isRefetching);

  const day = today(mine.data ?? []);
  const [chestOpened] = useChestOpened(day.day);
  const doneToday = day.logs.length;
  const peak = campaigns.data?.find((x) => x.kind === "peak" && x.status === "active");
  const level = dashboard.data?.level;
  const streak = dashboard.data?.streak_days ?? 0;
  const points = Math.round(useCountUp(level?.points ?? 0, 1200));
  const reportedRs = Math.round(useCountUp(ledger.data?.by_status.self_reported.rs ?? 0, 1200));
  const verifiedKg = ledgerAll.data?.by_status.verified.co2_kg ?? 0;
  const s = score.data;
  const firstName = user?.name.split(" ")[0] ?? "";
  const date = new Date().toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { weekday: "long", day: "numeric", month: "long" });

  const logger = useLogAction();
  const top = (engine.data?.cards ?? []).filter((card) => card.top);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => all.forEach((q) => q.refetch())} />}
      >
        <Rise index={0} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[type.small, { color: c.muted }]}>{date}</Text>
            <Text style={[type.title, { color: c.text, fontSize: 26 }]} numberOfLines={1}>
              {t("home.hello", { name: firstName })}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/quests")} accessibilityRole="link" accessibilityLabel={t("quests.streak", { n: streak })} style={[styles.chip, { backgroundColor: c.saffronSoft }]}>
              <Flame size={14} />
              <Text style={[styles.chipText, { color: c.saffronInk }]}>{streak}</Text>
            </Pressable>
          <Pressable onPress={() => router.push("/quests")} accessibilityRole="link" accessibilityLabel={t("home.points", { n: level?.points ?? 0 })} style={[styles.chip, { backgroundColor: c.greenSoft }]}>
              <CoinIcon />
              <Text style={[styles.chipText, { color: c.greenDeep }]}>{points.toLocaleString("en-IN")}</Text>
            </Pressable>
        </Rise>

        <Rise index={1} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
          {s ? (
            <>
              <View style={styles.scoreRow}>
                <ScoreRing score={s.score} label={t("home.score")} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[type.small, { color: c.text }]}>{s.comparison.summary}</Text>
                  <Text style={[styles.rs, { color: c.greenDeep }]}>{t("home.reportedRs", { rs: reportedRs.toLocaleString("en-IN") })}</Text>
                  <View style={styles.parts}>
                    <Part color={SCORE_COLORS.efficiency} value={`${Math.round(s.efficiency)}/50`} label={t("home.part.efficiency")} />
                    <Part color={SCORE_COLORS.consistency} value={`${Math.round(s.consistency)}/30`} label={t("home.part.consistency")} />
                    <Part color={SCORE_COLORS.verified} value={`${Math.round(s.verified)}/20`} label={t("home.part.verified")} />
                  </View>
                </View>
              </View>
              {level && (
                <View style={styles.levelRow}>
                  <Text style={[type.small, { color: c.text, fontWeight: "600" }]}>{t("act.level", { level: level.level, title: level.title })}</Text>
                  <View style={{ flex: 1 }}>
                    <Bar value={level.next_level_at > 0 ? level.points / level.next_level_at : 1} />
                  </View>
                </View>
              )}
            </>
          ) : score.isError ? (
            <ErrorText>{t("home.loadFailed")}</ErrorText>
          ) : (
            <Body muted>…</Body>
          )}
        </Rise>

        <Rise index={2}>
          <Pressable onPress={() => router.push("/quests")} accessibilityRole="link" style={({ pressed }) => [styles.chestRow, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Wiggle active={doneToday >= CHEST_GOAL && !chestOpened}>
                <ChestIcon />
              </Wiggle>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: c.onPrimary, fontFamily: fonts.bodyBold }]}>{t("home.chest")}</Text>
                <Text style={[type.small, { color: c.onPrimary, opacity: 0.75 }]}>
                  {chestOpened ? t("home.chestOpened") : doneToday >= CHEST_GOAL ? t("home.chestReady") : t("home.chestLocked", { done: doneToday, goal: CHEST_GOAL })}
                </Text>
              </View>
              <View style={styles.dots}>
                {Array.from({ length: CHEST_GOAL }, (_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i < doneToday ? c.saffronLight : c.onPrimary, opacity: i < doneToday ? 1 : 0.25 }]} />
                ))}
              </View>
            </Pressable>
        </Rise>

        {peak && (
          <Rise index={3}>
            <PeakEventCard event={peak} />
          </Rise>
        )}

        {green.data && (
          <Rise index={3}>
            <GreenHoursBar data={green.data} title={t("home.green")} solarLabel={t("home.solar")} peakLabel={t("home.peak")} />
          </Rise>
        )}

        <Rise index={4} style={styles.sectionHead}>
          <Text style={[type.heading, { color: c.text, fontSize: 19 }]}>{t("home.today")}</Text>
          <Link href="/act" style={[type.small, { color: c.greenDeep, fontWeight: "700" }]}>
            {t("home.play")}
          </Link>
        </Rise>
        {engine.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
        {logger.error && <ErrorText>{logger.error}</ErrorText>}
        {top.map((card, i) => (
          <Rise key={card.code} index={5 + i}>
            <MoveRow card={card} busy={logger.busy} onDone={() => logger.logNow({ code: card.code, title: card.title, fullPoints: card.points })} />
          </Rise>
        ))}

        {coach.data && (
          <Rise index={8} style={[styles.card, { backgroundColor: c.greenSoft }]}>
            <Text style={[type.heading, { color: c.text }]}>{t("home.week")}</Text>
            <Body>{coach.data.text}</Body>
            {coach.data.written_by_ai && <Text style={[type.small, { color: c.muted }]}>{t("home.byAi")}</Text>}
          </Rise>
        )}

        <Rise index={9} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
          <Text style={[type.heading, { color: c.text }]}>{t("home.tree")}</Text>
          <View style={styles.treeRow}>
            <NidhiTree verifiedKg={verifiedKg} />
            <View style={{ flex: 1 }}>
              <Body muted>{verifiedKg > 0 ? t("home.treeGrows", { kg: Math.round(verifiedKg * 10) / 10 }) : t("home.treeSeed")}</Body>
            </View>
          </View>
        </Rise>
      </ScrollView>
      <Celebration info={logger.celebration} onClose={logger.closeCelebration} closeLabel={t("celebrate.close")} />
    </View>
  );
}

function Part({ color, value, label }: { color: string; value: string; label: string }) {
  const c = useColors();
  return (
    <View style={styles.part} accessibilityLabel={`${label} ${value}`}>
      <View style={[styles.partDot, { backgroundColor: color }]} />
      <Text style={[styles.partText, { color: c.muted }]}>{value}</Text>
    </View>
  );
}

function MoveRow({ card, busy, onDone }: { card: EngineCard; busy: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  const look = themeLook(card.theme, c);
  const facts = [card.rs >= 1 ? `₹${Math.round(card.rs)}` : null, card.impact_estimated && card.co2_kg > 0 ? `${Math.round(card.co2_kg * 10) / 10} kg CO₂` : null].filter(Boolean).join(" · ");
  return (
    <View style={[styles.move, { backgroundColor: c.surface }]}>
      <View style={[styles.moveIcon, { backgroundColor: look.tint }]}>
        <Ionicons name={look.icon} size={22} color={look.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: c.text, fontFamily: fonts.bodyBold, fontSize: 15 }]}>{card.title}</Text>
        <Text style={[type.small, { color: c.muted }]}>{card.reasons[0] ?? facts}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("home.done")}: ${card.title}`}
        disabled={busy}
        onPress={onDone}
        style={({ pressed }) => [styles.doneBtn, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Ionicons name="checkmark" size={18} color={c.onPrimary} />
        <Text style={[styles.doneText, { color: c.onPrimary }]}>{Math.round(card.points * 0.4 * (card.is_challenge ? 2 : 1))}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md, width: "100%", maxWidth: 560, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, minHeight: 36, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  card: { borderRadius: 24, padding: space.lg, gap: space.md },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  rs: { fontFamily: fonts.display, fontSize: 18 },
  parts: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  part: { flexDirection: "row", alignItems: "center", gap: 4 },
  partDot: { width: 8, height: 8, borderRadius: 4 },
  partText: { fontSize: 11, fontFamily: fonts.bodyBold },
  levelRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chestRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 20 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: space.sm },
  move: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 18 },
  moveIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 12, minHeight: 44, borderRadius: 14 },
  doneText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  treeRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
});
