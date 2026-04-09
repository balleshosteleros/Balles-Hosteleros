import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ArticuloAyuda, ConsultaPendiente, buildDefaultArticulos } from "@/features/ajustes/data/ayuda";

interface AyudaContextValue {
  articulos: ArticuloAyuda[];
  setArticulos: React.Dispatch<React.SetStateAction<ArticuloAyuda[]>>;
  consultas: ConsultaPendiente[];
  setConsultas: React.Dispatch<React.SetStateAction<ConsultaPendiente[]>>;
  addConsulta: (c: ConsultaPendiente) => void;
  resolverConsulta: (id: string, articuloId?: string) => void;
  currentUserRol: string;
  setCurrentUserRol: (rol: string) => void;
}

const AyudaContext = createContext<AyudaContextValue | null>(null);

export function AyudaProvider({ children }: { children: ReactNode }) {
  const [articulos, setArticulos] = useState<ArticuloAyuda[]>(buildDefaultArticulos);
  const [consultas, setConsultas] = useState<ConsultaPendiente[]>([]);
  const [currentUserRol, setCurrentUserRol] = useState("Administrador");

  const addConsulta = useCallback((c: ConsultaPendiente) => {
    setConsultas((prev) => [c, ...prev]);
  }, []);

  const resolverConsulta = useCallback((id: string, articuloId?: string) => {
    setConsultas((prev) =>
      prev.map((c) => c.id === id ? { ...c, estado: "resuelta" as const, articuloGeneradoId: articuloId } : c)
    );
  }, []);

  return (
    <AyudaContext.Provider value={{ articulos, setArticulos, consultas, setConsultas, addConsulta, resolverConsulta, currentUserRol, setCurrentUserRol }}>
      {children}
    </AyudaContext.Provider>
  );
}

export function useAyuda() {
  const ctx = useContext(AyudaContext);
  if (!ctx) throw new Error("useAyuda must be used within AyudaProvider");
  return ctx;
}
