"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  addTareaMultiEmpresa,
  updateTareaMultiEmpresa,
  deleteTareaMultiEmpresa,
} from "../actions/cronograma-multiempresa-actions";

export type Frecuencia = "DIARIO" | "SEMANAL" | "MENSUAL" | "TRIMESTRAL" | "ANUAL" | "POR NECESIDAD" | "OTRO";

export interface CronogramaOperativo {
  id: string;
  rol: string;
  /** Departamento al que pertenece el puesto. Nullable en filas legacy. */
  departamento?: string | null;
  tarea: string;
  frecuencia: Frecuencia | string;
  formacion?: string;
  tiempo_requerido?: string;
  id_tarea_original?: string;
  resumen?: string | null;
  video_url?: string | null;
  id_visible?: string | null;
  parent_id?: string | null;
  orden?: number;
  empresa_id?: string | null;
  /** Identificador estable que enlaza la "misma tarea" entre empresas del grupo. */
  clave_tarea?: string | null;
  // Calendario (PRP-032)
  dia_semana?: number[] | null;          // ISO 1=lun..7=dom (SEMANAL)
  dia_mes?: number | null;                // 1-31 (MENSUAL / TRIMESTRAL)
  fecha_anual?: string | null;            // 'MM-DD' (ANUAL)
  meses_trimestrales?: number[] | null;   // default [1,4,7,10]
  empleados_asignados?: string[] | null;  // null = todos los del rol
  // Periodicidad estilo Google Calendar
  intervalo?: number | null;              // cada N unidades (default 1)
  termina_tipo?: TerminaTipo | null;      // null = nunca
  termina_fecha?: string | null;          // 'YYYY-MM-DD' si termina_tipo='fecha'
  termina_repeticiones?: number | null;   // si termina_tipo='repeticiones'
  fecha_inicio?: string | null;           // 'YYYY-MM-DD' ancla del intervalo
}

export type TerminaTipo = "fecha" | "repeticiones";

import { fallbackCronogramas } from "../data/cronogramasMockData";

export function useCronogramasOperativos() {
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual?.dbId ?? null;

  const [data, setData] = useState<CronogramaOperativo[]>(() =>
    fallbackCronogramas.map((it, idx) => ({
      ...it,
      id: it.id ? `${it.id}-${it.rol}-${idx}` : `mock-${idx}`,
    })),
  );
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const fetchCronogramas = useCallback(async () => {
    setIsLoading(true);

    let query = supabase
      .from("cronogramas_operativos")
      .select("*")
      .order("rol", { ascending: true })
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    // Si tenemos empresa activa con dbId, filtramos por ella.
    if (empresaDbId) {
      query = query.eq("empresa_id", empresaDbId);
    }

    const { data: result, error } = await query;

    if (!error && result && result.length > 0) {
      setData(result as CronogramaOperativo[]);
    } else if (!empresaDbId) {
      // Solo caemos al mock si NO hay empresa activa (modo dev/landing).
      const sanitized = fallbackCronogramas.map((it, idx) => ({
        ...it,
        id: it.id ? `${it.id}-${it.rol}-${idx}` : `mock-${idx}`,
      }));
      setData(sanitized);
    } else {
      // Empresa activa sin tareas → lista vacía
      setData([]);
    }
    setIsLoading(false);
  }, [supabase, empresaDbId]);

  useEffect(() => {
    fetchCronogramas();
  }, [fetchCronogramas]);

  /**
   * Crea una tarea en N empresas a la vez. Devuelve la `clave_tarea` que
   * une todas las réplicas, útil para el caller si quiere encadenar acciones.
   */
  const addTareaMulti = useCallback(
    async (input: {
      base: Partial<CronogramaOperativo>;
      empresaIds: string[];
      parentClaveTarea?: string | null;
    }) => {
      const res = await addTareaMultiEmpresa(input);
      if (res.ok) await fetchCronogramas();
      return res;
    },
    [fetchCronogramas],
  );

  /**
   * Aplica el mismo patch a la tarea (identificada por `clave_tarea`) en las
   * empresas seleccionadas.
   */
  const updateTareaMulti = useCallback(
    async (input: {
      claveTarea: string;
      empresaIds: string[];
      patch: Partial<CronogramaOperativo>;
    }) => {
      const res = await updateTareaMultiEmpresa(input);
      if (res.ok) await fetchCronogramas();
      return res;
    },
    [fetchCronogramas],
  );

  /**
   * Elimina la tarea (y sus subtareas) en las empresas seleccionadas.
   */
  const deleteTareaMulti = useCallback(
    async (input: { claveTarea: string; empresaIds: string[] }) => {
      const res = await deleteTareaMultiEmpresa(input);
      if (res.ok) await fetchCronogramas();
      return res;
    },
    [fetchCronogramas],
  );

  return {
    data,
    isLoading,
    addTareaMulti,
    updateTareaMulti,
    deleteTareaMulti,
    refresh: fetchCronogramas,
  };
}
