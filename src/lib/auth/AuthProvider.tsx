"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseEnabled } from "@/lib/supabase/client";

type AuthContextValue = {
  /** False when Supabase env vars aren't configured (localStorage demo mode). */
  enabled: boolean;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  enabled: false,
  user: null,
  loading: false,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = isSupabaseEnabled();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const userId = user?.id;
  const userEmail = user?.email;

  useEffect(() => {
    setAdminUserId(null);
    if (!userId) return;
    const controller = new AbortController();
    async function checkAccess() {
      try {
        const session = (await getSupabase()?.auth.getSession())?.data.session;
        if (!session || session.user.id !== userId || controller.signal.aborted) return;
        const response = await fetch("/api/admin/access", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store", signal: controller.signal,
        });
        const result = response.ok ? await response.json() : null;
        if (!controller.signal.aborted && result?.isAdmin === true) setAdminUserId(session.user.id);
      } catch { /* Hide the link when access cannot be verified. */ }
    }
    void checkAccess();
    return () => controller.abort();
  }, [userId, userEmail]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getSupabase()?.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ enabled, user, loading, isAdmin: Boolean(user && adminUserId === user.id), signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
