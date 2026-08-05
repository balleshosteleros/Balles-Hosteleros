"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, ReactNode, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";
import type { PermisoModulo } from "@/features/ajustes/data/ajustes";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import {
  puedeVerModulo,
  puedeEditarModulo,
  puedeVerHerramienta,
  esHerramientaBarra,
  tieneAccesoDepartamentos as calcAccesoDepartamentos,
} from "@/features/auth/lib/permisos";

// Etiqueta técnica LEGACY. La visibilidad de departamentos/módulos NO se decide
// por estos valores, sino por permisos reales (`permisos` + `esAdminPlataforma`,
// ver features/auth/lib/permisos.ts). Se conserva solo para lectores antiguos.
export type AppRole = "admin" | "director" | "gerencia" | "responsable" | "empleado" | "solo_lectura";

/**
 * Modo de vista (Mis Paneles / Mis Departamentos) POR DEFECTO, derivado de los
 * permisos. Es un DEFAULT, no una imposición: si el usuario ya eligió una vista
 * con el conmutador, su elección manda y esto no la toca.
 *
 * Antes se escribía `bh_view_mode` de forma incondicional en cada arranque (aquí
 * y en el seed de servidor), así que el clic del usuario en "Mis Departamentos"
 * quedaba pisado por el siguiente ciclo de auth y volvía solo a "Mis Paneles".
 */
