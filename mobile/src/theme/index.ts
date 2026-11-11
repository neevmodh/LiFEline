// Nidhi's look: warm paper, deep ink, soft sage and saffron, with dusty sky and clay for variety.
// Flat colour and soft shadows, no glow and no gradients; drawn illustrations carry the character.
// Bricolage Grotesque for headings and big numbers, Inter for reading.
import { Platform, useColorScheme, type ViewStyle } from "react-native";

export const fonts = {
  display: "BricolageGrotesque_700Bold",
  displayMedium: "BricolageGrotesque_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodyBold: "Inter_600SemiBold",
} as const;

const palette = {
  ink: "#23312A",
  navy: "#23312A",
  navySoft: "#3E4A43",
  green: "#4E7D5E",
  greenDeep: "#3F6B4E",
  greenBright: "#6F9A7B",
  leaf: "#8DB497",
  saffron: "#C9873E",
  saffronLight: "#E9B872",
  saffronInk: "#8A5A22",
  sky: "#45678A",
  skyLight: "#9DB4C9",
  clay: "#97503A",
  clayLight: "#E8C9B9",
  bark: "#7A5A3F",
  red: "#B3452F",
};

export const colors = {
  light: {
    ...palette,
    background: "#F6F2EA",
    surface: "#FFFDF8",
    surfaceAlt: "#F1EBDF",
    track: "#ECE5D8",
    border: "#E7E0D3",
    text: "#23312A",
    muted: "#5F6B63",
    primary: "#23312A",
    onPrimary: "#F6F2EA",
    greenSoft: "#E6EEDF",
    saffronSoft: "#F5E6D2",
    skySoft: "#E3EAF1",
    claySoft: "#F2E1D8",
    // The header band: flat paper, kept as a pair so older call sites still type-check.
    hero: ["#F6F2EA", "#F6F2EA"] as const,
    onHero: "#23312A",
    onHeroMuted: "#5F6B63",
  },
  dark: {
    ...palette,
    background: "#161C18",
    surface: "#1F2722",
    surfaceAlt: "#252E28",
    track: "#2E3832",
    border: "#323D36",
    text: "#EEE9DF",
    muted: "#A9B2AA",
    primary: "#E9E2D3",
    onPrimary: "#161C18",
    green: "#7FAE8C",
    greenDeep: "#A8CDB1",
    saffronInk: "#E9B872",
    sky: "#A9C1D8",
    clay: "#E3A58C",
    greenSoft: "#24362A",
    saffronSoft: "#3A2D1C",
    skySoft: "#22303D",
    claySoft: "#3A2620",
    hero: ["#161C18", "#161C18"] as const,
    onHero: "#EEE9DF",
    onHeroMuted: "#A9B2AA",
  },
};

export type Colors = (typeof colors)["light"] | (typeof colors)["dark"];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const type = {
  // Big numbers are the point of most screens: units, rupees, score.
  number: { fontSize: 44, fontFamily: fonts.display, fontVariant: ["tabular-nums" as const], letterSpacing: -1 },
  title: { fontSize: 28, fontFamily: fonts.display, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontFamily: fonts.display },
  body: { fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  small: { fontSize: 13, lineHeight: 18, fontFamily: fonts.bodyMedium },
  eyebrow: { fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 1, textTransform: "uppercase" as const },
};

/** A soft paper shadow (elevation on Android). */
export const shadow: ViewStyle = Platform.select({
  android: { elevation: 2 },
  default: { shadowColor: "#23312A", shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
}) as ViewStyle;

export function useColors(): Colors {
  return colors[useColorScheme() === "dark" ? "dark" : "light"];
}
