// Me, as the design draws it: who you are (initials, points, streak), your journey from Seed to Grove,
// the Impact Ledger's four columns (plan, reported, in review, verified, never added together),
// badges, prizes, and links to the solar check and to language, data and account.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BadgeList } from "@/components/badges";
import { Journey, LedgerColumns } from "@/components/journey";
import { Columns, usePageWidth } from "@/components/layout";
import { Rise } from "@/components/motion";
import { PrizeShelf } from "@/components/prizes";
import { ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import { prizes } from "@/lib/prizes";
import { useSession } from "@/lib/session";
import { fonts, shadow, space, type, useColors } from "@/theme";

export default function Me() {
  const { t, locale } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePageWidth();
  const { user } = useSession();
  const [period, setPeriod] = useState<"month" | "all">("month");
  const ledger = useQuery({ queryKey: ["ledger", period], queryFn: () => api.ledger(period) });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const badges = useQuery({ queryKey: ["badges"], queryFn: api.badges });
  const mine = useQuery({ queryKey: ["actions", "mine"], queryFn: () => api.myActions() });
  const level = dashboard.data?.level;
  const streak = dashboard.data?.streak_days ?? 0;
  const all = [ledger, dashboard, badges, mine];
  const month = new Date().toLocaleDateString(locale === "en" ? "en-IN" : `${locale}-IN`, { month: "long" });
  const prizeList =
    dashboard.data && badges.data && mine.data
      ? prizes({ points: dashboard.data.level.points, streakDays: streak, logs: mine.data, badges: badges.data })
      : null;
  const earned = badges.data?.filter((b) => b.earned).length ?? 0;

  const left = (
    <>
      <Rise index={0} style={styles.who}>
        <View style={[styles.avatar, { backgroundColor: c.greenSoft }]}>
          <Text style={[styles.avatarText, { color: c.greenDeep }]}>{initials(user?.name ?? "")}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={[type.small, { color: c.muted }]}>
            {t("me.whoLine", { points: (level?.points ?? 0).toLocaleString("en-IN"), n: streak })}
          </Text>
        </View>
      </Rise>

      <Rise index={1} style={[styles.panel, shadow, { backgroundColor: c.surface }]}>
        <Journey points={level?.points ?? 0} />
      </Rise>

      <Rise index={2} style={[styles.panel, shadow, { backgroundColor: c.surface }]}>
        <View style={styles.head}>
          <Text style={[type.heading, { color: c.text }]}>{t("me.ledger")}</Text>
          <View style={styles.toggle}>
            {(["month", "all"] as const).map((p) => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityState={{ selected: period === p }}
                onPress={() => setPeriod(p)}
                style={[styles.toggleBtn, { backgroundColor: period === p ? c.primary : "transparent" }]}
              >
                <Text style={[styles.toggleText, { color: period === p ? c.onPrimary : c.muted }]}>{p === "month" ? month : t("me.all")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={[type.small, { color: c.muted }]}>{t("me.ledgerShort")}</Text>
        {ledger.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
        {ledger.data && <LedgerColumns ledger={ledger.data} />}
        {ledger.data && (
          <Text style={[type.small, { color: c.muted }]}>
            {t("me.ledgerRs", { rs: Math.round(ledger.data.by_status.self_reported.rs + ledger.data.by_status.verified.rs).toLocaleString("en-IN") })}
          </Text>
        )}
      </Rise>
    </>
  );

  const right = (
    <>
      {badges.data && (
        <Rise index={3} style={{ gap: space.sm }}>
          <View style={styles.head}>
            <Text style={[styles.section, { color: c.text }]}>{t("act.badges")}</Text>
            <Text style={[styles.count, { color: c.muted }]}>{t("me.badgeCount", { n: earned, total: badges.data.length })}</Text>
          </View>
          <BadgeList badges={badges.data} />
        </Rise>
      )}

      {prizeList && (
        <Rise index={4}>
          <PrizeShelf list={prizeList} />
        </Rise>
      )}

      <Rise index={5} style={[styles.links, shadow, { backgroundColor: c.surface }]}>
        <Pressable accessibilityRole="link" onPress={() => router.push("/solar")} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="sunny-outline" size={20} color={c.green} />
          <Text style={[styles.linkText, { color: c.text }]}>{t("me.solarLink")}</Text>
          <Text style={[styles.linkAside, { color: c.greenDeep }]}>{t("me.check")}</Text>
        </Pressable>
        <View style={[styles.rule, { backgroundColor: c.border }]} />
        <Pressable accessibilityRole="link" onPress={() => router.push("/account")} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="download-outline" size={20} color={c.saffronInk} />
          <Text style={[styles.linkText, { color: c.text }]}>{t("me.account")}</Text>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>
      </Rise>
    </>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[styles.page, page, { paddingTop: insets.top + space.lg }]}
      refreshControl={<RefreshControl refreshing={all.some((q) => q.isRefetching)} onRefresh={() => all.forEach((q) => void q.refetch())} />}
    >
      <Columns left={left} right={right} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  who: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontSize: 20 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  panel: { borderRadius: 22, padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  section: { fontFamily: fonts.display, fontSize: 19 },
  count: { fontFamily: fonts.bodyBold, fontSize: 12 },
  toggle: { flexDirection: "row", gap: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, minHeight: 30, justifyContent: "center" },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  links: { borderRadius: 20, paddingHorizontal: space.lg },
  link: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 },
  linkText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15 },
  linkAside: { fontFamily: fonts.bodyBold, fontSize: 13 },
  rule: { height: 1 },
});
