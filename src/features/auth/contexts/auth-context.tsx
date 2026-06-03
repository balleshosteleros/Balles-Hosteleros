"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";
import type { PermisoModulo } from "@/features/ajustes/data/ajustes";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";

export type AppRole = "admin" | "director" | "gerencia" | "responsable" | "empleado" | "solo_lectura";

export interface AuthProfile {
  nombre: string;
  apellidos: string;
  email: string;
  empresa_id: string;
  avatar_url?: string | null;
  avatar_obligatorio?: boolean | null;
  rol_label?: string | null;
  departamento?: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  loading: boolean;
  permisos: PermisoModulo[];
  permisosLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  canAccess: (path: string) => boolean;
  puedeVer: (modulo: string) => boolean;
  puedeEditar: (modulo: string) => boolean;
}

// "Dirección" === "DIRECCIÓN" === " direccion " (acentos, case y espacios).
const COMBINING_MARKS = /[̀-ͯ]/g;
function normalizarModulo(m: string): string {
  return m.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

export const AuthContext = createContext<AuthContextValue | null>(null);

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
    supabaseInstance = createBrowserClient(url, key);
  }
  return supabaseInstance;
}

// Caché stale-while-revalidate de roles/permisos por usuario.
// Permite que el sidebar y los gates de UI se muestren al instante en cargas
// posteriores, mientras refrescamos en segundo plano contra Supabase.
// Nota: el `profile` queda fuera del caché a propósito — el nombre/avatar se
// lee siempre fresco para evitar mostrar datos antiguos durante unos cientos
// de ms tras editarlos.
interface AuthCache {
  roles: AppRole[];
  permisos: PermisoModulo[];
}
const LAST_USER_ID_KEY = "bh_last_user_id";
function authCacheKey(userId: string) {
  return `bh_auth_cache_${userId}`;
}
function readAuthCache(userId: string): AuthCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(authCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as AuthCache;
  } catch {
    return null;
  }
}
function writeAuthCache(userId: string, value: AuthCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(authCacheKey(userId), JSON.stringify(value));
  } catch {
    // quota / private mode → ignoramos
  }
}
function readLastCachedAuth(): AuthCache | null {
  if (typeof window === "undefined") return null;
  try {
    const lastUserId = window.localStorage.getItem(LAST_USER_ID_KEY);
    if (!lastUserId) return null;
    return readAuthCache(lastUserId);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy init: si en localStorage hay caché del último usuario, hidratamos roles
  // y permisos en el PRIMER render del provider. Sin esto, el sidebar se pinta
  // vacío durante ~100-500 ms hasta que onAuthStateChange dispare INITIAL_SESSION
  // dentro del useEffect (que corre tras el primer paint).
  const initialCache = readLastCachedAuth();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(initialCache?.roles ?? []);
  const [loading, setLoading] = useState(true);
  const [permisos, setPermisos] = useState<PermisoModulo[]>(initialCache?.permisos ?? []);
  const [permisosLoaded, setPermisosLoaded] = useState(initialCache !== null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Cada vez que el usuario inicia sesión, la app abre en "Mis Paneles".
        // Reseteamos el modo de vista persistido para que un cambio puntual a
        // "Mis Departamentos" no se herede en el siguiente login.
        if (event === "SIGNED_IN" && typeof window !== "undefined") {
          try {
            window.localStorage.setItem("bh_view_mode", "paneles");
            const maxAge = 365 * 24 * 60 * 60;
            document.cookie = `bh_view_mode=paneles; path=/; max-age=${maxAge}; samesite=lax`;
          } catch {
            // storage/cookies no disponibles → ignoramos
          }
        }

        if (session?.user) {
          const userId = session.user.id;

          // Marca este user como "último activo" para que en futuros mounts del
          // provider podamos hidratar roles/permisos desde caché ANTES del primer
          // render (ver readLastCachedAuth + lazy init de useState arriba).
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(LAST_USER_ID_KEY, userId);
            } catch {
              // ignore
            }
          }

          // 1) Hidratación instantánea desde localStorage si hay caché del usuario.
          //    Así el sidebar y los gates pueden filtrar al primer render — sin
          //    esperar a Supabase. El profile (nombre/avatar) NO se hidrata aquí
          //    para evitar mostrar valores antiguos: se carga fresco abajo.
          const cached = readAuthCache(userId);
          if (cached) {
            setRoles(cached.roles);
            setPermisos(cached.permisos);
            setPermisosLoaded(true);
            setLoading(false);
          }

          // 2) Refresco en paralelo (stale-while-revalidate). Profile y permisos
          //    en una sola tanda — getUserPermisos ya devuelve appRoles, así que
          //    no necesitamos una query extra a user_roles.
          setTimeout(async () => {
            const [profileRes, permisosRes] = await Promise.all([
              supabase
                .from("profiles")
                .select("nombre, apellidos, email, empresa_id, avatar_url, avatar_obligatorio, rol_label, departamento")
                .eq("user_id", userId)
                .single(),
              getUserPermisos().catch((e) => {
                console.error("[auth] error cargando permisos", e);
                return null;
              }),
            ]);

            const nextProfile = (profileRes.data as AuthProfile | null) ?? null;
            const fetchedRoles = (permisosRes?.appRoles ?? []) as AppRole[];
            const fetchedPermisos = permisosRes?.permisos ?? [];

            // Defensa: si el fetch llega vacío pero el caché previo tenía datos,
            // NO los borramos. Un getUserPermisos que falla silenciosamente (red,
            // admin client transitorio) devolvía `appRoles: []` y vaciaba el
            // sidebar y los gates como "No tienes departamentos asignados". La
            // fuente de verdad cuando todo va bien sigue siendo el fetch nuevo.
            const fetchFailedSilently =
              permisosRes !== null && fetchedRoles.length === 0 && (cached?.roles.length ?? 0) > 0;
            const nextRoles = fetchFailedSilently ? cached!.roles : fetchedRoles;
            const nextPermisos = fetchFailedSilently ? cached!.permisos : fetchedPermisos;

            if (fetchFailedSilently) {
              console.warn(
                "[auth] permisos vacíos en el fetch — manteniendo caché previo para no romper la UI",
              );
            }

            if (nextProfile) setProfile(nextProfile);
            setRoles(nextRoles);
            setPermisos(nextPermisos);
            setPermisosLoaded(true);
            setLoading(false);

            // Solo persistimos el caché si el fetch fue real. Así un fallo
            // transitorio no corrompe el localStorage para el próximo mount.
            if (!fetchFailedSilently) {
              writeAuthCache(userId, {
                roles: nextRoles,
                permisos: nextPermisos,
              });
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setPermisos([]);
          setPermisosLoaded(true);
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

    // Limpia el caché de permisos del usuario actual (privacidad si otro
    // usuario inicia sesión en el mismo navegador después).
    if (user?.id && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(authCacheKey(user.id));
        window.localStorage.removeItem(LAST_USER_ID_KEY);
      } catch {
        // ignore
      }
    }

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignoramos; seguimos con la limpieza de servidor
    }

    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);

    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    } catch {
      // Si falla el fetch, igual redirigimos
    }

    window.location.href = "/";
  }, [user?.id]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const canAccess = useCallback((path: string) => {
    if (roles.length === 0) return false;
    const modulo = getModuloFromPath(path);
    return roles.some((role) => {
      const allowed = ROLE_MODULES[role];
      return allowed.includes("*") || allowed.includes(modulo) || modulo === "ayuda";
    });
  }, [roles]);

  // Bypass total para 'director' — el rol más alto en este SaaS.
  // Para los demás roles se enforza empresa_roles.permisos. Si la lista de
  // permisos está vacía y el usuario no es director, no ve nada salvo dashboard.
  const puedeVer = useCallback((modulo: string) => {
    if (roles.includes("director") || roles.includes("admin")) return true;
    const target = normalizarModulo(modulo);
    return permisos.some((p) => p.ver && normalizarModulo(p.modulo) === target);
  }, [roles, permisos]);

  const puedeEditar = useCallback((modulo: string) => {
    if (roles.includes("director") || roles.includes("admin")) return true;
    const target = normalizarModulo(modulo);
    return permisos.some((p) => p.editar && normalizarModulo(p.modulo) === target);
  }, [roles, permisos]);

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading, permisos, permisosLoaded,
      signIn, signOut, hasRole, canAccess, puedeVer, puedeEditar,
    }}>
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
