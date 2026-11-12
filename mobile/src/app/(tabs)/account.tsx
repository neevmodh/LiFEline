// Language, data and account, opened from Me: the app's language, a download of everything Nidhi
// stores about you, deleting your account and photos, and signing out.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguagePicker } from "@/components/language-picker";
import { Body, Button, Card, ErrorText, Field } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import { saveTextFile } from "@/lib/save-file";
import { useSession } from "@/lib/session";
import { fonts, space, type, useColors } from "@/theme";

export default function Account() {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + space.md }]} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/me"))}
          style={[styles.back, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <Text style={[type.title, { color: c.text, fontSize: 24, flex: 1 }]}>{t("me.account")}</Text>
      </View>
      <Card>
        <Text style={type.heading}>{t("you.language")}</Text>
        <LanguagePicker />
      </Card>
      <Card>
        <Text style={type.heading}>{t("me.signedInAs")}</Text>
        <Body>{user?.name}</Body>
        <Text style={[type.small, { color: c.muted }]}>{[user?.email, user?.phone].filter(Boolean).join(" · ")}</Text>
      </Card>
      <YourData onDeleted={signOut} />
      <Button variant="plain" icon="log-out-outline" title={t("nav.signOut")} onPress={signOut} />
    </ScrollView>
  );
}

function YourData({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fail = (e: unknown) => setNote({ ok: false, text: e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown") });

  const download = useMutation({
    mutationFn: async () => {
      const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      await saveTextFile(`nidhi-my-data-${day}.json`, await api.exportData(), "application/json");
    },
    onSuccess: () => setNote({ ok: true, text: t("me.downloaded") }),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: async () => {
      setNote({ ok: true, text: t("me.deleted") });
      await onDeleted(); // the account is gone, so the token is too
    },
    onError: fail,
  });

  return (
    <Card>
      <Text style={type.heading}>{t("you.data")}</Text>
      <Body muted>{t("you.dataBody")}</Body>
      <Button title={t("you.download")} busy={download.isPending} onPress={() => download.mutate()} />
      {!confirming ? (
        <Button variant="plain" title={t("you.delete")} onPress={() => setConfirming(true)} />
      ) : (
        <>
          <Body>{t("you.deleteConfirm")}</Body>
          <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
          <Button title={t("you.deleteGo")} busy={remove.isPending} onPress={() => password && remove.mutate()} />
          <Button variant="plain" title={t("common.cancel")} onPress={() => setConfirming(false)} />
        </>
      )}
      {note && (note.ok ? <Body>{note.text}</Body> : <ErrorText>{note.text}</ErrorText>)}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md, width: "100%", maxWidth: 640, alignSelf: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display },
});
