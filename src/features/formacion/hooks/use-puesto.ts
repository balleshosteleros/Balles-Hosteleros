"use client";

// Hook que decide el/los puesto(s) del empleado en el portal de formación.
// Ahora lee los PUESTOS REALES del empleado (tabla empleado_puestos → puestos)
// vía server action. Mantiene un setter para que el admin pueda previsualizar
// el portal como otro puesto (no se persiste; es solo de vista).

import { useCallback, useEffect, useState } from "react";
import { getMisPuestosNombres } from "../actions/formacion-actions";
import type { Puesto } from "../types";

export function usePuestoActual(_userKey: string): {
  puesto: Puesto | null;
  /** Todos los puestos reales del empleado (para multi-puesto). */
  puestos: Puesto[];
  setPuesto: (p: Puesto) => void;
  ready: boolean;
} {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [puesto, setPuestoState] = useState<Puesto | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getMisPuestosNombres().then((r) => {
      if (!alive) return;
      const lista = r.ok ? r.data : [];
      setPuestos(lista);
      setPuestoState(lista[0] ?? null);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Previsualización: el admin puede mirar el portal como si fuera otro puesto.
  const setPuesto = useCallback((p: Puesto) => setPuestoState(p), []);

  return { puesto, puestos, setPuesto, ready };
}
