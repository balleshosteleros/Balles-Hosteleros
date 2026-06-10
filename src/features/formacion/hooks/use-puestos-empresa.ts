"use client";

// Carga los puestos reales de la empresa activa (id + nombre) para los
// selectores del panel admin de formación.

import { useEffect, useState } from "react";
import { listPuestosFormacion } from "../actions/formacion-actions";
import type { PuestoRef } from "../types";

export function usePuestosEmpresa(): { puestos: PuestoRef[]; ready: boolean } {
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    listPuestosFormacion().then((r) => {
      if (!alive) return;
      setPuestos(r.ok ? r.data : []);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { puestos, ready };
}
