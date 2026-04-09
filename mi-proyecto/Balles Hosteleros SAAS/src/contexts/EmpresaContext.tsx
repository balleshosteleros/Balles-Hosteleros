import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Incidencia, SAMPLE_DATA } from "@/data/mantenimiento";
import { AjustesEmpresa, buildDefaultAjustes } from "@/data/ajustes";

export interface Empresa {
  id: string;
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

function buildInitialAjustes(): Record<string, AjustesEmpresa> {
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
  addEmpresa: (empresa: Empresa) => void;
  updateEmpresa: (id: string, data: Partial<Empresa>) => void;
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresasList, setEmpresasList] = useState<Empresa[]>(EMPRESAS);
  const [empresaId, setEmpresaId] = useState(EMPRESAS[0].id);
  const [allData, setAllData] = useState<Record<string, Incidencia[]>>(buildInitialData);
  const [allAjustes, setAllAjustes] = useState<Record<string, AjustesEmpresa>>(buildInitialAjustes);

  const empresaActual = empresasList.find((e) => e.id === empresaId) ?? empresasList[0];
  const datos = allData[empresaId] ?? [];
  const ajustes = allAjustes[empresaId] ?? buildDefaultAjustes(empresaActual.nombre);

  const setDatos = useCallback(
    (updater: (prev: Incidencia[]) => Incidencia[]) => {
      setAllData((prev) => ({ ...prev, [empresaId]: updater(prev[empresaId] ?? []) }));
    },
    [empresaId],
  );

  const setAjustes = useCallback(
    (updater: (prev: AjustesEmpresa) => AjustesEmpresa) => {
      setAllAjustes((prev) => ({ ...prev, [empresaId]: updater(prev[empresaId] ?? buildDefaultAjustes(empresaActual.nombre)) }));
    },
    [empresaId, empresaActual.nombre],
  );
  const getLogoUrl = useCallback(
    (eid: string) => allAjustes[eid]?.datosGenerales?.logoUrl ?? "",
    [allAjustes],
  );

  const addEmpresa = useCallback((empresa: Empresa) => {
    setEmpresasList((prev) => [...prev, empresa]);
    setAllData((prev) => ({ ...prev, [empresa.id]: SAMPLE_DATA.map((i) => ({ ...i, id: `${empresa.id}-${i.id}`, actualizaciones: i.actualizaciones.map((a) => ({ ...a, id: `${empresa.id}-${a.id}` })) })) }));
    setAllAjustes((prev) => ({ ...prev, [empresa.id]: buildDefaultAjustes(empresa.nombre) }));
  }, []);

  const updateEmpresa = useCallback((id: string, data: Partial<Empresa>) => {
    setEmpresasList((prev) => prev.map((e) => e.id === id ? { ...e, ...data } : e));
  }, []);

  return (
    <EmpresaContext.Provider value={{ empresas: empresasList, empresaActual, setEmpresaId, datos, setDatos, ajustes, setAjustes, getLogoUrl, addEmpresa, updateEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa must be used within EmpresaProvider");
  return ctx;
}
