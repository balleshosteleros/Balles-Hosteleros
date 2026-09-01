"use client";

import { useEffect, useLayoutEffect } from "react";
import { useModoInmersivo } from "@/features/layout/contexts/modo-inmersivo-context";

/**
 * En el navegador se aplica ANTES de pintar; en el servidor no hay pintado, así
 * que allí se usa el effect normal (`useLayoutEffect` avisaría por consola).
 */
const useEffectAntesDePintar =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Activa el modo inmersivo (barra superior replegada) mientras la vista esté
 * montada y `activo` sea true, y lo apaga al desmontarse.
 *
 * El apagado en la limpieza es lo importante: sin él, salir de Reservas a otro
 * módulo dejaría el resto del software sin barra superior.
 *
 * Va ANTES del pintado a propósito. Con un `useEffect` normal, el primer
 * fotograma de Reservas salía con la barra superior desplegada y al instante
 * se replegaba: ese salto se leía como si el software hubiera pasado un
 * momento por la pantalla de Configuración, que es donde la barra sí baja
 * (Iván, 30-ago).
 */
export function useModoInmersivoActivo(activo: boolean) {
  const { setInmersivo } = useModoInmersivo();

  useEffectAntesDePintar(() => {
    setInmersivo(activo);
    return () => setInmersivo(false);
  }, [activo, setInmersivo]);
}
