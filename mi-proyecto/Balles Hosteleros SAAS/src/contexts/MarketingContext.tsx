import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ItemCalendario, CuentaConectada, buildSamplePublicaciones, buildSampleCuentas } from "@/data/marketing";
import { EMPRESAS } from "@/contexts/EmpresaContext";

interface MarketingContextValue {
  items: Record<string, ItemCalendario[]>;
  cuentas: Record<string, CuentaConectada[]>;
  getItems: (empresaId: string) => ItemCalendario[];
  setItems: (empresaId: string, updater: (prev: ItemCalendario[]) => ItemCalendario[]) => void;
  getCuentas: (empresaId: string) => CuentaConectada[];
  setCuentas: (empresaId: string, updater: (prev: CuentaConectada[]) => CuentaConectada[]) => void;
}

function buildInitial() {
  const items: Record<string, ItemCalendario[]> = {};
  const cuentas: Record<string, CuentaConectada[]> = {};
  for (const e of EMPRESAS) {
    items[e.id] = buildSamplePublicaciones(e.id);
    cuentas[e.id] = buildSampleCuentas(e.id);
  }
  return { items, cuentas };
}

const MarketingContext = createContext<MarketingContextValue | null>(null);

export function MarketingProvider({ children }: { children: ReactNode }) {
  const initial = buildInitial();
  const [items, setAllItems] = useState(initial.items);
  const [cuentas, setAllCuentas] = useState(initial.cuentas);

  const getItems = useCallback((eid: string) => items[eid] ?? [], [items]);
  const setItems = useCallback((eid: string, updater: (prev: ItemCalendario[]) => ItemCalendario[]) => {
    setAllItems((prev) => ({ ...prev, [eid]: updater(prev[eid] ?? []) }));
  }, []);
  const getCuentas = useCallback((eid: string) => cuentas[eid] ?? [], [cuentas]);
  const setCuentas = useCallback((eid: string, updater: (prev: CuentaConectada[]) => CuentaConectada[]) => {
    setAllCuentas((prev) => ({ ...prev, [eid]: updater(prev[eid] ?? []) }));
  }, []);

  return (
    <MarketingContext.Provider value={{ items, cuentas, getItems, setItems, getCuentas, setCuentas }}>
      {children}
    </MarketingContext.Provider>
  );
}

export function useMarketing() {
  const ctx = useContext(MarketingContext);
  if (!ctx) throw new Error("useMarketing must be used within MarketingProvider");
  return ctx;
}
