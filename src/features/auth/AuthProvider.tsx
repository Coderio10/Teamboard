import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

const MAX_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isExpired = (session: Session | null) => {
  const last = session?.user?.last_sign_in_at;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() > MAX_SESSION_MS;
};

type AuthState = { session: Session | null; loading: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Load the saved session on startup
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (isExpired(data.session)) {
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    // Keep in sync with sign in / out / refresh.
    // Don't call other supabase methods inside this callback.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2. While logged in, re-check the age hourly and when the tab regains focus
  useEffect(() => {
    if (!session) return;
    const check = () => {
      if (isExpired(session)) supabase.auth.signOut();
    };
    check();
    const interval = setInterval(check, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);