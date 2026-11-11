// Each Mission LiFE theme's icon and its soft tint and ink, so actions read the same on every screen.
import type { IconName } from "@/components/ui";
import type { Colors } from "@/theme";

export function themeLook(theme: string, c: Colors): { icon: IconName; tint: string; ink: string } {
  switch (theme) {
    case "energy":
      return { icon: "flash-outline", tint: c.saffronSoft, ink: c.saffronInk };
    case "water":
      return { icon: "water-outline", tint: c.skySoft, ink: c.sky };
    case "plastic":
      return { icon: "bag-handle-outline", tint: c.claySoft, ink: c.clay };
    case "waste":
      return { icon: "trash-outline", tint: c.claySoft, ink: c.clay };
    case "ewaste":
      return { icon: "hardware-chip-outline", tint: c.skySoft, ink: c.sky };
    case "food":
      return { icon: "nutrition-outline", tint: c.greenSoft, ink: c.greenDeep };
    case "health":
      return { icon: "walk-outline", tint: c.greenSoft, ink: c.greenDeep };
    default:
      return { icon: "leaf-outline", tint: c.greenSoft, ink: c.greenDeep };
  }
}
