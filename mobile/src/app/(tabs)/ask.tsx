// Ask Nidhi: a short conversation about your own energy, in your language. Answers use only this
// home's numbers (POST /api/coach/ask); when one suggests an action, it can be logged in one tap.
// Suggested questions get people started; the conversation stays on this screen only.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/brand";
import { Celebration } from "@/components/celebration";
import { usePageWidth } from "@/components/layout";
import { useI18n, type MessageKey } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import { useLogAction } from "@/lib/log-action";
import { fonts, space, type, useColors } from "@/theme";

type Message =
  | { id: number; from: "me"; text: string }
  | { id: number; from: "nidhi"; text: string; byAi: boolean; actionCode: string | null; actionTitle: string | null }
  | { id: number; from: "error"; text: string };

/** A message before it gets its id (Omit over each member of the union, not the union as a whole). */
type NewMessage = Message extends infer M ? (M extends Message ? Omit<M, "id"> : never) : never;

const SUGGESTIONS: MessageKey[] = ["ask.q.bill", "ask.q.ac", "ask.q.peak", "ask.q.solar", "ask.q.geyser", "ask.q.led"];
const MAX = 300;

export default function Ask() {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePageWidth(true);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const logger = useLogAction();

  const add = (m: NewMessage) => setMessages((all) => [...all, { ...m, id: nextId.current++ } as Message]);
  const ask = useMutation({
    mutationFn: (question: string) => api.ask(question),
    onSuccess: (a) => add({ from: "nidhi", text: a.answer, byAi: a.written_by_ai, actionCode: a.action_code, actionTitle: a.action_title }),
    onError: (e) => add({ from: "error", text: e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown") }),
  });
  const send = (text: string) => {
    const q = text.trim().slice(0, MAX);
    if (q.length < 2 || ask.isPending) return;
    add({ from: "me", text: q });
    setDraft("");
    ask.mutate(q);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.top, page, { paddingTop: insets.top + space.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
          style={[styles.back, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <BrandLogo size={36} />
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: c.text }]}>{t("ask.title")}</Text>
          <Text style={[type.small, { color: c.muted }]}>{t("ask.sub")}</Text>
        </View>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={[styles.list, page]} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
        <Bubble from="nidhi">
          <Text style={[type.body, { color: c.text }]}>{t("ask.hello")}</Text>
        </Bubble>
        {messages.map((m) =>
          m.from === "me" ? (
            <Bubble key={m.id} from="me">
              <Text style={[type.body, { color: c.onPrimary }]}>{m.text}</Text>
            </Bubble>
          ) : m.from === "error" ? (
            <Bubble key={m.id} from="nidhi">
              <Text style={[type.small, { color: c.red }]}>{m.text}</Text>
            </Bubble>
          ) : (
            <Bubble key={m.id} from="nidhi">
              <Text style={[type.body, { color: c.text }]}>{m.text}</Text>
              {m.actionCode && m.actionTitle && (
                <Pressable
                  accessibilityRole="button"
                  disabled={logger.busy}
                  onPress={() => logger.logNow({ code: m.actionCode as string, title: m.actionTitle as string, fullPoints: 0 })}
                  style={({ pressed }) => [styles.action, { backgroundColor: c.primary, opacity: logger.busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <Ionicons name="checkmark" size={16} color={c.onPrimary} />
                  <Text style={[styles.actionText, { color: c.onPrimary }]} numberOfLines={1}>
                    {t("ask.logIt", { title: m.actionTitle })}
                  </Text>
                </Pressable>
              )}
              {m.byAi && <Text style={[styles.byAi, { color: c.muted }]}>{t("home.byAi")}</Text>}
            </Bubble>
          ),
        )}
        {ask.isPending && (
          <Bubble from="nidhi">
            <Text style={[type.small, { color: c.muted }]}>{t("ask.thinking")}</Text>
          </Bubble>
        )}
        {logger.error && <Text style={[type.small, { color: c.red }]}>{logger.error}</Text>}
      </ScrollView>

      <View style={[styles.bottom, page, { paddingBottom: space.md }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {SUGGESTIONS.map((k) => (
            <Pressable key={k} accessibilityRole="button" disabled={ask.isPending} onPress={() => send(t(k))} style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Text style={[type.small, { color: c.text }]}>{t(k)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          <TextInput
            accessibilityLabel={t("ask.placeholder")}
            placeholder={t("ask.placeholder")}
            placeholderTextColor={c.muted}
            value={draft}
            onChangeText={(s) => setDraft(s.slice(0, MAX))}
            onSubmitEditing={() => send(draft)}
            returnKeyType="send"
            style={[type.body, styles.input, { color: c.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("ask.send")}
            disabled={draft.trim().length < 2 || ask.isPending}
            onPress={() => send(draft)}
            style={[styles.send, { backgroundColor: c.primary, opacity: draft.trim().length < 2 || ask.isPending ? 0.4 : 1 }]}
          >
            <Ionicons name="arrow-up" size={20} color={c.onPrimary} />
          </Pressable>
        </View>
      </View>
      <Celebration info={logger.celebration} onClose={logger.closeCelebration} />
    </KeyboardAvoidingView>
  );
}

function Bubble({ from, children }: { from: "me" | "nidhi"; children: React.ReactNode }) {
  const c = useColors();
  const me = from === "me";
  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[styles.bubble, me ? { alignSelf: "flex-end", backgroundColor: c.primary, borderBottomRightRadius: 6 } : { alignSelf: "flex-start", backgroundColor: c.surface, borderBottomLeftRadius: 6 }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, flexGrow: 1 },
  bubble: { maxWidth: "86%", borderRadius: 20, paddingHorizontal: space.md, paddingVertical: space.md - 2, gap: space.sm },
  action: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 38, borderRadius: 12, maxWidth: "100%" },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 13, flexShrink: 1 },
  byAi: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  bottom: { paddingHorizontal: space.lg, gap: space.sm },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: "center" },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 22, paddingLeft: space.md, paddingRight: 6, minHeight: 52 },
  input: { flex: 1, paddingVertical: space.sm, outlineStyle: "none" } as object,
  send: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
