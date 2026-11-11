// Small shared building blocks so every screen uses the same spacing, type and colours.
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { radius, space, type, useColors } from "@/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.screen}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[type.title, { color: c.text }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={[type.body, { color: muted ? c.muted : c.text }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="alert" style={[type.small, { color: c.red }]}>
      {children}
    </Text>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  busy,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "plain";
}) {
  const c = useColors();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: c.primary } : { borderColor: c.border, borderWidth: 1 },
        { opacity: pressed || busy ? 0.7 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.onPrimary : c.text} />
      ) : (
        <Text style={[type.heading, { color: primary ? c.onPrimary : c.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, minHeight: 48 },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
});
