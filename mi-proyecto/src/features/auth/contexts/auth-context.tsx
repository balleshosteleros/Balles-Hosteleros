"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "admin" | "director" | "gerencia" | "responsable" | "empleado" | "solo_lectura";

export interface AuthProfile {
  nombre: string;
  apellidos: string;
  email: string;
  empresa_id: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  canAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_MODULES: Record<AppRole, string[]> = {
  admin: ["*"],
  director: ["*"],
  gerencia: ["dashboard", "gerencia", "rrhh", "contabilidad", "marketing", "logistica", "ajustes"],
  responsable: ["dashboard", "rrhh", "gerencia"],
  empleado: ["dashboard", "rrhh"],
  solo_lectura: ["dashboard"],
};

function getModuloFromPath(path: string): string {
  if (path === "/") return "dashboard";
  const seg = path.split("/")[1];
  const map: Record<string, string> = {
    gerencia: "gerencia",
    direccion: "gerencia",
    contabilidad: "contabilidad",
    gestoria: "gestoria",
    juridico: "juridico",
    rrhh: "rrhh",
    marketing: "marketing",
    logistica: "logistica",
    ajustes: "ajustes",
    ayuda: "ayuda",
    "consultas-pendientes": "dashboard",
  };
  return map[seg] ?? "dashboard";
}

// Lazy singleton — only created once on the client side
let supabaseInstance: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    // Dynamic import to avoid SSR issues
    const { createBrowserClient } = require("@supabase/ssr");
    supabaseInstance = createBrowserClient(url, key);
  }
  return supabaseInstance;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("nombre, apellidos, email, empresa_id")
              .eq("user_id", session.user.id)
              .single();

            if (profileData) setProfile(profileData as AuthProfile);

            const { data: rolesData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id);

            if (rolesData) setRoles(rolesData.map((r: { role: string }) => r.role as AppRole));
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const canAccess = useCallback((path: string) => {
    if (roles.length === 0) return false;
    const modulo = getModuloFromPath(path);
    return roles.some((role) => {
      const allowed = ROLE_MODULES[role];
      return allowed.includes("*") || allowed.includes(modulo) || modulo === "ayuda";
    });
  }, [roles]);

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, signIn, signOut, hasRole, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { getModuloFromPath, ROLE_MODULES };
