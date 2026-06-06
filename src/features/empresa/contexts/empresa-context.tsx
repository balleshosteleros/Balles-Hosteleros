"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Incidencia, SAMPLE_DATA } from "@/features/empresa/data/mantenimiento";
import { AjustesEmpresa, buildDefaultAjustes, DatosGenerales, ConfigOperativa, mergeNotificaciones } from "@/features/ajustes/data/ajustes";
import { getLogoUrls, getIsotipoUrls } from "@/features/empresa/actions/logo-actions";
import { listEmpresasCompletas } from "@/features/empresa/actions/empresas-actions";
import { listEmpresasDeUsuario } from "@/features/empresa/actions/user-empresas-actions";
import { setEmpresaActiva, getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";
import { useGlobalLoading } from "@/shared/stores/use-global-loading";

export interface Empresa {
  id: string;       // slug — identificador lógico estable para FK en accesos_apps, etc.
  dbId?: string;    // UUID real en Supabase (cuando la empresa se hidrata desde BD)
  nombre: string;
  iniciales: string;
  color: string;
}

export const EMPRESAS: Empresa[] = [
  { id: "habana", nombre: "HABANA", iniciales: "HA", color: "hsl(340 70% 50%)" },
  { id: "bacanal", nombre: "BACANAL", iniciales: "BA", color: "hsl(210 70% 50%)" },
];

function buildInitialData(): Record<string, Incidencia[]> {
  const out: Record<string, Incidencia[]> = {};
  for (const e of EMPRESAS) {
    out[e.id] = SAMPLE_DATA.map((i) => ({
      ...i,
      id: `${e.id}-${i.id}`,
      actualizaciones: i.actualizaciones.map((a) => ({ ...a, id: `${e.id}-${a.id}` })),
    }));
  }
  return out;
}

const AJUSTES_STORAGE_KEY = "balles_ajustes_v1";
/**
 * Slug de la empresa activa en localStorage. Sobrevive a reinicios del dev
 * server y a limpiezas de cookie. Se usa SOLO como fallback cuando la cookie
 * `bh_empresa_activa` no existe — la cookie sigue siendo la fuente de verdad
 * para las server actions.
 */
const EMPRESA_ACTIVA_SLUG_KEY = "bh_empresa_activa_slug";

// Roles legados que detectamos en localStorage para descartar el snapshot
// y volver a sembrar desde defaults / Supabase.
//
// Cubre:
//   1) Forma genérica antigua: "Administrador", "Solo lectura"
//   2) Forma mixed-case antigua: "Dirección", "RRHH", "Cocina"…
//   3) Forma persona antigua (pre-migración 087): "DIRECTOR",
//      "JEFE DE COCINA", "RESPONSABLE RRHH", "ABOGADO", etc.
//
// Tras 087 el nombre del rol coincide con el del departamento (DIRECCIÓN,
// COCINA, RECURSOS HUMANOS, JURÍDICO…), así que cualquier nombre persona
// que aún quede en localStorage es basura y debe descartarse.
const ROLES_OBSOLETOS = [
  "Administrador", "Solo lectura", "Dirección",
  "RRHH", "Logística", "Cocina", "Gerencia",
  "Contabilidad", "Gestoría", "Jurídico", "Marketing",
  // Forma persona pre-087:
  "DIRECTOR",
  "RESPONSABLE RRHH",
  "JEFE DE LOGÍSTICA",
  "JEFE DE COCINA",
  "JEFE DE SALA",
  "GERENTE",
  "CONTABLE",
  "GESTOR",
  "ABOGADO",
  "RESPONSABLE MARKETING",
  "RESPONSABLE CALIDAD",
];

// Módulos en formato legacy (mixed-case). Si aparecen en permisos[].modulo
// quiere decir que el snapshot es de antes de la migración a uppercase
// — descartamos y volvemos a sembrar con los defaults canónicos.
const MODULOS_LEGACY = ["Dirección", "RRHH", "Logística", "Cocina", "Gerencia", "Contabilidad", "Gestoría", "Jurídico", "Marketing", "Ajustes", "Sala", "Calidad"];

function migrateRoles(storedRoles: AjustesEmpresa["roles"], defaultRoles: AjustesEmpresa["roles"]): AjustesEmpresa["roles"] {
  const tieneRolesObsoletos = storedRoles.some((r) => ROLES_OBSOLETOS.includes(r.nombre));
  if (tieneRolesObsoletos) return defaultRoles;
  const tienePermisosLegacy = storedRoles.some((r) =>
    r.permisos?.some((p) => MODULOS_LEGACY.includes(p.modulo))
  );
  return tienePermisosLegacy ? defaultRoles : storedRoles;
}

function mergeWithDefaults(stored: AjustesEmpresa, nombre: string): AjustesEmpresa {
  const defaults = buildDefaultAjustes(nombre);
  const storedRoles = stored.roles ?? [];
  return {
    ...defaults,
    ...stored,
    departamentos: stored.departamentos ?? defaults.departamentos,
    roles: storedRoles.length ? migrateRoles(storedRoles, defaults.roles) : defaults.roles,
    usuarios: stored.usuarios ?? defaults.usuarios,
    auditoria: stored.auditoria ?? defaults.auditoria,
    notificaciones: mergeNotificaciones(stored.notificaciones),
  };
}

function buildInitialAjustes(): Record<string, AjustesEmpresa> {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(AJUSTES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, AjustesEmpresa>;
        const migrated: Record<string, AjustesEmpresa> = {};
        for (const [id, data] of Object.entries(parsed)) {
          const nombre = data.datosGenerales?.nombreComercial ?? id.toUpperCase();
          migrated[id] = mergeWithDefaults(data, nombre);
        }
        return migrated;
      }
    } catch {}
  }
  const out: Record<string, AjustesEmpresa> = {};
  for (const e of EMPRESAS) {
    out[e.id] = buildDefaultAjustes(e.nombre);
  }
  return out;
}

