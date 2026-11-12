// Community: your society, college, school, office or ward (join with a code or start one), its goal,
// announcements, duels with other communities and place in this week's district league; then district
// standings and live campaigns.
// Totals stay hidden until 5 households have joined, as on the web and in the API.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { PeakEventCard } from "@/components/peak-event";
import { Body, Button, Card, Choice, ErrorText, Field, Title, Hero } from "@/components/ui";
import { usePageWidth } from "@/components/layout";
import { useI18n, type MessageKey } from "@/i18n";
import { Bar } from "@/components/motion";
import { Podium } from "@/components/podium";
import { api, ApiError, type CommunityKind, type Duel, type SocietyView } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fonts, radius, space, type, useColors } from "@/theme";

const KINDS: CommunityKind[] = ["society", "college", "school", "office", "ward"];
const MIN_GROUP = 5;

export default function Community() {
  const { t } = useI18n();
  const c = useColors();
  const page = usePageWidth(true);
  const qc = useQueryClient();
  const { user, refresh } = useSession();

  const mine = useQuery({
    queryKey: ["community"],
    // 404 means "not in a community yet", which is a state, not an error.
    queryFn: () => api.myCommunity().catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e))),
  });
  const league = useQuery({ queryKey: ["league", "week"], queryFn: api.weeklyLeague });
  const districts = useQuery({ queryKey: ["districts", "standings"], queryFn: api.districtStandings });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: api.campaigns });
  const duels = useQuery({ queryKey: ["duels"], queryFn: api.myDuels });
  const all = [mine, league, districts, campaigns, duels];
  const committee = mine.data?.role === "committee";
  const [duelError, setDuelError] = useState<string | null>(null);
  const challenge = useMutation({
    mutationFn: api.challenge,
    onSuccess: () => {
      setDuelError(null);
      qc.invalidateQueries({ queryKey: ["duels"] });
    },
    onError: (e) => setDuelError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown")),
  });
  const opponents = new Set(duels.data?.filter((d) => d.status !== "finished").map((d) => d.them.society_id));

  const changed = async () => {
    await refresh(); // society_id on the user changes too
    await qc.invalidateQueries();
  };

  const live = campaigns.data?.filter((x) => x.status === "active") ?? [];

  return (
    <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={all.some((q) => q.isRefetching)} onRefresh={() => qc.invalidateQueries()} />}
      >
        <Hero single eyebrow={t("nav.community")} title={t("comm.title")} subtitle={t("comm.intro")} />
        <View style={[styles.page, page]}>

        {mine.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
        {mine.data === null && <JoinOrStart onDone={changed} />}
        {mine.data && <MyCommunity s={mine.data} onLeft={changed} onChanged={(v) => qc.setQueryData(["community"], v)} />}

        {mine.data && (
          <View style={{ gap: space.sm }}>
            <Text style={[type.heading, { color: c.text }]}>{t("duel.title")}</Text>
            {duels.data?.length === 0 && <Body muted>{t("duel.none")}</Body>}
            {duels.data?.map((d) => (
              <DuelCard key={d.id} d={d} committee={committee} onAnswered={() => qc.invalidateQueries({ queryKey: ["duels"] })} />
            ))}
            {duelError && <ErrorText>{duelError}</ErrorText>}
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Text style={[type.heading, { color: c.text }]}>{t("comm.league")}</Text>
          {league.data?.length === 0 && <Body muted>{t("comm.leagueEmpty", { n: MIN_GROUP })}</Body>}
          {league.data && league.data.length >= 2 && (
            <Podium items={league.data.slice(0, 3).map((r) => ({ rank: r.rank, name: r.name, value: t("comm.perHousehold", { kg: r.co2_per_member_kg }), mine: r.society_id === mine.data?.id }))} />
          )}
          {league.data?.map((r) => (
            <Row key={r.society_id} rank={r.rank} name={r.name} sub={`${t(`comm.kind.${r.kind}` as MessageKey)} · ${t("comm.perHousehold", { kg: r.co2_per_member_kg })}`} highlight={r.society_id === mine.data?.id}>
              {committee && r.society_id !== mine.data?.id && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("duel.challenge")}: ${r.name}`}
                  disabled={opponents.has(r.society_id) || challenge.isPending}
                  onPress={() => challenge.mutate(r.society_id)}
                  style={[styles.pill, { borderColor: c.saffron, opacity: opponents.has(r.society_id) ? 0.5 : 1 }]}
                >
                  <Text style={[type.small, { color: c.saffron, fontWeight: "700" }]}>
                    {opponents.has(r.society_id) ? t("duel.challenged") : t("duel.challenge")}
                  </Text>
                </Pressable>
              )}
            </Row>
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type.heading, { color: c.text }]}>{t("comm.district")}</Text>
          {districts.data?.slice(0, 5).map((d) => (
            <Row key={d.district_id} rank={d.rank} name={d.district} sub={`${Math.round(d.goal_progress_pct)}% · ${t("comm.perHousehold", { kg: d.co2_saved_per_participant_kg })}`} highlight={d.district_id === user?.district_id} />
          ))}
          {(() => {
            const me = districts.data?.find((d) => d.district_id === user?.district_id);
            return me && me.rank > 5 ? <Row rank={me.rank} name={me.district} sub={`${Math.round(me.goal_progress_pct)}%`} highlight /> : null;
          })()}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type.heading, { color: c.text }]}>{t("comm.campaigns")}</Text>
          {campaigns.data && live.length === 0 && <Body muted>{t("comm.campaignsNone")}</Body>}
          {live.map((x) => x.kind === "peak" ? <PeakEventCard key={x.id} event={x} /> : (
            <Card key={x.id} tone="saffron">
              <Text style={[type.small, { color: c.saffron, fontWeight: "700" }]}>{x.scope_label}</Text>
              <Text style={[type.heading, { color: c.text }]}>{x.title}</Text>
              {x.description ? <Body muted>{x.description}</Body> : null}
              <Progress pct={x.progress_pct} />
              <Body>{t("comm.campaignLine", { progress: x.progress, target: x.target, days: x.days_left })}</Body>
            </Card>
          ))}
        </View>
        </View>
      </ScrollView>
  );
}

function JoinOrStart({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CommunityKind>("society");
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown")),
  });
  return (
    <>
      <Body muted>{t("comm.intro")}</Body>
      <Card>
        <Text style={type.heading}>{t("society.joinTitle")}</Text>
        <Body muted>{t("society.joinIntro")}</Body>
        <Field label={t("society.code")} value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Button title={t("comm.join")} busy={run.isPending} onPress={() => run.mutate(() => api.joinCommunity(code.trim()))} />
      </Card>
      <Card>
        <Text style={type.heading}>{t("comm.start")}</Text>
        <Body muted>{t("society.createIntro")}</Body>
        <Choice label={t("comm.kind")} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`comm.kind.${k}` as MessageKey) }))} />
        <Field label={t("comm.name")} value={name} onChangeText={setName} />
        <Button variant="plain" title={t("comm.start")} busy={run.isPending} onPress={() => run.mutate(() => api.createCommunity(name.trim(), kind))} />
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
}

function MyCommunity({ s, onLeft, onChanged }: { s: SocietyView; onLeft: () => Promise<void>; onChanged: (v: SocietyView) => void }) {
  const { t } = useI18n();
  const c = useColors();
  const [text, setText] = useState("");
  const leave = useMutation({ mutationFn: api.leaveCommunity, onSuccess: onLeft });
  const post = useMutation({
    mutationFn: () => api.postAnnouncement(text.trim()),
    onSuccess: (v) => {
      setText("");
      onChanged(v);
    },
  });
  const committee = s.role === "committee";
  return (
    <>
      <Card tone="green">
        <Text style={[type.small, { color: c.green, fontWeight: "700" }]}>
          {t(`comm.kind.${s.kind}` as MessageKey)} · {s.district}
        </Text>
        <Text style={[type.title, { color: c.text }]}>{s.name}</Text>
        <Body muted>
          {t("society.households")}: {s.member_count}
          {s.rank ? ` · ${t("society.rank")}: #${s.rank}` : ""}
        </Body>
        {committee && s.join_code && (
          <Body>
            {t("society.code")}: <Text style={{ fontWeight: "800", letterSpacing: 2 }}>{s.join_code}</Text>
          </Body>
        )}
      </Card>

      <Card>
        <Text style={type.heading}>{t("society.goalTitle")}</Text>
        {s.stats_visible ? (
          <>
            <Text style={[type.number, { color: c.green }]}>{s.co2_avoided_kg} kg</Text>
            {s.goal_kg_month ? (
              <>
                <Progress pct={s.goal_progress_pct ?? 0} />
                <Body muted>{t("society.goalLine", { done: `${s.co2_avoided_kg} kg`, goal: `${s.goal_kg_month} kg` })}</Body>
              </>
            ) : (
              <Body muted>{t("society.co2")} · {t("society.thisMonth")}</Body>
            )}
          </>
        ) : (
          <Body muted>{t("society.hidden", { n: s.min_group_size, have: s.member_count })}</Body>
        )}
      </Card>

      <Card>
        <Text style={type.heading}>{t("society.announcements")}</Text>
        {s.announcements.length === 0 && <Body muted>{t("society.noAnnouncements")}</Body>}
        {s.announcements.map((a) => (
          <View key={a.id} style={{ gap: 2 }}>
            <Body>{a.text}</Body>
            <Text style={[type.small, { color: c.muted }]}>{a.author}</Text>
          </View>
        ))}
        {committee && (
          <>
            <Field label={t("society.announcePlaceholder")} value={text} onChangeText={setText} multiline />
            <Button variant="plain" title={t("society.post")} busy={post.isPending} onPress={() => text.trim() && post.mutate()} />
          </>
        )}
      </Card>

      {committee && s.members && (
        <Card>
          <Text style={type.heading}>{t("society.members")}</Text>
          {s.members.map((m) => (
            <Body key={m.user_id}>
              {m.first_name} · {m.role === "committee" ? t("society.committee") : t("society.member")} · {t("society.memberActions", { n: m.actions_this_month })}
            </Body>
          ))}
        </Card>
      )}

      <Button variant="plain" title={t("comm.leave")} busy={leave.isPending} onPress={() => leave.mutate()} />
    </>
  );
}

function DuelCard({ d, committee, onAnswered }: { d: Duel; committee: boolean; onAnswered: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  const answer = useMutation({ mutationFn: (a: "accept" | "decline") => api.answerDuel(d.id, a), onSuccess: onAnswered });
  const floor = d.participation_floor_pct;

  if (d.status === "pending") {
    return (
      <Card tone="saffron">
        <Body>
          {d.incoming
            ? committee ? t("duel.incoming", { name: d.them.name }) : t("duel.incomingMember", { name: d.them.name })
            : t("duel.waiting", { name: d.them.name })}
        </Body>
        {d.incoming && committee && (
          <View style={styles.buttons}>
            <Button title={t("duel.accept")} busy={answer.isPending} onPress={() => answer.mutate("accept")} />
            <Button variant="plain" title={t("duel.decline")} onPress={() => answer.mutate("decline")} />
          </View>
        )}
        <Text style={[type.small, { color: c.muted }]}>{t("duel.rule", { floor })}</Text>
      </Card>
    );
  }

  const side = (s: Duel["us"], color: string) => (
    <View style={{ gap: 2 }}>
      <Text style={[type.body, { color: c.text, fontWeight: "700" }]}>{s.name}</Text>
      <Text style={[type.small, { color }]}>
        {s.counts ? t("duel.score", { kg: s.co2_per_member_kg ?? 0 }) : t("duel.notYet", { pct: Math.round(s.participation_pct), floor })}
      </Text>
      <Bar value={Math.min(100, s.participation_pct) / 100} color={s.counts ? color : c.muted} />
    </View>
  );
  const usKg = d.us.co2_per_member_kg ?? 0;
  const themKg = d.them.co2_per_member_kg ?? 0;
  const verdict = d.leader === "us" ? t("duel.leading") : d.leader === "them" ? t("duel.behind", { name: d.them.name }) : d.leader === "tie" ? t("duel.tie") : null;
  return (
    <Card>
      <Text style={[type.small, { color: c.muted }]}>
        {t("duel.vs", { name: d.them.name })} · {d.status === "finished" ? t("duel.finished") : t("duel.daysLeft", { days: d.days_left ?? 0 })}
      </Text>
      {verdict && <Text style={[type.heading, { color: d.leader === "them" ? c.saffron : c.green }]}>{verdict}</Text>}
      {d.us.counts && d.them.counts && usKg + themKg > 0 && (
        <View style={styles.tug} accessibilityLabel={`${d.us.name} ${usKg} kg, ${d.them.name} ${themKg} kg`}>
          <View style={[styles.crest, { backgroundColor: c.green, transform: [{ perspective: 400 }, { rotateY: "20deg" }] }]}>
            <Text style={[styles.crestText, { color: c.onPrimary }]}>{d.us.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[styles.tugTrack, { backgroundColor: c.clayLight }]}>
              <Bar value={usKg / (usKg + themKg)} color={c.green} track={c.clayLight} height={16} striped />
            </View>
          </View>
          <View style={[styles.crest, { backgroundColor: c.clay, transform: [{ perspective: 400 }, { rotateY: "-20deg" }] }]}>
            <Text style={[styles.crestText, { color: c.onPrimary }]}>{d.them.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        </View>
      )}
      {side(d.us, c.green)}
      {side(d.them, c.clay)}
      <Text style={[type.small, { color: c.muted }]}>{t("duel.rule", { floor })}</Text>
    </Card>
  );
}

function Row({ rank, name, sub, highlight, children }: { rank: number; name: string; sub: string; highlight?: boolean; children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.row, { backgroundColor: highlight ? c.greenSoft : c.surface, borderColor: highlight ? c.green : c.border }]}>
      <Text style={[type.heading, { color: c.muted, width: 36 }]}>#{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: c.text, fontWeight: "600" }]}>{name}</Text>
        <Text style={[type.small, { color: c.muted }]}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

function Progress({ pct }: { pct: number }) {
  const c = useColors();
  const p = Math.max(0, Math.min(100, pct));
  return <Bar value={p / 100} color={c.green} height={10} />;
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  tug: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tugTrack: { borderRadius: 16, overflow: "hidden" },
  crest: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  crestText: { fontFamily: fonts.display, fontSize: 15 },
  pill: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, minHeight: 36, justifyContent: "center" },
  buttons: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
});
