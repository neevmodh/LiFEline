// Shared building blocks so every screen uses the same spacing, type, colours and depth.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, radius, shadow, space, type, useColors } from "@/theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.text} />;
}

export function Screen({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.screen}>{children}</View>
    </SafeAreaView>
  );
}

/** The gradient header at the top of a tab: eyebrow, title, optional subtitle and extra content. */
export function Hero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.heroInner}>
        {eyebrow ? <Text style={[type.eyebrow, { color: "#F2A23A" }]}>{eyebrow}</Text> : null}
        <Text style={[type.title, { color: c.onHero, fontSize: 28 }]}>{title}</Text>
        {subtitle ? <Text style={[type.body, { color: c.onHeroMuted }]}>{subtitle}</Text> : null}
        {children}
      </View>
    </LinearGradient>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[type.title, { color: c.text }]}>{children}</Text>;
}

/** A section heading inside a page, with an optional icon. */
export function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: IconName }) {
  const c = useColors();
  return (
    <View style={styles.sectionTitle}>
      {icon && <Icon name={icon} size={20} color={c.green} />}
      <Text style={[type.heading, { color: c.text, fontSize: 19 }]}>{children}</Text>
    </View>
  );
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={[type.body, { color: muted ? c.muted : c.text }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.errorRow}>
      <Icon name="alert-circle" size={16} color={c.red} />
      <Text accessibilityRole="alert" style={[type.small, { color: c.red, flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
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
  icon,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "plain" | "accent";
  icon?: IconName;
}) {
  const c = useColors();
  const bg = variant === "primary" ? c.primary : variant === "accent" ? c.green : c.surface;
  const fg = variant === "plain" ? c.text : c.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === "plain" && { borderColor: c.border, borderWidth: 1 },
        variant !== "plain" && shadow,
        { opacity: busy ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonRow}>
          {icon && <Icon name={icon} size={18} color={fg} />}
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: fg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** One choice from a short list, as chips that wrap. */
export function Choice<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }} accessibilityLabel={label || undefined}>
      {label ? <Text style={[type.small, { color: c.muted }]}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}
            >
              <Text style={[type.small, { color: on ? c.onPrimary : c.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Card({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "green" | "saffron" }) {
  const c = useColors();
  const bg = tone === "green" ? c.greenSoft : tone === "saffron" ? c.saffronSoft : c.surface;
  return <View style={[styles.card, tone === "plain" && shadow, { backgroundColor: bg, borderColor: tone === "plain" ? "transparent" : c.border }]}>{children}</View>;
}

export function BigNumber({ children, color }: { children: React.ReactNode; color?: string }) {
  const c = useColors();
  return <Text style={[type.number, { color: color ?? c.text }]}>{children}</Text>;
}

/** A small rounded label, e.g. a theme or a status. */
export function Pill({ children, color, background }: { children: React.ReactNode; color?: string; background?: string }) {
  const c = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: background ?? c.surfaceAlt }]}>
      <Text style={[type.small, { color: color ?? c.muted }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  hero: { paddingHorizontal: space.lg, paddingBottom: space.xxl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroInner: { gap: space.sm, width: "100%", maxWidth: 560, alignSelf: "center" },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  errorRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, minHeight: 50 },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md + 2, paddingVertical: space.sm, minHeight: 40, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg + 2, gap: space.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4, alignSelf: "flex-start" },
});
