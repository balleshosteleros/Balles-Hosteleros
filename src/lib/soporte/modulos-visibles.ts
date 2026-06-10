import "server-only";

import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { MODULOS_CANONICOS, MODULO_GENERAL } from "@/lib/soporte/modulos";

/**
 * Candado de rol (PRP-055), calculado en SERVIDOR.
 *
 * `puedeVer()` vive en el AuthContext (cliente) y NUNCA debe confiarse desde el
 * navegador. Aquí replicamos su lógica a partir de `getUserPermisos()`:
 *   - director/admin → ven TODOS los módulos canónicos.
 *   - resto → los módulos con `ver=true` en su rol.
 *   - SIEMPRE se añade GENERAL (contenido universal: agenda, cómo usar la app…).
 *
 * Devolvemos los nombres canónicos CON acento (LOGÍSTICA, GESTORÍA…) porque la
 * RPC compara por igualdad exacta contra `soporte_conocimiento.modulo`.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

function normalizar(m: string): string {
  return m.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

// Mapa: forma normalizada (sin acento) → nombre canónico con acento.
const CANONICO_POR_NORMALIZADO = new Map(
  MODULOS_CANONICOS.map((m) => [normalizar(m), m]),
);

export interface ModulosVisibles {
  userId: string | null;
  empresaId: string | null;
  /** Nombres canónicos (con acento) que el rol puede ver + GENERAL. */
  modulos: string[];
  esGlobal: boolean; // director/admin
}

export async function getModulosVisibles(): Promise<ModulosVisibles> {
  const { permisos, empresaId, appRoles } = await getUserPermisos();

  const esGlobal = appRoles.includes("director") || appRoles.includes("admin");

  const set = new Set<string>();
  if (esGlobal) {
    for (const m of MODULOS_CANONICOS) set.add(m);
  } else {
    for (const p of permisos) {
      if (!p.ver) continue;
      const canonico = CANONICO_POR_NORMALIZADO.get(normalizar(p.modulo));
      if (canonico) set.add(canonico);
    }
  }
  // Contenido universal: siempre visible.
  set.add(MODULO_GENERAL);

  return {
    userId: null, // lo resuelve el route handler (tiene el user de la sesión)
    empresaId,
    modulos: [...set],
    esGlobal,
  };
}
