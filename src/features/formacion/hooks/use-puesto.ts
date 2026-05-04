"use client";

// Hook que decide el puesto del empleado en el portal de formación.
// En producción debería leerse del registro de empleado (ficha laboral).
// Aquí: persistencia ligera en localStorage por usuario, con un setter
// para que el empleado/admin elijan o simulen su puesto.

import { useCallback, useEffect, useState } from "react";
import { PUESTOS, type Puesto } from "../types";

const STORAGE_KEY = "balles_formacion_puesto_v1";

export function usePuestoActual(userKey: string): {
  puesto: Puesto;
  setPuesto: (p: Puesto) => void;
  ready: boolean;
} {
  const [puesto, setPuestoState] = useState<Puesto>("CAMARERO");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, Puesto>) : {};
      const stored = map[userKey];
      if (stored && PUESTOS.includes(stored)) {
        setPuestoState(stored);
      }
    } catch {
      // localStorage corrupto → usamos el default
    }
    setReady(true);
  }, [userKey]);

  const setPuesto = useCallback(
    (p: Puesto) => {
      setPuestoState(p);
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map = raw ? (JSON.parse(raw) as Record<string, Puesto>) : {};
        map[userKey] = p;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      } catch (err) {
        console.error("[formacion] no se pudo guardar el puesto", err);
      }
    },
    [userKey],
  );

  return { puesto, setPuesto, ready };
}
