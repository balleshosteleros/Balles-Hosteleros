"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * Tema visual de la vista de Reservas (claro / oscuro azul marino).
 *
 * El resto del software es de tema CLARO y no hay ThemeProvider global. Este
 * hook resuelve el tema SOLO para la vista de sala: la clase se aplica al
 * contenedor raíz de la vista (ver `.sala-tema` en globals.css), nunca a
 * <html>, para no arrastrar a los demás módulos.
 *
 * La preferencia se guarda en localStorage. Como el servidor no puede conocer
 * ese valor, el primer render siempre es "claro" y solo tras montar se aplica
 * el guardado: así no hay desajuste de hidratación.
 *
 * Ese ajuste se hace ANTES de pintar. Con un `useEffect` normal, quien tuviera
 * guardado el tema oscuro veía un fogonazo claro al entrar en Reservas, que
 * parecía una pantalla distinta antes de llegar a la suya (Iván, 30-ago).
 */
export type SalaTema = "claro" | "oscuro";

const STORAGE_KEY = "sala:tema";

function leerTemaGuardado(): SalaTema | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "claro" || v === "oscuro" ? v : null;
  } catch {
    // Safari en modo privado puede lanzar al leer localStorage.
    return null;
  }
}

/**
 * En el navegador se aplica ANTES de pintar; en el servidor no hay pintado, así
 * que allí se usa el effect normal (`useLayoutEffect` avisaría por consola).
 */
const useEffectAntesDePintar =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useSalaTema() {
  const [tema, setTemaState] = useState<SalaTema>("claro");
  const [mounted, setMounted] = useState(false);

  useEffectAntesDePintar(() => {
    const guardado = leerTemaGuardado();
    if (guardado) setTemaState(guardado);
    setMounted(true);
  }, []);

  const setTema = useCallback((next: SalaTema) => {
    setTemaState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin persistencia el tema sigue funcionando en la sesión actual.
    }
  }, []);

  const alternarTema = useCallback(() => {
    setTema(tema === "oscuro" ? "claro" : "oscuro");
  }, [tema, setTema]);

  return {
    /** Tema efectivo. Antes de montar siempre es "claro" (coincide con el SSR). */
    tema: mounted ? tema : ("claro" as SalaTema),
    esOscuro: mounted && tema === "oscuro",
    mounted,
    setTema,
    alternarTema,
  };
}
