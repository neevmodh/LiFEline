// Sign in with the email or the mobile number, and the password (which can be shown while typing).
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { BrandLogo } from "@/components/brand";
import { LanguagePicker } from "@/components/language-picker";
import { Body, Button, ErrorText, Field, Hero, Icon } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fonts, radius, space, type, useColors } from "@/theme";

export default function SignIn() {
  const { t } = useI18n();
  const { signIn } = useSession();
  const c = useColors();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(mode === "email" ? { email: email.trim() } : { phone: phone.trim() }, password);
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} keyboardShouldPersistTaps="handled">
      <Hero eyebrow="Nidhi · Mission LiFE" title={t("auth.welcomeBack")} subtitle={t("auth.loginSub")}>
        <BrandLogo size={88} />
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {(["signin.point1", "signin.point2", "signin.point3"] as const).map((k, i) => (
            <View key={k} style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <Icon name={(["flash-outline", "language-outline", "shield-checkmark-outline"] as const)[i]} size={18} color={c.saffron} />
              <Body>
                <Text style={{ color: c.text }}>{t(k)}</Text>
              </Body>
            </View>
          ))}
        </View>
      </Hero>
      <View style={styles.page}>
        <LanguagePicker />

        <View style={[styles.switch, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
          {(["email", "phone"] as const).map((m) => {
            const on = m === mode;
            return (
              <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setMode(m)} style={[styles.tab, on && { backgroundColor: c.surface }]}>
                <Text style={[type.small, { color: c.text, fontFamily: fonts.bodyBold }]}>{m === "email" ? t("auth.email") : t("auth.phone")}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "email" ? (
          <Animated.View key="email" entering={FadeIn.duration(200)}>
            <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          </Animated.View>
        ) : (
          <Animated.View key="phone" entering={FadeIn.duration(200)} style={{ gap: 6 }}>
            <Text style={[type.small, { color: c.muted }]}>{t("auth.phone")}</Text>
            <View style={styles.phoneRow}>
              <View style={[styles.code, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Text style={[type.body, { color: c.text }]}>+91</Text>
              </View>
              <TextInput
                accessibilityLabel={t("auth.phone")}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="98765 43210"
                placeholderTextColor={c.muted}
                style={[styles.input, type.body, { flex: 1, color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
              />
            </View>
          </Animated.View>
        )}

        <View style={{ gap: 6 }}>
          <Text style={[type.small, { color: c.muted }]}>{t("auth.password")}</Text>
          <View>
            <TextInput
              accessibilityLabel={t("auth.password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoComplete="current-password"
              onSubmitEditing={submit}
              style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface, paddingRight: 52 }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={show ? t("auth.hidePassword") : t("auth.showPassword")} onPress={() => setShow((v) => !v)} style={styles.eye}>
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={22} color={c.muted} />
            </Pressable>
          </View>
        </View>

        {error && <ErrorText>{error}</ErrorText>}
        <Button title={t("nav.signIn")} onPress={submit} busy={busy} icon="log-in-outline" />
        <Body muted>
          {t("auth.newHere")}{" "}
          <Link href="/sign-up" style={{ color: c.greenDeep, fontWeight: "600" }}>
            {t("auth.createLink")}
          </Link>
        </Body>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  switch: { flexDirection: "row", padding: 4, borderRadius: 14 },
  tab: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  phoneRow: { flexDirection: "row", gap: space.sm },
  code: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: "center", minHeight: 50 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, minHeight: 50 },
  eye: { position: "absolute", right: 4, top: 3, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
