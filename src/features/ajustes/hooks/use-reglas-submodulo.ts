"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getReglaSubmodulo } from "@/features/ajustes/actions/reglas-submodulo-actions";
import {
  camposObligatoriosEfectivos,
  esSubmoduloMigrable,
  getSubmodulo,
  type ReglaSubmoduloRow,
} from "@/features/ajustes/lib/reglas-submodulos-catalogo";

/**
 * Hook que cualquier formulario "Nuevo" puede consultar para saber qué
 * campos son obligatorios según las reglas del admin.
 *
 * Lógica:
 *   - Si hay una regla de submódulo personalizada → su lista de campos manda.
 *   - Si no → se usan los campos obligatorios por defecto del submódulo.
 */
export function useReglasSubmodulo(moduloKey: string, submoduloKey: string) {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  const [reglaSub, setReglaSub] = useState<ReglaSubmoduloRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReglaSubmodulo(moduloKey, submoduloKey, empresaDbId).then((s) => {
      if (cancelled) return;
      setReglaSub(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [moduloKey, submoduloKey, empresaDbId]);

  // La regla de submódulo personalizada manda; si no, default del catálogo.
  const camposPersonalizados = reglaSub?.campos_obligatorios ?? [];

  /** Devuelve qué campos faltan en el formData según las reglas. */
  const validar = useCallback(
    (formData: Record<string, unknown>): { keysFaltantes: string[]; labelsFaltantes: string[] } => {
      const submodulo = getSubmodulo(moduloKey, submoduloKey);
      if (!submodulo) return { keysFaltantes: [], labelsFaltantes: [] };

      const requeridos = camposObligatoriosEfectivos(submodulo, reglaSub);
      const faltantes: string[] = [];

      for (const key of requeridos) {
        const valor = formData[key];
        const vacio =
          valor === null ||
          valor === undefined ||
          (typeof valor === "string" && valor.trim() === "") ||
          (Array.isArray(valor) && valor.length === 0);
        if (vacio) faltantes.push(key);
      }

      const labels = faltantes.map((k) => {
        const campo = submodulo.campos.find((c) => c.key === k);
        return campo?.label ?? k;
      });

      return { keysFaltantes: faltantes, labelsFaltantes: labels };
    },
    [moduloKey, submoduloKey, reglaSub],
  );

  /** Keys de los campos requeridos. Vacío mientras carga. */
  const keysRequeridos = useMemo<string[]>(() => {
    const submodulo = getSubmodulo(moduloKey, submoduloKey);
    if (!submodulo) return [];
    return camposObligatoriosEfectivos(submodulo, reglaSub);
  }, [moduloKey, submoduloKey, reglaSub]);

  /** Indica si un campo concreto es obligatorio. */
  const esRequerido = useCallback(
    (key: string): boolean => keysRequeridos.includes(key),
    [keysRequeridos],
  );

  /**
   * Indica si este submódulo admite estado "Borrador" (Migración con IA).
   * El resto del software NO permite registros incompletos.
   */
  const admiteBorrador = useMemo(
    () => esSubmoduloMigrable(moduloKey, submoduloKey),
    [moduloKey, submoduloKey],
  );

  return {
    camposPersonalizados,
    loading,
    validar,
    /** Nuevo — útil para componentes UI que necesitan saber si pintar `*`. */
    esRequerido,
    /** Nuevo — array con todas las keys requeridas (para mostrar contador, etc.). */
    keysRequeridos,
    /** Nuevo — true solo para las 5 entidades migrables. */
    admiteBorrador,
  };
}
