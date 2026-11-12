// Home: how am I doing (LiFE Score, homes like yours, level), today's chest and Green Hours, and
// the Action Engine's three moves for today with one tap to log. Numbers count up, sections rise in.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { themeLook } from "@/components/action-look";
import { BrandLogo } from "@/components/brand";
import { ChestIcon } from "@/components/chest";
import { GreenHoursBar } from "@/components/green-hours";
import { Columns, usePageWidth, useWide } from "@/components/layout";
import { Celebration } from "@/components/celebration";
import { Bar, CoinIcon, Flame, Rise, useCountUp, Wiggle } from "@/components/motion";
import { NidhiTree } from "@/components/nidhi-tree";
import { PeakEventCard } from "@/components/peak-event";
import { SCORE_COLORS, ScoreRing } from "@/components/score-ring";
import { Body, ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type ActionLog, type EngineCard, type Reading } from "@/lib/api";
import { summarise, type ProgressSummary } from "@/lib/progress";
import { useChestOpened } from "@/lib/chest";
import { CHEST_GOAL, STAGE_KEYS, stageProgress, today } from "@/lib/game";
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
  const readings = useQuery({ queryKey: ["readings"], queryFn: api.readings });
  const household = useQuery({ queryKey: ["household"], queryFn: api.household });
  const notes = useQuery({ queryKey: ["notifications"], queryFn: api.notifications, refetchInterval: 5 * 60_000 });
  const all = [score, engine, dashboard, ledger, ledgerAll, green, campaigns, coach, mine, readings, household, notes];
  const refreshing = all.some((q) => q.isRefetching);

  const day = today(mine.data ?? []);
  const [chestOpened] = useChestOpened(day.day);
  const doneToday = day.logs.length;
  const peak = campaigns.data?.find((x) => x.kind === "peak" && x.status === "active");
  const level = dashboard.data?.level;
  const stage = stageProgress(level?.points ?? 0);
  const page = usePageWidth();
  const wide = useWide();
  const loggedToday = new Map(day.logs.map((l) => [l.action.code, l.status]));
  const streak = dashboard.data?.streak_days ?? 0;
  const points = Math.round(useCountUp(level?.points ?? 0, 1200));
  const reportedRs = Math.round(useCountUp(ledger.data?.by_status.self_reported.rs ?? 0, 1200));
  const verifiedKg = ledgerAll.data?.by_status.verified.co2_kg ?? 0;
  const s = score.data;
  const firstName = user?.name.split(" ")[0] ?? "";
  const date = new Date().toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { weekday: "long", day: "numeric", month: "long" });

  const logger = useLogAction();
  const top = (engine.data?.cards ?? []).filter((card) => card.top);

  // On a desktop the tree sits under Green Hours, filling the shorter column.
  const treeCard = (
    <Rise index={9} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
          <Text style={[type.heading, { color: c.text }]}>{t("home.tree")}</Text>
          <View style={styles.treeRow}>
            <NidhiTree verifiedKg={verifiedKg} />
            <View style={{ flex: 1 }}>
              <Body muted>{verifiedKg > 0 ? t("home.treeGrows", { kg: Math.round(verifiedKg * 10) / 10 }) : t("home.treeSeed")}</Body>
            </View>
          </View>
        </Rise>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={[styles.page, page, { paddingTop: insets.top + space.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => all.forEach((q) => q.refetch())} />}
      >
        <Rise index={0} style={styles.header}>
          {!wide && <BrandLogo size={40} />}
          <Text style={[type.small, { color: c.muted, flex: 1 }]} numberOfLines={1}>
            {date}
          </Text>
          <Pressable onPress={() => router.push("/quests")} accessibilityRole="link" accessibilityLabel={t("quests.streak", { n: streak })} style={[styles.chip, { backgroundColor: c.saffronSoft }]}>
              <Flame size={14} />
              <Text style={[styles.chipText, { color: c.saffronInk }]}>{streak}</Text>
            </Pressable>
          <Pressable onPress={() => router.push("/quests")} accessibilityRole="link" accessibilityLabel={t("home.points", { n: level?.points ?? 0 })} style={[styles.chip, { backgroundColor: c.greenSoft }]}>
              <CoinIcon />
              <Text style={[styles.chipText, { color: c.greenDeep }]}>{points.toLocaleString("en-IN")}</Text>
            </Pressable>
          <Pressable
            onPress={() => router.push("/alerts")}
            accessibilityRole="button"
            accessibilityLabel={t("alerts.a11y", { n: notes.data?.unread ?? 0 })}
            style={[styles.bell, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="notifications-outline" size={19} color={c.text} />
            {(notes.data?.unread ?? 0) > 0 && (
              <View style={[styles.bellCount, { backgroundColor: c.clay, borderColor: c.background }]}>
                <Text style={styles.bellCountText}>{Math.min(9, notes.data?.unread ?? 0)}</Text>
              </View>
            )}
          </Pressable>
        </Rise>
        {/* The greeting gets its own line so a long name never squeezes the chips. */}
        <Rise index={0}>
          <Text style={[type.title, { color: c.text, fontSize: 26, lineHeight: 32, marginTop: -4 }]} numberOfLines={2}>
            {t("home.hello", { name: firstName })}
          </Text>
        </Rise>

        <Columns
          left={
            <>
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
                  <Text style={[type.small, { color: c.text, fontFamily: fonts.bodyBold }]}>{t("stage.level", { n: stage.index + 1, stage: t(STAGE_KEYS[stage.index]) })}</Text>
                  <View style={{ flex: 1 }}>
                    <Bar value={stage.share} striped />
                  </View>
                  <Text style={[type.small, { color: c.muted }]}>
                    {stage.index < STAGE_KEYS.length - 1 ? t("stage.toNextShort", { n: stage.toNext, stage: t(STAGE_KEYS[stage.index + 1]) }) : t("stage.top")}
                  </Text>
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
          <ProgressCard summary={summarise(readings.data ?? [], household.data?.household.monthly_kwh)} readings={readings.data ?? []} onPress={() => router.push("/progress")} />
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

        {wide && treeCard}
            </>
          }
          right={
            <>
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
            <MoveRow card={card} busy={logger.busy} logged={loggedToday.get(card.code)} onDone={() => logger.logNow({ code: card.code, title: card.title, fullPoints: card.points })} />
          </Rise>
        ))}

        {coach.data && (
          <Rise index={8} style={[styles.card, { backgroundColor: c.greenSoft }]}>
            <Text style={[type.heading, { color: c.text }]}>{t("home.week")}</Text>
            <Body>{coach.data.text}</Body>
            {coach.data.written_by_ai && <Text style={[type.small, { color: c.muted }]}>{t("home.byAi")}</Text>}
          </Rise>
        )}

        {!wide && treeCard}
            </>
          }
        />
      </ScrollView>
      <Celebration info={logger.celebration} onClose={logger.closeCelebration}/>
    </View>
  );
}

