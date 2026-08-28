"use client";

import { useEffect } from "react";
import { useModoInmersivo } from "@/features/layout/contexts/modo-inmersivo-context";

/**
 * Activa el modo inmersivo (barra superior replegada) mientras la vista esté
 * montada y `activo` sea true, y lo apaga al desmontarse.
 *
 * El apagado en la limpieza es lo importante: sin él, salir de Reservas a otro
 * módulo dejaría el resto del software sin barra superior.
 */
export function useModoInmersivoActivo(activo: boolean) {
  const { setInmersivo } = useModoInmersivo();

  useEffect(() => {
    setInmersivo(activo);
    return () => setInmersivo(false);
  }, [activo, setInmersivo]);
}