interface EmpresaContextValue {
  empresas: Empresa[];
  empresaActual: Empresa;
  setEmpresaId: (id: string) => void;
  datos: Incidencia[];
  setDatos: (updater: (prev: Incidencia[]) => Incidencia[]) => void;
  ajustes: AjustesEmpresa;
  setAjustes: (updater: (prev: AjustesEmpresa) => AjustesEmpresa) => void;
  getLogoUrl: (empresaId: string) => string;
  getIsotipoUrl: (empresaId: string) => string;
  setLogoUrl: (empresaSlug: string, url: string) => void;
  setIsotipoUrl: (empresaSlug: string, url: string) => void;
  addEmpresa: (empresa: Empresa) => void;
  updateEmpresa: (id: string, data: Partial<Empresa>) => void;
  deleteEmpresa: (id: string) => void;
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isHydrated = useRef(false);
  const [, startTransition] = useTransition();
  const showLoading = useGlobalLoading((s) => s.show);
  const hideLoading = useGlobalLoading((s) => s.hide);
  const [empresasList, setEmpresasList] = useState<Empresa[]>(EMPRESAS);
  const [empresaId, setEmpresaId] = useState(EMPRESAS[0].id);
  const [allData, setAllData] = useState<Record<string, Incidencia[]>>(buildInitialData);
  const [allAjustes, setAllAjustes] = useState<Record<string, AjustesEmpresa>>(buildInitialAjustes);
  // Logo URLs cargadas desde Supabase Storage (fuente de verdad)
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [isotipoUrls, setIsotipoUrls] = useState<Record<string, string>>({});

  // Cargar logos + isotipos desde Supabase al montar
  useEffect(() => {
    getLogoUrls().then(setLogoUrls).catch(() => {});
    getIsotipoUrls().then(setIsotipoUrls).catch(() => {});
  }, []);

