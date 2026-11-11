// Root: data cache, language and session, then the navigator. Who you are decides where you land:
// signed out -> sign in; a new household -> onboarding, then the tabs; GEDA staff -> the web console.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { I18nProvider } from "@/i18n";
import { SessionProvider, useSession } from "@/lib/session";
import { setItem } from "@/lib/storage";

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

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);
  if (isLoading) return null;

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
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionProvider>
          <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
            <RootNavigator />
          </ThemeProvider>
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
