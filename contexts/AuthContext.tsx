"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AuthContextValue, Dealer, UserProfile } from "@/types";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("getSession error:", error);
        }

        if (!mounted) return;
        setUser(session?.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileAndDealer() {
      if (!user) {
        if (mounted) {
          setProfile(null);
          setDealer(null);
        }
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("profile fetch error:", profileError);
        if (mounted) {
          setProfile(null);
          setDealer(null);
        }
        return;
      }

      if (!mounted) return;
      setProfile(profileData as UserProfile);

      const { data: dealerData, error: dealerError } = await supabase
        .from("dealers")
        .select("*")
        .eq("id", profileData.dealer_id)
        .single();

      if (dealerError) {
        console.error("dealer fetch error:", dealerError);
        if (mounted) setDealer(null);
        return;
      }

      if (!mounted) return;
      setDealer(dealerData as Dealer);
    }

    loadProfileAndDealer();

    return () => {
      mounted = false;
    };
  }, [user, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        dealer,
        loading,
        isAdmin: profile?.role === "admin",
        isManager: profile?.role === "manager",
        isSalesRep: profile?.role === "sales_rep",
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}