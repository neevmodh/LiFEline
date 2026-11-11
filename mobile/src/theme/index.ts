// Nidhi's look: "Gujarat sunrise". Deep GEDA navy fading to Mission LiFE green for the hero,
// saffron for what needs attention, a warm paper background, white cards with soft shadows.
// Space Grotesk for headings and big numbers, Inter for reading.
import { Platform, useColorScheme, type ViewStyle } from "react-native";

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodyBold: "Inter_600SemiBold",
} as const;

const palette = {
  navy: "#0B2A5B",
  navySoft: "#1E4A8C",
  green: "#1F8A4C",
  greenBright: "#2FB36A",
  greenSoft: "#E3F4EA",
  saffron: "#F28C1B",
  saffronSoft: "#FDEFD9",
  red: "#C0392B",
};

export const colors = {
  light: {
    ...palette,
    background: "#F6F3EC",
    surface: "#FFFFFF",
    surfaceAlt: "#FBF9F4",
    border: "#E6E1D6",
    text: "#14213D",
    muted: "#5B6475",
    primary: palette.navy,
    onPrimary: "#FFFFFF",
    hero: ["#0B2A5B", "#14507A", "#1F8A4C"] as const,
    onHero: "#F4F1E8",
    onHeroMuted: "#BFD8D5",
  },
  dark: {
    ...palette,
    background: "#0A1220",
    surface: "#131E31",
    surfaceAlt: "#17243A",
    border: "#26344D",
    text: "#F2F5FA",
    muted: "#A3AEC2",
    primary: "#7FA8E8",
    onPrimary: "#0A1220",
    greenSoft: "#123524",
    saffronSoft: "#3A2710",
    hero: ["#071A38", "#0D3653", "#145C35"] as const,
    onHero: "#F4F1E8",
    onHeroMuted: "#A9C4C0",
  },
};

export type Colors = (typeof colors)["light"] | (typeof colors)["dark"];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 } as const;

export const type = {
  // Big numbers are the point of most screens: units, rupees, score.
  number: { fontSize: 44, fontFamily: fonts.display, fontVariant: ["tabular-nums" as const], letterSpacing: -1 },
  title: { fontSize: 26, fontFamily: fonts.display, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontFamily: fonts.display },
  body: { fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  small: { fontSize: 13, lineHeight: 18, fontFamily: fonts.bodyMedium },
  eyebrow: { fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 1.2, textTransform: "uppercase" as const },
};

/** A soft, warm card shadow (elevation on Android). */
export const shadow: ViewStyle = Platform.select({
  android: { elevation: 3 },
  default: { shadowColor: "#14213D", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
}) as ViewStyle;

export function useColors(): Colors {
  return colors[useColorScheme() === "dark" ? "dark" : "light"];
}
