// Responsive layout for the web build: on a wide browser window the app becomes a desktop app with a
// sidebar and two-column pages; phones (and the native app) keep the one-column phone layout.
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";

import { space } from "@/theme";

/** Wide enough for the sidebar and two columns. Only ever true in a browser. */
export const WIDE_AT = 1000;

export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= WIDE_AT;
}

/** The content width of a page: phone-width on phones, roomier on a desktop (`single` for one column). */
export function usePageWidth(single = false): ViewStyle {
  const wide = useWide();
  return { width: "100%", maxWidth: wide ? (single ? 820 : 1120) : 560, alignSelf: "center" };
}

/** Two columns side by side on a wide window; one after the other (left first) everywhere else. */
export function Columns({ left, right, ratio = 1.15 }: { left: React.ReactNode; right: React.ReactNode; ratio?: number }) {
  const wide = useWide();
  if (!wide) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View style={styles.row}>
      <View style={[styles.col, { flex: ratio }]}>{left}</View>
      <View style={[styles.col, { flex: 1 }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.xl },
  col: { gap: space.md, minWidth: 0 },
});
