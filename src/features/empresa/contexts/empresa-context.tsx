"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Incidencia, SAMPLE_DATA } from "@/features/empresa/data/mantenimiento";
import { AjustesEmpresa, buildDefaultAjustes, DatosGenerales, ConfigOperativa } from "@/features/ajustes/data/ajustes";
import { getLogoUrls } from "@/features/empresa/actions/logo-actions";
import { listEmpresasCompletas } from "@/features/empresa/actions/empresas-actions";

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

// Roles legados (forma departamento o genéricos). Si los detectamos en
// localStorage descartamos el snapshot y volvemos a sembrar con la forma persona.
const ROLES_OBSOLETOS = [
  "Administrador", "Solo lectura", "Dirección",
  "RRHH", "Logística", "Cocina", "Gerencia",
  "Contabilidad", "Gestoría", "Jurídico", "Marketing",
];

function migrateRoles(storedRoles: AjustesEmpresa["roles"], defaultRoles: AjustesEmpresa["roles"]): AjustesEmpresa["roles"] {
  const tieneRolesObsoletos = storedRoles.some((r) => ROLES_OBSOLETOS.includes(r.nombre));
  return tieneRolesObsoletos ? defaultRoles : storedRoles;
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
  setLogoUrl: (empresaSlug: string, url: string) => void;
  addEmpresa: (empresa: Empresa) => void;
  updateEmpresa: (id: string, data: Partial<Empresa>) => void;
  deleteEmpresa: (id: string) => void;
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresasList, setEmpresasList] = useState<Empresa[]>(EMPRESAS);
  const [empresaId, setEmpresaId] = useState(EMPRESAS[0].id);
  const [allData, setAllData] = useState<Record<string, Incidencia[]>>(buildInitialData);
  const [allAjustes, setAllAjustes] = useState<Record<string, AjustesEmpresa>>(buildInitialAjustes);
  // Logo URLs cargadas desde Supabase Storage (fuente de verdad)
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});

  // Cargar logos desde Supabase al montar
  useEffect(() => {
    getLogoUrls().then(setLogoUrls).catch(() => {});
  }, []);

  // Hidratar empresas + ajustes desde Supabase (fuente de verdad)
  useEffect(() => {
    let alive = true;
    listEmpresasCompletas()
      .then((rows) => {
        if (!alive || rows.length === 0) return;

        const list: Empresa[] = rows.map((r) => ({
          id: r.slug,
          dbId: r.id,
          nombre: r.nombre,
          iniciales: r.iniciales ?? r.nombre.slice(0, 2).toUpperCase(),
          color: r.color ?? "hsl(210 70% 50%)",
        }));

        setEmpresasList(list);
        setEmpresaId((prev) => list.some((e) => e.id === prev) ? prev : list[0].id);

        // Hidratar ajustes con lo que haya en Supabase, mergeado contra los defaults.
        setAllAjustes((prev) => {
          const next: Record<string, AjustesEmpresa> = { ...prev };
          for (const r of rows) {
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

  return (
    <EmpresaContext.Provider
      value={{ empresas: empresasList, empresaActual, setEmpresaId, datos, setDatos, ajustes, setAjustes, getLogoUrl, setLogoUrl, addEmpresa, updateEmpresa, deleteEmpresa }}
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
