// Nidhi's logo: leaves around a home with rooftop solar, a wind turbine and the sun, and the name.
import { Image, type ImageStyle, type StyleProp } from "react-native";

const LOGO = require("../../assets/images/logo.png");

export function BrandLogo({ size = 48, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={LOGO} accessibilityRole="image" accessibilityLabel="Nidhi" resizeMode="contain" style={[{ width: size, height: size }, style]} />;
}