function aplicarModoVistaPorDefecto(accesoDepartamentos: boolean) {
  if (typeof window === "undefined") return;
  try {
    // Elección explícita previa → se respeta, no se recalcula.
    const guardado = window.localStorage.getItem("bh_view_mode");
    if (guardado === "paneles" || guardado === "departamentos") return;

    const modo = accesoDepartamentos ? "departamentos" : "paneles";
    window.localStorage.setItem("bh_view_mode", modo);
    const maxAge = 365 * 24 * 60 * 60;
    document.cookie = `bh_view_mode=${modo}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // storage/cookies no disponibles → ignoramos
  }
}

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
  /** Rol con `es_admin_plataforma` (DIRECCIÓN): bypass total de permisos. */
  esAdminPlataforma: boolean;
  /** Tiene ≥1 departamento visible (o es admin): ve "Mis Departamentos". */
  tieneAccesoDepartamentos: boolean;
  /**
   * VEREDICTO del servidor sobre el acceso a departamentos:
   *   - `null`  → todavía no se ha pronunciado (caché de localStorage, carrera
   *               de cookies del arranque, seed parcial). NO se puede concluir
   *               nada: ni que tienes acceso ni que te lo han quitado.
   *   - `true`  → confirmado con acceso.
   *   - `false` → confirmado SIN acceso (p. ej. DIRECCIÓN te quitó el último
   *               departamento) → los gates deben expulsar de inmediato.
   *
   * Los gates que EXPULSAN (p. ej. Mis Departamentos) deben leer ESTO y no
   * `tieneAccesoDepartamentos`: ese refleja el estado en curso, que durante el
   * arranque oscila mientras llegan las distintas oleadas de permisos, y
   * cualquier bajada momentánea a false disparaba un rebote indebido.
   */
  accesoDeptosServidor: boolean | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  puedeVer: (modulo: string) => boolean;
  puedeEditar: (modulo: string) => boolean;
}


export const AuthContext = createContext<AuthContextValue | null>(null);

// Compara dos listas de permisos por contenido (módulo + ver + editar), sin
// depender del orden. Se usa para detectar si los permisos del servidor
// difieren de los que ya tiene el cliente y hay que refrescar la UI en vivo.
function mismosPermisos(a: PermisoModulo[], b: PermisoModulo[]): boolean {
  if (a.length !== b.length) return false;
  const clave = (p: PermisoModulo) => `${p.modulo}|${p.ver ? 1 : 0}|${p.editar ? 1 : 0}`;
  const setA = new Set(a.map(clave));
  return b.every((p) => setA.has(clave(p)));
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
interface AuthCache {
  roles: AppRole[];
  permisos: PermisoModulo[];
  esAdminPlataforma: boolean;
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

// ── Caché del PERFIL (nombre, apellidos, avatar, rol_label) ─────────────────
// Igual patrón stale-while-revalidate que los permisos: se pinta al instante
// desde localStorage y se refresca en segundo plano. Así el nombre + rol + foto
// del avatar aparecen a la vez que el resto de la cabecera, en vez de mostrar
// "—" y un avatar vacío durante los cientos de ms que tarda la query a
// Supabase. Si el usuario edita su nombre/avatar, el fetch fresco lo corrige en
// el mismo render (por eso el dato cacheado nunca queda "pegado").
function profileCacheKey(userId: string) {
  return `bh_profile_cache_${userId}`;
}
function readProfileCache(userId: string): AuthProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(profileCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as AuthProfile;
  } catch {
    return null;
  }
}
function writeProfileCache(userId: string, value: AuthProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(profileCacheKey(userId), JSON.stringify(value));
  } catch {
    // quota / private mode → ignoramos
  }
}
function readLastCachedProfile(): AuthProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const lastUserId = window.localStorage.getItem(LAST_USER_ID_KEY);
    if (!lastUserId) return null;
    return readProfileCache(lastUserId);
  } catch {
    return null;
  }
}

// ── Seed de permisos resueltos en SERVIDOR ──────────────────────────────────
// El layout de (main) (server component, con la sesión ya validada) resuelve
// roles+permisos durante el render SSR y los inyecta aquí ANTES del primer
// paint del cliente. Así el menú es visible en el primer render SIEMPRE —
// incluido el PRIMER login, donde no hay caché localStorage y hasta ahora el
// sidebar esperaba a que getUserPermisos saliera la ÚLTIMA de la cola
// serializada de server actions del arranque (~3-6 s medidos en prod).
// El refresh stale-while-revalidate de loadFreshAuth sigue corriendo igual.
export interface AuthServerSeedPayload {
  userId: string;
  roles: AppRole[];
  permisos: PermisoModulo[];
  esAdminPlataforma: boolean;
  /**
   * Perfil (nombre, apellidos, rol_label, avatar) resuelto también en SERVIDOR.
   * Sin esto, la cabecera se quedaba en blanco / "—" durante el arranque: el
   * perfil solo se pedía desde el navegador, dentro de onAuthStateChange y
   * detrás de un Promise.all que además esperaba a los permisos. Al sembrarlo
   * aquí, el nombre + rol + foto se pintan en el mismo render que el menú.
   */
  profile?: AuthProfile | null;
  /**
   * `false` cuando el servidor resolvió el perfil pero NO los permisos (carrera
   * de cookies: empresaId null). En ese caso sembramos solo la cabecera y
   * dejamos que el cliente resuelva los permisos con sus reintentos, sin
   * aplicar ni cachear una lista vacía que borraría el menú.
   */
  permisosValidos?: boolean;
}

const AuthSeedContext = createContext<((p: AuthServerSeedPayload) => void) | null>(null);

// useLayoutEffect en cliente (corre antes del paint); en SSR no hace nada y
// useEffect evita el warning de React en el render de servidor.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AuthServerSeed({ payload }: { payload: AuthServerSeedPayload }) {
  const seed = useContext(AuthSeedContext);
  useIsoLayoutEffect(() => {
    seed?.(payload);
    // payload es un objeto nuevo en cada render del layout; el seed es
    // idempotente (no-op si los permisos ya están cargados), así que no hace
    // falta memoizarlo.
  }, [seed, payload]);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy init: si en localStorage hay caché del último usuario, hidratamos roles
  // y permisos en el PRIMER render del provider. Sin esto, el sidebar se pinta
  // vacío durante ~100-500 ms hasta que onAuthStateChange dispare INITIAL_SESSION
  // dentro del useEffect (que corre tras el primer paint).
  const initialCache = readLastCachedAuth();
  const initialProfile = readLastCachedProfile();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // El perfil (nombre/rol/avatar) se hidrata del caché en el primer render para
  // que la cabecera lo muestre al instante; el fetch fresco lo revalida abajo.
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [roles, setRoles] = useState<AppRole[]>(initialCache?.roles ?? []);
  // Si hay caché del último usuario, arrancamos SIN loading: roles y permisos ya
  // están hidratados desde el primer render, así que la UI (sidebar, gates,
  // cuadrícula de "Mis Departamentos") se pinta al instante. El refresco
  // stale-while-revalidate corre igualmente en segundo plano dentro del effect.
  // Sin esto, un director cacheado se quedaba en skeleton hasta que el server
  // action getUserPermisos resolvía (auth.getUser + 2 queries + posibles
  // reintentos por la carrera de cookies) — varios cientos de ms innecesarios.
  const [loading, setLoading] = useState(initialCache === null);
  const [permisos, setPermisos] = useState<PermisoModulo[]>(initialCache?.permisos ?? []);
  const [esAdminPlataforma, setEsAdminPlataforma] = useState<boolean>(
    initialCache?.esAdminPlataforma ?? false,
  );
  const [permisosLoaded, setPermisosLoaded] = useState(initialCache !== null);
  // VEREDICTO del servidor sobre el acceso a departamentos, no una bandera
  // suelta. Guardamos el resultado JUNTO a su origen fiable: `null` = el
  // servidor todavía no se ha pronunciado (caché, carrera de cookies, seed
  // parcial); `true`/`false` = respuesta fiable con `empresaId` resuelto.
  //
  // Va como un único valor —y no como "confirmado" + "tieneAcceso" por
  // separado— justo porque esos dos se marcaban en ramas con condiciones
  // distintas y podían desincronizarse: bastaba con que el flag quedara en true
  // sobre permisos degradados de otra oleada para que el gate expulsara a un
  // usuario legítimo. Con un solo valor eso es imposible por construcción.
  const [accesoDeptosServidor, setAccesoDeptosServidor] = useState<boolean | null>(null);

  // Refs espejo del estado de permisos: permiten que la revalidación en vivo
  // compare contra el valor ACTUAL sin re-suscribir su effect en cada cambio.
  const permisosRef = useRef(permisos);
  const esAdminPlataformaRef = useRef(esAdminPlataforma);
  useEffect(() => {
    permisosRef.current = permisos;
    esAdminPlataformaRef.current = esAdminPlataforma;
  }, [permisos, esAdminPlataforma]);

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

        // El modo de vista por defecto se sincroniza con el ROL una vez resuelto
        // (ver setViewModePorRol dentro de loadFreshAuth): director → "departamentos",
        // resto → "paneles". No lo forzamos aquí en SIGNED_IN porque todavía no
        // conocemos el rol; hacerlo a "paneles" hacía que un director arrancara en
        // el modo equivocado y tuviera que rebotar.

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
          //    Así el sidebar, los gates y la cabecera (nombre/rol/avatar) se
          //    pintan al primer render — sin esperar a Supabase. El fetch fresco
          //    de abajo revalida todo (y corrige nombre/avatar si se editaron).
          const cached = readAuthCache(userId);
          if (cached) {
            setRoles(cached.roles);
            setPermisos(cached.permisos);
            setEsAdminPlataforma(cached.esAdminPlataforma ?? false);
            setPermisosLoaded(true);
            setLoading(false);
          }
          const cachedProfile = readProfileCache(userId);
          if (cachedProfile) setProfile(cachedProfile);

          // 2) Refresco en paralelo (stale-while-revalidate). Profile y permisos
          //    en una sola tanda — getUserPermisos ya devuelve appRoles, así que
          //    no necesitamos una query extra a user_roles.
          //    Reintenta si el fetch llega "en blanco" por una carrera con la
          //    propagación de cookies justo tras el login (ver loadFreshAuth).
          const loadFreshAuth = async (attempt: number) => {
            const [profileRes, permisosRes] = await Promise.all([
              supabase
                .from("usuarios")
                .select("nombre, apellidos, email, empresa_id, avatar_url, avatar_obligatorio, rol_label, departamento")
                .eq("user_id", userId)
                .single()
                // Nunca dejamos que un rechazo de esta query rompa el Promise.all
                // y deje la UI colgada en skeleton (permisosLoaded sin marcar).
                .then((r) => r, (e) => {
                  console.error("[auth] error cargando perfil", e);
                  return { data: null };
                }),
              // Pasamos el access_token de la sesión para que el server action
              // valide al usuario sin depender de las cookies (que tras el
              // redirect del login pueden no estar propagadas → carrera que
              // dejaba el dashboard vacío). Ver getRolContext.
              getUserPermisos(session.access_token).catch((e) => {
                console.error("[auth] error cargando permisos", e);
                return null;
              }),
            ]);

            const nextProfile = (profileRes.data as AuthProfile | null) ?? null;
            const fetchedRoles = (permisosRes?.appRoles ?? []) as AppRole[];
            const fetchedPermisos = permisosRes?.permisos ?? [];
            const fetchedEsAdmin = permisosRes?.esAdminPlataforma ?? false;

            // El PERFIL (nombre/rol/avatar) y los PERMISOS son fetches
            // independientes. El perfil se aplica SIEMPRE que llegue, sin esperar
            // a los permisos: antes se descartaba un perfil válido si el fetch de
            // permisos fallaba (return temprano abajo), y la cabecera se quedaba
            // en "—" y avatar vacío aunque el perfil sí hubiera cargado.
            if (nextProfile) {
              setProfile(nextProfile);
              writeProfileCache(userId, nextProfile);
            }

            // Race justo tras el login: el server action corre antes de que las
            // cookies de sesión estén propagadas, así que auth.getUser() devuelve
            // null y getUserPermisos retorna empresaId null + appRoles []. Sin
            // caché previo (p.ej. incógnito) eso pintaba "No tienes departamentos"
            // en falso. Mientras parezca un fallo de carrera, NO marcamos como
            // cargado: mantenemos el skeleton y reintentamos con backoff corto.
            // (El perfil ya se aplicó arriba; esto solo afecta a permisos.)
            const looksRaceFailure =
              permisosRes === null || permisosRes.empresaId == null;
            if (looksRaceFailure && attempt < 3) {
              setTimeout(() => loadFreshAuth(attempt + 1), 250 * (attempt + 1));
              return;
            }

            // Defensa adicional: si el fetch llega vacío pero el caché previo tenía
            // datos, NO los borramos (fallo silencioso de red / admin transitorio).
            const fetchFailedSilently =
              permisosRes !== null && fetchedRoles.length === 0 && (cached?.roles.length ?? 0) > 0;
            const nextRoles = fetchFailedSilently ? cached!.roles : fetchedRoles;
            const nextPermisos = fetchFailedSilently ? cached!.permisos : fetchedPermisos;
            const nextEsAdmin = fetchFailedSilently
              ? (cached!.esAdminPlataforma ?? false)
              : fetchedEsAdmin;

            if (fetchFailedSilently) {
              console.warn(
                "[auth] permisos vacíos en el fetch — manteniendo caché previo para no romper la UI",
              );
            }

            setRoles(nextRoles);
            setPermisos(nextPermisos);
            setEsAdminPlataforma(nextEsAdmin);
            setPermisosLoaded(true);
            setLoading(false);

            // Respuesta FIABLE del servidor (no carrera, no fallback a caché):
            // registramos su veredicto sobre departamentos, calculado sobre los
            // MISMOS datos que acabamos de aplicar arriba.
            if (!looksRaceFailure && !fetchFailedSilently) {
              setAccesoDeptosServidor(
                calcAccesoDepartamentos(nextEsAdmin, nextPermisos),
              );
            }

            // Sincroniza el modo de vista INICIAL con los PERMISOS reales:
            // quien tiene acceso a ≥1 departamento (o es admin de plataforma)
            // arranca en "departamentos"; el resto en "paneles". Así respetamos
            // los roles reales de Ajustes, sin nombres técnicos hardcodeados.
            aplicarModoVistaPorDefecto(
              calcAccesoDepartamentos(nextEsAdmin, nextPermisos),
            );

            // Solo persistimos el caché si el fetch fue real. Así un fallo
            // transitorio no corrompe el localStorage para el próximo mount.
            if (!fetchFailedSilently && !looksRaceFailure) {
              writeAuthCache(userId, {
                roles: nextRoles,
                permisos: nextPermisos,
                esAdminPlataforma: nextEsAdmin,
              });
            }
          };
          setTimeout(() => loadFreshAuth(0), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setPermisos([]);
          setEsAdminPlataforma(false);
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

  // ── Revalidación EN VIVO de permisos ────────────────────────────────────
  // Mantiene los permisos al día SIN reloguear ni refrescar: si un director
  // cambia el rol de un usuario en Ajustes, la UI de ese usuario se actualiza
  // sola. Dispara una recarga contra el servidor cuando:
  //   - la pestaña vuelve a estar visible (volver a la ventana), y
  //   - de forma periódica (cada 60 s) mientras la pestaña está activa.
  // Solo aplica el resultado si los permisos DIFIEREN de los actuales y traen
  // datos reales (no pisa el menú con un fetch en blanco por carrera de red).
  useEffect(() => {
    const userId = user?.id;
    const accessToken = session?.access_token;
    if (!userId) return;

    let cancelado = false;

    const revalidar = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      let res: Awaited<ReturnType<typeof getUserPermisos>> | null = null;
      try {
        res = await getUserPermisos(accessToken);
      } catch {
        return; // fallo transitorio de red → reintentamos en el próximo tick
      }
      if (cancelado || !res || res.empresaId == null) return;

      const nextPermisos = res.permisos ?? [];
      const nextEsAdmin = res.esAdminPlataforma ?? false;
      const nextRoles = (res.appRoles ?? []) as AppRole[];
      const seedTieneDatos = nextEsAdmin || nextPermisos.length > 0;
      if (!seedTieneDatos) return;

      // La respuesta ya pasó el filtro `empresaId != null` de arriba: es fiable.
      // Registramos el veredicto ANTES del early-return por "sin cambios",
      // porque una revalidación que CONFIRMA los permisos vigentes es tan válida
      // como una que los corrige — si no, un usuario estable (cuyos permisos
      // nunca cambian) no quedaba confirmado jamás.
      setAccesoDeptosServidor(calcAccesoDepartamentos(nextEsAdmin, nextPermisos));

      // Aplicamos SOLO si algo cambió (comparando con el valor actual vía refs),
      // para no re-renderizar en balde.
      const cambio =
        nextEsAdmin !== esAdminPlataformaRef.current ||
        !mismosPermisos(nextPermisos, permisosRef.current);
      if (!cambio) return;

      setRoles(nextRoles);
      setPermisos(nextPermisos);
      setEsAdminPlataforma(nextEsAdmin);
      writeAuthCache(userId, {
        roles: nextRoles,
        permisos: nextPermisos,
        esAdminPlataforma: nextEsAdmin,
      });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") revalidar();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", revalidar);
    const intervalo = window.setInterval(revalidar, 60_000);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", revalidar);
      window.clearInterval(intervalo);
    };
  }, [user?.id, session?.access_token]);

  // Aplica el seed de permisos resuelto EN SERVIDOR (layout de (main), con la
  // sesión ya validada). Se aplica en dos situaciones:
  //   1) Aún no hay permisos cargados o roles vacíos (primer paint / vuelta del
  //      login) — igual que antes.
  //   2) Los permisos del servidor DIFIEREN de los del cliente — así, al
  //      REFRESCAR la página tras cambiar permisos en Ajustes, se ven al
  //      instante SIN reloguear (el caché de localStorage ya no "gana").
  // En ambos casos exigimos que el seed traiga datos REALES (permisos no vacíos
  // o es admin de plataforma): un seed en blanco por la carrera de cookies no
  // debe borrar el menú.
  const seedFromServer = useCallback((p: AuthServerSeedPayload) => {
    // El PERFIL se aplica SIEMPRE que el servidor lo mande, sin condicionarlo a
    // los permisos: es el dato que pinta nombre + rol + foto en la cabecera y
    // llega ya validado con la sesión de servidor. Así deja de aparecer vacío
    // durante el arranque (antes esperaba al fetch del navegador).
    if (p.profile) {
      setProfile(p.profile);
      writeProfileCache(p.userId, p.profile);
    }

    // Seed de solo-perfil (permisos no resueltos en servidor): la cabecera ya
    // quedó sembrada arriba; no tocamos permisos ni su caché.
    if (p.permisosValidos === false) return;

    const seedTieneDatos = p.esAdminPlataforma || p.permisos.length > 0;
    const difiere =
      p.esAdminPlataforma !== esAdminPlataforma ||
      !mismosPermisos(p.permisos, permisos);
    const debeAplicar =
      !permisosLoaded || roles.length === 0 || (seedTieneDatos && difiere);

    if (debeAplicar) {
      setRoles(p.roles);
      setPermisos(p.permisos);
      setEsAdminPlataforma(p.esAdminPlataforma);
      setPermisosLoaded(true);
      setLoading(false);
      // El veredicto va SIEMPRE junto a los permisos que lo justifican, en el
      // mismo bloque y calculado sobre ELLOS. Marcarlo por separado (con
      // `seedTieneDatos`, condición distinta de `debeAplicar`) dejaba el flag en
      // true sobre permisos degradados de otra oleada: el gate veía "confirmado
      // + sin acceso" y expulsaba a un usuario legítimo.
      if (seedTieneDatos) {
        setAccesoDeptosServidor(
          calcAccesoDepartamentos(p.esAdminPlataforma, p.permisos),
        );
      }
      // Sincroniza el MODO DE VISTA con los PERMISOS reales, igual que
      // loadFreshAuth. Sin esto, quien tiene acceso a departamentos veía el menú
      // al instante pero en modo "paneles" hasta que el SWR corregía — y si
      // navegaba en ese estado transitorio, acababa rebotado.
      aplicarModoVistaPorDefecto(
        calcAccesoDepartamentos(p.esAdminPlataforma, p.permisos),
      );
    }
    writeAuthCache(p.userId, {
      roles: p.roles,
      permisos: p.permisos,
      esAdminPlataforma: p.esAdminPlataforma,
    });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LAST_USER_ID_KEY, p.userId);
      } catch {
        // ignore
      }
    }
  }, [permisosLoaded, roles, permisos, esAdminPlataforma]);

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
        window.localStorage.removeItem(profileCacheKey(user.id));
        window.localStorage.removeItem(LAST_USER_ID_KEY);
        // El modo de vista es una preferencia POR USUARIO. Al cerrar sesión hay
        // que soltarla: si no, el siguiente que entre en este navegador hereda
        // la vista del anterior y `aplicarModoVistaPorDefecto` la respetaría
        // como si fuera suya, aterrizando en la vista equivocada.
        window.localStorage.removeItem("bh_view_mode");
        document.cookie = "bh_view_mode=; path=/; max-age=0; samesite=lax";
      } catch {
        // ignore
      }
    }

    // El estado local se vacía YA: la sesión está muerta desde este momento,
    // independientemente de lo que tarden las llamadas de limpieza.
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setEsAdminPlataforma(false);

    // Cerrar sesión NUNCA puede quedarse colgado (reportado por Iván, 05-ago).
    // Antes eran dos llamadas EN SERIE y SIN tope: con la red lenta o el servidor
    // ocupado, el usuario se quedaba atrapado dentro de la app. Ahora van en
    // paralelo, con 3 s de tope cada una, y se sale pase lo que pase.
    const salir = () => {
      window.location.href = "/";
    };
    const rescate = setTimeout(salir, 3500);

    const conTope = <T,>(p: Promise<T>, ms = 3000) =>
      Promise.race([p, new Promise((r) => setTimeout(r, ms))]).catch(() => null);

    await Promise.allSettled([
      supabase ? conTope(supabase.auth.signOut()) : Promise.resolve(),
      conTope(
        fetch("/api/auth/signout", {
          method: "POST",
          credentials: "include",
          // La ruta responde 302; sin esto `fetch` lo sigue y descarga la home
          // entera antes de continuar.
          redirect: "manual",
          keepalive: true,
        }),
      ),
    ]);

    clearTimeout(rescate);
    salir();
  }, [user?.id]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  // FUENTE ÚNICA de permisos: admin de plataforma (DIRECCIÓN) ve todo; el resto
  // según `empresa_roles.permisos`. Sin nombres de rol técnicos hardcodeados.
  // EXCEPCIÓN — herramientas de barra (CÁMARAS, cohete, candado): mandan SIEMPRE
  // su toggle real, sin bypass de admin. Si dirección apaga CÁMARAS en Ajustes →
  // Roles, deja de ver el icono aunque sea admin de plataforma.
  const puedeVer = useCallback((modulo: string) => {
    if (esHerramientaBarra(modulo)) return puedeVerHerramienta(permisos, modulo);
    return puedeVerModulo(esAdminPlataforma, permisos, modulo);
  }, [esAdminPlataforma, permisos]);

  const puedeEditar = useCallback((modulo: string) => {
    return puedeEditarModulo(esAdminPlataforma, permisos, modulo);
  }, [esAdminPlataforma, permisos]);

  // ¿Ve la vista "Mis Departamentos"? Admin de plataforma o con ≥1 departamento
  // permitido. Un rol sin ningún departamento no ve ni el conmutador.
  const tieneAccesoDepartamentos = calcAccesoDepartamentos(esAdminPlataforma, permisos);

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading, permisos, permisosLoaded,
      esAdminPlataforma, tieneAccesoDepartamentos, accesoDeptosServidor,
      signIn, signOut, hasRole, puedeVer, puedeEditar,
    }}>
      <AuthSeedContext.Provider value={seedFromServer}>
        {children}
      </AuthSeedContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