  // Hidratar empresas + ajustes desde Supabase (fuente de verdad).
  // El selector solo debe mostrar las empresas a las que el usuario logueado
  // tiene acceso (user_empresas). Si el usuario no tiene filas en user_empresas
  // (cuenta legacy o admin global), caemos al listado completo para no dejarle
  // sin acceso a nada.
  useEffect(() => {
    let alive = true;
    Promise.all([
      listEmpresasCompletas(),
      getEmpresaActivaId(),
      listEmpresasDeUsuario(),
    ])
      .then(([rows, activaDbId, userEmpresaIds]) => {
        if (!alive || rows.length === 0) return;

        const allowed = new Set(userEmpresaIds);
        const filtered = allowed.size > 0
          ? rows.filter((r) => allowed.has(r.id))
          : rows;
        const baseRows = filtered.length > 0 ? filtered : rows;

        const list: Empresa[] = baseRows.map((r) => ({
          id: r.slug,
          dbId: r.id,
          nombre: r.nombre,
          iniciales: r.iniciales ?? r.nombre.slice(0, 2).toUpperCase(),
          color: r.color ?? "hsl(210 70% 50%)",
        }));

        setEmpresasList(list);

        const matchByCookie = activaDbId ? list.find((e) => e.dbId === activaDbId) : null;
        if (matchByCookie) {
          setEmpresaId(matchByCookie.id);
        } else {
          // Sin cookie: 2ª preferencia es el slug que dejamos en localStorage la
          // última vez que el usuario eligió empresa. Evita que un reinicio del
          // dev server (o limpieza de cookies) te tire a la empresa principal
          // del perfil cuando llevas trabajando en otra.
          let restoredSlug: string | null = null;
          if (typeof window !== "undefined") {
            try {
              restoredSlug = window.localStorage.getItem(EMPRESA_ACTIVA_SLUG_KEY);
            } catch {
              // ignore
            }
          }
          const restored = restoredSlug
            ? list.find((e) => e.id === restoredSlug)
            : null;
          if (restored) {
            setEmpresaId(restored.id);
            // Re-arma la cookie para que las server actions vean la empresa
            // correcta sin esperar a que el usuario vuelva a hacer click.
            if (restored.dbId) {
              setEmpresaActiva(restored.dbId).catch(() => {});
            }
          } else {
            setEmpresaId((prev) => list.some((e) => e.id === prev) ? prev : list[0].id);
          }
        }
        isHydrated.current = true;

        // Hidratar ajustes con lo que haya en Supabase, mergeado contra los defaults.
        setAllAjustes((prev) => {
          const next: Record<string, AjustesEmpresa> = { ...prev };
          for (const r of baseRows) {
            const defaults = buildDefaultAjustes(r.nombre);
            const stored = prev[r.slug];
            const baseAjustes = stored ? mergeWithDefaults(stored, r.nombre) : defaults;
            next[r.slug] = {
              ...baseAjustes,
              datosGenerales: {
                ...baseAjustes.datosGenerales,
                ...(r.datosGenerales as Partial<DatosGenerales>),
                logoUrl: r.logoUrl ?? baseAjustes.datosGenerales.logoUrl,
              },
              configOperativa: {
                ...baseAjustes.configOperativa,
                ...(r.configOperativa as Partial<ConfigOperativa>),
              },
            };
          }
          return next;
        });
      })
      .catch((err) => {
        console.error("[empresa-context] hidratación falló:", err);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AJUSTES_STORAGE_KEY, JSON.stringify(allAjustes));
    } catch {}
  }, [allAjustes]);

  const empresaActual = empresasList.find((e) => e.id === empresaId) ?? empresasList[0];
  const datos = allData[empresaId] ?? [];
  const ajustes = allAjustes[empresaId]
    ? mergeWithDefaults(allAjustes[empresaId], empresaActual.nombre)
    : buildDefaultAjustes(empresaActual.nombre);

  const setDatos = useCallback(
    (updater: (prev: Incidencia[]) => Incidencia[]) => {
      setAllData((prev) => ({ ...prev, [empresaId]: updater(prev[empresaId] ?? []) }));
    },
    [empresaId],
  );

  const setAjustes = useCallback(
    (updater: (prev: AjustesEmpresa) => AjustesEmpresa) => {
      setAllAjustes((prev) => {
        const base = prev[empresaId]
          ? mergeWithDefaults(prev[empresaId], empresaActual.nombre)
          : buildDefaultAjustes(empresaActual.nombre);
        return { ...prev, [empresaId]: updater(base) };
      });
    },
    [empresaId, empresaActual.nombre],
  );

