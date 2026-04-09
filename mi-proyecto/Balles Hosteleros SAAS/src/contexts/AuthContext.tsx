import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

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
  canAccess: (modulo: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Define which modules each role can access
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("nombre, apellidos, email, empresa_id")
              .eq("user_id", session.user.id)
              .single();

            if (profileData) setProfile(profileData);

            const { data: rolesData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id);

            if (rolesData) setRoles(rolesData.map((r) => r.role));
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
      // onAuthStateChange will handle the rest
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const canAccess = (path: string) => {
    if (roles.length === 0) return false;
    const modulo = getModuloFromPath(path);
    return roles.some((role) => {
      const allowed = ROLE_MODULES[role];
      return allowed.includes("*") || allowed.includes(modulo) || modulo === "ayuda";
    });
  };

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
export type { AppRole };
