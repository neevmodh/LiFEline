// Nidhi design tokens: GEDA navy, Mission LiFE green and saffron, with large readable numbers.
import { useColorScheme } from "react-native";

const palette = {
  navy: "#0B2A5B",
  navySoft: "#1E4A8C",
  green: "#1F8A4C",
  greenSoft: "#E3F4EA",
  saffron: "#F28C1B",
  saffronSoft: "#FDEFD9",
  red: "#C0392B",
};

export const colors = {
  light: {
    ...palette,
    background: "#F7F8FA",
    surface: "#FFFFFF",
    border: "#DDE2EA",
    text: "#101828",
    muted: "#5B6475",
    primary: palette.navy,
    onPrimary: "#FFFFFF",
  },
  dark: {
    ...palette,
    background: "#0A1220",
    surface: "#131E31",
    border: "#26344D",
    text: "#F2F5FA",
    muted: "#A3AEC2",
    primary: "#7FA8E8",
    onPrimary: "#0A1220",
    greenSoft: "#123524",
    saffronSoft: "#3A2710",
  },
} as const;

export type Colors = (typeof colors)["light"] | (typeof colors)["dark"];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;

export const type = {
  // Big numbers are the point of most screens: units, rupees, score.
  number: { fontSize: 40, fontWeight: "800" as const, fontVariant: ["tabular-nums" as const] },
  title: { fontSize: 24, fontWeight: "700" as const },
  heading: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
};

export function useColors(): Colors {
  return colors[useColorScheme() === "dark" ? "dark" : "light"];
}