  // Supabase es la fuente de verdad; localStorage es fallback temporal
  const getLogoUrl = useCallback(
    (eid: string) => logoUrls[eid] ?? allAjustes[eid]?.datosGenerales?.logoUrl ?? "",
    [logoUrls, allAjustes],
  );

  // Isotipo (icono sin texto) — fallback al logo completo si no hay isotipo.
  const getIsotipoUrl = useCallback(
    (eid: string) =>
      isotipoUrls[eid] ?? logoUrls[eid] ?? allAjustes[eid]?.datosGenerales?.logoUrl ?? "",
    [isotipoUrls, logoUrls, allAjustes],
  );

  // Actualiza el logo en el contexto inmediatamente tras subir/eliminar
  const setLogoUrl = useCallback((empresaSlug: string, url: string) => {
    setLogoUrls((prev) => ({ ...prev, [empresaSlug]: url }));
    // Sincronizar también en ajustes para coherencia interna
    setAllAjustes((prev) => ({
      ...prev,
      [empresaSlug]: {
        ...(prev[empresaSlug] ?? buildDefaultAjustes(empresaSlug.toUpperCase())),
        datosGenerales: {
          ...(prev[empresaSlug]?.datosGenerales ?? buildDefaultAjustes(empresaSlug.toUpperCase()).datosGenerales),
          logoUrl: url,
        },
      },
    }));
  }, []);

  // Actualiza el isotipo en el contexto inmediatamente tras subir/eliminar.
  // url vacío = limpiar (al borrar el isotipo el avatar cae al logo).
  const setIsotipoUrl = useCallback((empresaSlug: string, url: string) => {
    setIsotipoUrls((prev) => {
      if (!url) {
        const { [empresaSlug]: _ignored, ...rest } = prev;
        return rest;
      }
      return { ...prev, [empresaSlug]: url };
    });
  }, []);

  const addEmpresa = useCallback((empresa: Empresa) => {
    setEmpresasList((prev) => [...prev, empresa]);
    setAllData((prev) => ({
      ...prev,
      [empresa.id]: SAMPLE_DATA.map((i) => ({
        ...i,
        id: `${empresa.id}-${i.id}`,
        actualizaciones: i.actualizaciones.map((a) => ({ ...a, id: `${empresa.id}-${a.id}` })),
      })),
    }));
    setAllAjustes((prev) => ({ ...prev, [empresa.id]: buildDefaultAjustes(empresa.nombre) }));
  }, []);

  const updateEmpresa = useCallback((id: string, data: Partial<Empresa>) => {
    setEmpresasList((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const deleteEmpresa = useCallback((id: string) => {
    setEmpresasList((prev) => prev.filter((e) => e.id !== id));
    setAllData((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setAllAjustes((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const handleSetEmpresaId = useCallback((id: string) => {
    setEmpresaId(id);
    // Persistimos el slug elegido para que sobreviva a una pérdida de cookie.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(EMPRESA_ACTIVA_SLUG_KEY, id);
      } catch {
        // ignore
      }
    }
    if (!isHydrated.current) return;
    const empresa = empresasList.find((e) => e.id === id);
    if (!empresa?.dbId) return;
    showLoading("Cambiando de empresa…");
    setEmpresaActiva(empresa.dbId)
      .then((res) => {
        if (!res.ok) {
          hideLoading();
          return;
        }
        startTransition(() => {
          router.refresh();
        });
        // El re-render de los Server Components no es awaitable directamente:
        // damos margen prudente para que la UI rehidratada se pinte y luego
        // apagamos el overlay. Si la cookie cambia más rápido, el detector
        // de navegación o el usuario percibirán la transición igualmente.
        window.setTimeout(() => hideLoading(), 900);
      })
      .catch((err) => {
        console.error("[empresa-context] setEmpresaActiva:", err);
        hideLoading();
      });
  }, [empresasList, router, showLoading, hideLoading]);

  return (
    <EmpresaContext.Provider
      value={{ empresas: empresasList, empresaActual, setEmpresaId: handleSetEmpresaId, datos, setDatos, ajustes, setAjustes, getLogoUrl, getIsotipoUrl, setLogoUrl, setIsotipoUrl, addEmpresa, updateEmpresa, deleteEmpresa }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa must be used within EmpresaProvider");
  return ctx;
}
