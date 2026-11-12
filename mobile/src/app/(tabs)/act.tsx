// Act: today's moves as a deck of cards (log it, skip it, or add a photo for full points), then every
// action the engine ranks for this home by Mission LiFE theme, and the daily challenge at 2x. Logging
// now earns 40% of the points; a photo GEDA verifies earns all of them. Offline logs wait on the phone.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, ZoomIn } from "react-native-reanimated";

import { usePageWidth } from "@/components/layout";
import { themeLook } from "@/components/action-look";
import { ChestIcon } from "@/components/chest";
import { Celebration } from "@/components/celebration";
import { Rise, Sparks, tap } from "@/components/motion";
import { Body, Choice, ErrorText, Hero } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, type EngineCard } from "@/lib/api";
import { useLogAction } from "@/lib/log-action";
import { fonts, radius, shadow, space, type, useColors } from "@/theme";

const THEMES = ["energy", "water", "plastic", "food", "waste", "ewaste", "health"] as const;
const SELF_REPORT_SHARE = 0.4; // backend services/gamification.py
const now = (card: EngineCard) => Math.round(card.points * SELF_REPORT_SHARE * (card.is_challenge ? 2 : 1));
const full = (card: EngineCard) => card.points * (card.is_challenge ? 2 : 1);

export default function Act() {
  const { t } = useI18n();
  const c = useColors();
  const page = usePageWidth(true);
  const engine = useQuery({ queryKey: ["engine"], queryFn: api.engineToday });
  const challenge = useQuery({ queryKey: ["challenge"], queryFn: api.dailyChallenge });
  const logger = useLogAction();
  const [theme, setTheme] = useState<"all" | (typeof THEMES)[number]>("all");

  // The deck is fixed when it's dealt, so cards don't jump when the engine re-ranks after a log.
  const [deck, setDeck] = useState<EngineCard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!deck && engine.data) setDeck(engine.data.cards.filter((card) => card.top).slice(0, 3));
  }, [deck, engine.data]);

  const inARow = results.length - (results.lastIndexOf(false) + 1);
  function advance(done: boolean) {
    if (!deck || pos >= deck.length) return;
    const card = deck[pos];
    if (done) {
      tap("success");
      setBurst((b) => b + 1);
      logger.logNow({ code: card.code, title: card.title, fullPoints: full(card) });
    } else {
      tap();
    }
    setResults((r) => [...r, done]);
    setPos((p) => p + 1);
  }
  function redeal() {
    setDeck(null);
    setPos(0);
    setResults([]);
  }

  const cards = (engine.data?.cards ?? []).filter((card) => theme === "all" || card.theme === theme);
  const ch = challenge.data;
  const finished = !!deck && pos >= deck.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={engine.isRefetching} onRefresh={() => void engine.refetch()} />}
      >
        <Hero single title={t("actions.title")} subtitle={t("act.heroSub")} />
        <View style={[styles.page, page]}>
          <View style={styles.progressRow}>
            <View style={styles.pips}>
              {(deck ?? []).map((card, i) => (
                <View key={card.code} style={[styles.pip, { backgroundColor: i < results.length ? (results[i] ? c.green : c.border) : c.track }]} />
              ))}
            </View>
            {inARow >= 2 && (
              <Animated.View key={inARow} entering={ZoomIn.springify().damping(10)} style={[styles.combo, { backgroundColor: c.primary }]}>
                <Text style={[styles.comboText, { color: c.saffronLight }]}>{t("act.inARow", { n: inARow })}</Text>
              </Animated.View>
            )}
          </View>

          <View style={styles.deckBox}>
            {deck?.map((card, i) => <DeckCard key={card.code} card={card} depth={i - pos} out={i < pos ? (results[i] ? 1 : -1) : 0} />)}
            {finished && (
              <Animated.View entering={ZoomIn.delay(250).springify().damping(13)} style={[styles.finished, { borderColor: c.border }]}>
                <ChestIcon size={72} />
                <Text style={[type.title, { color: c.text, fontSize: 22, textAlign: "center" }]}>{t("act.allDone")}</Text>
                <Link href="/quests" style={[styles.linkBtn, { backgroundColor: c.primary, color: c.onPrimary }]}>
                  {t("act.openChest")}
                </Link>
                <Pressable accessibilityRole="button" onPress={redeal} style={styles.again}>
                  <Text style={[type.small, { color: c.muted, fontWeight: "600" }]}>{t("act.again")}</Text>
                </Pressable>
              </Animated.View>
            )}
            {engine.data && deck?.length === 0 && <Body muted>{t("act.empty")}</Body>}
            <Sparks burstKey={burst} />
          </View>

          {!finished && deck && deck.length > 0 && (
            <View style={styles.controls}>
              <Pressable accessibilityRole="button" accessibilityLabel={t("act.skip")} onPress={() => advance(false)} style={({ pressed }) => [styles.round, { borderColor: c.border, backgroundColor: c.surface, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
                <Ionicons name="close" size={26} color={c.muted} />
              </Pressable>
              <Pressable accessibilityRole="button" disabled={logger.busy} onPress={() => advance(true)} style={({ pressed }) => [styles.did, shadow, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
                <Ionicons name="checkmark" size={22} color={c.onPrimary} />
                <Text style={[styles.didText, { color: c.onPrimary }]}>{t("act.did")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("act.photo")}
                disabled={logger.busy}
                onPress={() => {
                  const card = deck[pos];
                  void logger.withPhoto({ code: card.code, title: card.title, fullPoints: full(card) });
                }}
                style={({ pressed }) => [styles.round, { backgroundColor: c.saffronSoft, borderColor: c.saffronSoft, transform: [{ scale: pressed ? 0.9 : 1 }] }]}
              >
                <Ionicons name="camera-outline" size={24} color={c.saffronInk} />
              </Pressable>
            </View>
          )}
          <Text style={[type.small, { color: c.muted, textAlign: "center" }]}>{t("act.proofRule", { now: deck?.[pos] ? now(deck[pos]) : 0, full: deck?.[pos] ? full(deck[pos]) : 0 })}</Text>
          {logger.error && <ErrorText>{logger.error}</ErrorText>}

          {ch && (
            <Rise index={0} style={[styles.challenge, { backgroundColor: c.saffronSoft }]}>
              <Text style={[type.eyebrow, { color: c.saffronInk }]}>{t("act.challenge")}</Text>
              <Text style={[type.heading, { color: c.text }]}>{ch.action.title}</Text>
              {ch.completed ? (
                <Body>{t("act.challengeDone")}</Body>
              ) : (
                <LogButtons
                  busy={logger.busy}
                  onNow={() => logger.logNow({ code: ch.action.code, title: ch.action.title, fullPoints: ch.action.points * 2 })}
                  onPhoto={() => logger.withPhoto({ code: ch.action.code, title: ch.action.title, fullPoints: ch.action.points * 2 })}
                />
              )}
            </Rise>
          )}

          <Text style={[type.heading, { color: c.text, fontSize: 19, marginTop: space.sm }]}>{t("act.every")}</Text>
          <Choice
            label=""
            value={theme}
            onChange={setTheme}
            options={[{ value: "all" as const, label: t("actions.all") }, ...THEMES.map((th) => ({ value: th, label: t(`theme.${th}` as MessageKey) }))]}
          />
          {engine.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
          {engine.data && cards.length === 0 && <Body muted>{t("act.empty")}</Body>}
          {cards.map((card, i) => {
            const look = themeLook(card.theme, c);
            return (
              <Rise key={card.code} index={Math.min(i, 6)} style={[styles.item, { backgroundColor: c.surface }]}>
                <View style={styles.itemHead}>
                  <View style={[styles.itemIcon, { backgroundColor: look.tint }]}>
                    <Ionicons name={look.icon} size={22} color={look.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.small, { color: look.ink }]}>{t(`theme.${card.theme}` as MessageKey)}</Text>
                    <Text style={[type.heading, { color: c.text, fontSize: 16 }]}>{card.title}</Text>
                  </View>
                  <Text style={[styles.pts, { color: look.ink }]}>{full(card)}</Text>
                </View>
                {card.reasons.slice(0, 2).map((r) => (
                  <Text key={r} style={[type.small, { color: c.muted }]}>
                    {r}
                  </Text>
                ))}
                <View style={styles.facts}>
                  {card.rs >= 1 && <Fact text={`₹${Math.round(card.rs)}`} />}
                  {card.impact_estimated && card.co2_kg > 0 && <Fact text={`${Math.round(card.co2_kg * 100) / 100} kg CO₂`} />}
                  <Fact text={t("actions.perDay", { n: card.max_per_day })} />
                </View>
                <LogButtons
                  busy={logger.busy}
                  onNow={() => logger.logNow({ code: card.code, title: card.title, fullPoints: full(card) })}
                  onPhoto={() => logger.withPhoto({ code: card.code, title: card.title, fullPoints: full(card) })}
                />
              </Rise>
            );
          })}
        </View>
      </ScrollView>
      <Celebration info={logger.celebration} onClose={logger.closeCelebration}/>
    </View>
  );
}

/** One card in the deck: `depth` 0 is on top; a played card (`out` ±1) flies off right or left. */
function DeckCard({ card, depth, out }: { card: EngineCard; depth: number; out: number }) {
  const { t } = useI18n();
  const c = useColors();
  const reduced = useReducedMotion();
  const look = themeLook(card.theme, c);
  const x = useSharedValue(0);
  const y = useSharedValue(depth * 20);
  const rot = useSharedValue(depth * 2.5);
  const scale = useSharedValue(1 - depth * 0.05);
  const opacity = useSharedValue(depth > 2 ? 0 : 1 - depth * 0.15);

  useEffect(() => {
    const spring = (v: number) => (reduced ? v : withSpring(v, { damping: 14, stiffness: 140 }));
    if (out !== 0) {
      x.value = reduced ? out * 420 : withTiming(out * 420, { duration: 380 });
      rot.value = reduced ? out * 18 : withTiming(out * 18, { duration: 380 });
      opacity.value = withTiming(0, { duration: reduced ? 0 : 380 });
      return;
    }
    y.value = spring(depth * 20);
    rot.value = spring(depth === 0 ? -1.5 : depth * 2.5);
    scale.value = spring(1 - depth * 0.05);
    opacity.value = spring(depth > 2 ? 0 : 1 - depth * 0.15);
  }, [depth, out, reduced, x, y, rot, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ perspective: 900 }, { translateX: x.value }, { translateY: y.value }, { rotateX: `${Math.max(0, depth) * 3}deg` }, { rotate: `${rot.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View pointerEvents={depth === 0 ? "auto" : "none"} style={[styles.deckCard, { zIndex: 10 - Math.max(depth, -1), backgroundColor: look.tint }, shadow, style]}>
      <View style={styles.cardTop}>
        <Text style={[styles.cardTheme, { color: look.ink, backgroundColor: c.surface }]}>{t(`theme.${card.theme}` as MessageKey)}</Text>
        <Text style={[styles.cardPts, { color: look.ink }]}>{full(card)}</Text>
      </View>
      <View style={styles.cardArt}>
        <View style={[styles.cardIcon, { backgroundColor: c.surface }]}>
          <Ionicons name={look.icon} size={54} color={look.ink} />
        </View>
      </View>
      <Text style={[type.title, { color: c.text, fontSize: 24 }]}>{card.title}</Text>
      {card.reasons.slice(0, 2).map((r) => (
        <Text key={r} style={[type.small, { color: c.muted }]} numberOfLines={2}>
          {r}
        </Text>
      ))}
      <View style={styles.facts}>
        {card.rs >= 1 && <Fact text={`₹${Math.round(card.rs)}`} />}
        {card.impact_estimated && card.co2_kg > 0 && <Fact text={`${Math.round(card.co2_kg * 10) / 10} kg CO₂`} />}
      </View>
    </Animated.View>
  );
}

function LogButtons({ busy, onNow, onPhoto }: { busy: boolean; onNow: () => void; onPhoto: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  return (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onNow} style={({ pressed }) => [styles.btn, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
        <Text style={[type.small, { color: c.onPrimary, fontWeight: "700" }]}>{t("act.logNow")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onPhoto} style={({ pressed }) => [styles.btn, styles.photoBtn, { borderColor: c.border, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
        <Ionicons name="camera-outline" size={16} color={c.text} />
        <Text style={[type.small, { color: c.text, fontWeight: "700" }]}>{t("act.logPhoto")}</Text>
      </Pressable>
    </View>
  );
}

function Fact({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: c.surface }]}>
      <Text style={[type.small, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, gap: space.md },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 30 },
  pips: { flex: 1, flexDirection: "row", gap: 5 },
  pip: { flex: 1, height: 6, borderRadius: 6 },
  combo: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  comboText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  deckBox: { height: 430, marginTop: space.sm, alignItems: "center", justifyContent: "center" },
  deckCard: { position: "absolute", top: 0, left: 8, right: 8, height: 400, borderRadius: 30, padding: space.xl - 2, gap: space.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTheme: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, overflow: "hidden" },
  cardPts: { fontFamily: fonts.display, fontSize: 24 },
  cardArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardIcon: { width: 112, height: 112, borderRadius: 36, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  finished: { position: "absolute", top: 10, left: 16, right: 16, bottom: 20, borderWidth: 2, borderStyle: "dashed", borderRadius: 30, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
  linkBtn: { fontFamily: fonts.bodyBold, fontSize: 15, paddingHorizontal: 20, paddingVertical: 14, borderRadius: radius.md, overflow: "hidden" },
  again: { minHeight: 44, justifyContent: "center" },
  controls: { flexDirection: "row", gap: space.md, justifyContent: "center", alignItems: "center" },
  round: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  did: { flex: 1, maxWidth: 220, height: 62, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  didText: { fontFamily: fonts.bodyBold, fontSize: 17 },
  challenge: { borderRadius: 22, padding: space.lg, gap: space.sm, marginTop: space.md },
  item: { borderRadius: 20, padding: space.lg, gap: space.sm },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  itemIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pts: { fontFamily: fonts.display, fontSize: 18 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  fact: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  buttons: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  btn: { borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 44, justifyContent: "center" },
  photoBtn: { borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
});
