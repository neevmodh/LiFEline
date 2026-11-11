// Who is signed in. The token is restored from the device on launch and checked against /api/auth/me.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, ApiError, loadToken, saveToken, type User } from "./api";

interface Session {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; name: string; district_id: number; ward?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-read the user, e.g. after onboarding sets `onboarded`. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (await loadToken()) setUser(await api.me());
      } catch (e) {
        // An expired or revoked token signs you out; a network error keeps the token for next launch.
        if (e instanceof ApiError && e.status === 401) await saveToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login({ email, password });
    await saveToken(token);
    setUser(user);
  }, []);

  const signUp = useCallback<Session["signUp"]>(async (data) => {
    const { token, user } = await api.register(data);
    await saveToken(token);
    setUser(user);
  }, []);

  const signOut = useCallback(async () => {
    await saveToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => setUser(await api.me()), []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signUp, signOut, refresh }),
    [user, isLoading, signIn, signUp, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