/** My progress on Home: this month against the start, with the last six months as small bars. */
function ProgressCard({ summary, readings, onPress }: { summary: ProgressSummary; readings: Reading[]; onPress: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  const recent = [...readings].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const top = Math.max(1, ...recent.map((r) => r.kwh));
  const pct = summary.changePct;
  const better = pct !== null && pct <= 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.progress, shadow, { backgroundColor: c.surface, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={[styles.moveIcon, { backgroundColor: better ? c.greenSoft : c.saffronSoft }]}>
        <Ionicons name={better ? "trending-down" : "stats-chart-outline"} size={22} color={better ? c.greenDeep : c.saffronInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: c.text, fontFamily: fonts.bodyBold, fontSize: 15 }]}>{t("progress.card")}</Text>
        <Text style={[type.small, { color: pct === null || !summary.hasTrend ? c.muted : better ? c.greenDeep : c.clay }]}>
          {pct === null || !summary.hasTrend
            ? t("progress.cardNone")
            : Math.abs(pct) < 0.5
              ? t("progress.cardSame")
              : t("progress.cardChange", { pct: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}` })}
        </Text>
      </View>
      {recent.length > 1 && (
        <View style={styles.spark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {recent.map((r) => (
            <View key={r.month} style={[styles.sparkBar, { height: 6 + (r.kwh / top) * 26, backgroundColor: summary.latest?.month === r.month ? c.green : c.track }]} />
          ))}
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
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

function MoveRow({ card, busy, logged, onDone }: { card: EngineCard; busy: boolean; logged?: ActionLog["status"]; onDone: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  const look = themeLook(card.theme, c);
  const facts = [card.rs >= 1 ? `₹${Math.round(card.rs)}` : null, card.impact_estimated && card.co2_kg > 0 ? `${Math.round(card.co2_kg * 10) / 10} kg CO₂` : null].filter(Boolean).join(" · ");
  const done = !!logged && logged !== "rejected";
  return (
    <View style={[styles.move, { backgroundColor: done ? c.greenSoft : c.surface }]}>
      <View style={[styles.moveIcon, { backgroundColor: done ? c.green : look.tint }]}>
        <Ionicons name={done ? "checkmark" : look.icon} size={22} color={done ? c.onPrimary : look.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: done ? c.muted : c.text, fontFamily: fonts.bodyBold, fontSize: 15, textDecorationLine: done ? "line-through" : "none" }]}>{card.title}</Text>
        <Text style={[type.small, { color: c.muted }]}>{done ? (logged === "pending" ? t("home.loggedReview") : t("home.loggedDone")) : (card.reasons[0] ?? facts)}</Text>
      </View>
      {done ? (
        <Text style={[styles.doneText, { color: c.greenDeep }]}>{`+${Math.round(card.points * 0.4 * (card.is_challenge ? 2 : 1))}`}</Text>
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, minHeight: 36, borderRadius: radius.pill },
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
  bell: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bellCount: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  bellCountText: { color: "#FFFFFF", fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12 },
  progress: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 20 },
  spark: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 34 },
  sparkBar: { width: 6, borderRadius: 3 },
  treeRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
});
