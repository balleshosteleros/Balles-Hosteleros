"use client";

import { useCallback, useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getReglaModulo,
  getReglaSubmodulo,
} from "@/features/ajustes/actions/reglas-submodulo-actions";
import {
  camposExigidos,
  getSubmodulo,
  type ModoReglas,
  type ReglaSubmoduloRow,
} from "@/features/ajustes/lib/reglas-submodulos-catalogo";

/**
 * Hook que cualquier formulario "Nuevo" puede consultar para saber qué
 * campos son obligatorios según las reglas del admin.
 *
 * Lógica de herencia:
 *   - Si la regla del MÓDULO es Básico/Estándar/Avanzado → ese modo manda
 *     y los campos exigidos vienen del preset correspondiente del submódulo.
 *   - Si la regla del MÓDULO es Personalizado (o no existe) → se usa la
 *     regla del SUBMÓDULO (Básico/Estándar/Avanzado/Personalizado).
 *   - Si tampoco hay regla de submódulo → default 'estandar'.
 */
export function useReglasSubmodulo(moduloKey: string, submoduloKey: string) {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual.dbId;

  const [reglaModulo, setReglaModulo] = useState<ReglaSubmoduloRow | null>(null);
  const [reglaSub, setReglaSub] = useState<ReglaSubmoduloRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getReglaModulo(moduloKey, empresaDbId),
      getReglaSubmodulo(moduloKey, submoduloKey, empresaDbId),
    ]).then(([m, s]) => {
      if (cancelled) return;
      setReglaModulo(m);
      setReglaSub(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [moduloKey, submoduloKey, empresaDbId]);

  // Modo efectivo: si el módulo está en preset (no personalizado), gana.
  const modoModulo: ModoReglas = reglaModulo?.modo ?? "personalizado";
  const modoSub: ModoReglas = reglaSub?.modo ?? "estandar";
  const camposPersonalizados = reglaSub?.campos_obligatorios ?? [];
  const modoEfectivo: ModoReglas =
    modoModulo === "personalizado" ? modoSub : modoModulo;

  /** Devuelve qué campos faltan en el formData según el modo efectivo. */
  const validar = useCallback(
    (formData: Record<string, unknown>): { keysFaltantes: string[]; labelsFaltantes: string[] } => {
      const submodulo = getSubmodulo(moduloKey, submoduloKey);
      if (!submodulo) return { keysFaltantes: [], labelsFaltantes: [] };

      const requeridos = camposExigidos(submodulo, modoEfectivo, camposPersonalizados);
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
    [moduloKey, submoduloKey, modoEfectivo, camposPersonalizados],
  );

  return {
    modoModulo,
    modoSub,
    modoEfectivo,
    camposPersonalizados,
    loading,
    validar,
  };
}
