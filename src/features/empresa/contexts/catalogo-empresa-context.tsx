"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  moduloDisponibleEnEmpresa,
  type CatalogoEmpresa,
} from "@/features/auth/lib/permisos";

/**
 * Qué módulos OFRECE la empresa activa.
 *
 * No confundir con los permisos del rol (auth-context): aquellos dicen qué
 * puede ver una persona, este dice qué existe en la empresa en la que está.
 * Hacen falta los dos para pintar el menú.
 *
 * El dato lo resuelve el layout de (main) en SERVIDOR y se siembra aquí antes
 * del primer render: sin fetch en el navegador y sin parpadeo. Como ese layout
 * es `force-dynamic` y se re-ejecuta al cambiar de empresa, el catálogo siempre
 * es el de la empresa activa.
 */
const CatalogoEmpresaContext = createContext<CatalogoEmpresa>({
  departamentos: [],
  esMatriz: false,
});

export function CatalogoEmpresaProvider({
  departamentos,
  esMatriz,
  children,
}: {
  departamentos: string[];
  esMatriz: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ departamentos, esMatriz }),
    [departamentos, esMatriz],
  );
  return (
    <CatalogoEmpresaContext.Provider value={value}>
      {children}
    </CatalogoEmpresaContext.Provider>
  );
}

/** Catálogo crudo de la empresa activa (departamentos + si es la matriz). */
export function useCatalogoEmpresa(): CatalogoEmpresa {
  return useContext(CatalogoEmpresaContext);
}

/**
 * `moduloDisponible(modulo)` para la empresa activa. Combínalo SIEMPRE con el
 * permiso del rol: `moduloDisponible(m) && puedeVer(m)`.
 */
export function useModuloDisponible(): (modulo: string) => boolean {
  const catalogo = useCatalogoEmpresa();
  return useMemo(
    () => (modulo: string) => moduloDisponibleEnEmpresa(modulo, catalogo),
    [catalogo],
  );
}
