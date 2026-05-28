"use client";

import { useEffect, useState } from "react";
import {
  listUnidadesMedida,
  listFormatosMedida,
  listIvas,
  listConservaciones,
} from "@/features/logistica/actions/catalogos-estandar-actions";
import {
  UNIDADES_PRODUCTO,
  IVA_OPCIONES,
  CONSERVACION_OPCIONES,
  FORMATOS_POR_UNIDAD,
} from "@/features/logistica/data/productos";

export interface CatalogosLogistica {
  unidades: Array<{ value: string; label: string }>;
  ivas: string[];
  conservaciones: string[];
  /** Map codigo unidad → lista de formatos. Si la unidad no está, devuelve [] al consultar. */
  formatosPorUnidad: Record<string, string[]>;
  /** True hasta que la primera carga de BD completa. */
  cargando: boolean;
}

const FALLBACK: Omit<CatalogosLogistica, "cargando"> = {
  unidades: [...UNIDADES_PRODUCTO],
  ivas: [...IVA_OPCIONES],
  conservaciones: [...CONSERVACION_OPCIONES],
  formatosPorUnidad: FORMATOS_POR_UNIDAD,
};

/**
 * Lee los catálogos estándar (unidades, formatos por unidad, ivas, conservaciones)
 * desde Supabase. Si la BD aún no tiene datos para esta empresa, cae a las
 * constantes de código para que la UI nunca quede vacía mientras la migración termina.
 *
 * Una sola llamada por mount; ideal para usar en formularios.
 */
export function useCatalogosLogistica(): CatalogosLogistica {
  const [estado, setEstado] = useState<CatalogosLogistica>({
    ...FALLBACK,
    cargando: true,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listUnidadesMedida(),
      listFormatosMedida(),
      listIvas(),
      listConservaciones(),
    ]).then(([uRes, fRes, ivaRes, conRes]) => {
      if (cancelled) return;

      const unidades = uRes.ok && uRes.data.length > 0
        ? uRes.data.map((u) => ({ value: u.codigo, label: u.label }))
        : FALLBACK.unidades;

      // formatos: agrupar por unidad_id, después indexar por codigo de unidad.
      const formatosPorUnidad: Record<string, string[]> = {};
      if (fRes.ok && fRes.data.length > 0 && uRes.ok) {
        const unidadIdToCodigo = new Map(uRes.data.map((u) => [u.id, u.codigo]));
        for (const f of fRes.data) {
          const cod = unidadIdToCodigo.get(f.unidad_id);
          if (!cod) continue;
          if (!formatosPorUnidad[cod]) formatosPorUnidad[cod] = [];
          formatosPorUnidad[cod].push(f.nombre);
        }
      }

      const ivas = ivaRes.ok && ivaRes.data.length > 0
        ? ivaRes.data.map((i) => i.codigo)
        : FALLBACK.ivas;

      const conservaciones = conRes.ok && conRes.data.length > 0
        ? conRes.data.map((c) => c.nombre)
        : FALLBACK.conservaciones;

      setEstado({
        unidades,
        ivas,
        conservaciones,
        formatosPorUnidad: Object.keys(formatosPorUnidad).length > 0
          ? formatosPorUnidad
          : FALLBACK.formatosPorUnidad,
        cargando: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return estado;
}
