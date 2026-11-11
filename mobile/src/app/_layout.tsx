// Root: data cache, language and session, then the navigator. Who you are decides where you land:
// signed out -> hello (the welcome screen), then sign in or sign up; a new household -> onboarding, then the tabs; GEDA staff -> the web console.
import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

import { I18nProvider } from "@/i18n";
import { SessionProvider, useSession } from "@/lib/session";
import { setItem } from "@/lib/storage";

const FONT_WAIT_MS = 2500;
SplashScreen.preventAutoHideAsync();

// The web landing page's free bill check links here with its answers (?guest=...), so onboarding
// can start from them. Kept under the same key onboarding already reads.
if (process.env.EXPO_OS === "web" && typeof window !== "undefined") {
  const guest = new URLSearchParams(window.location.search).get("guest");
  if (guest) void setItem("nidhi.guest", guest);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

function RootNavigator() {
  const { user, isLoading } = useSession();
  // Fonts that fail to load fall back to the system face rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium, BricolageGrotesque_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });
  // On a slow connection (the web build downloads its fonts) don't hold the whole app back:
  // after FONT_WAIT_MS draw with the system face and let the brand fonts swap in when they land.
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const ready = !isLoading && (fontsLoaded || !!fontError || fontWaitOver);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const citizen = user?.role === "citizen";
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user && citizen && user.onboarded}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && citizen && !user.onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !citizen}>
        <Stack.Screen name="staff" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="hello" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * On a wide browser window the app sits in a centred column, phone-width up to a small tablet,
 * so the tab bar and cards keep their proportions; on phones and in the native app it fills the screen.
 */
function AppFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== "web" || width < 700) return <>{children}</>;
  return (
    <View style={frame.outer}>
      <View style={frame.column}>{children}</View>
    </View>
  );
}

const frame = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#ECE5D8", alignItems: "center" },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
    backgroundColor: "#F6F2EA",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#E7E0D3",
    boxShadow: "0 0 60px -20px rgba(35,49,42,0.35)",
    overflow: "hidden",
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionProvider>
          <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: "#F6F2EA" } }}>
            <StatusBar style="dark" />
            <AppFrame>
              <RootNavigator />
            </AppFrame>
          </ThemeProvider>
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
