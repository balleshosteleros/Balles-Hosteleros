"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type EstadoEjecucion = "pendiente" | "hecha" | "omitida";

export interface CronogramaEjecucion {
  id: string;
  tarea_id: string;
  empresa_id: string | null;
  user_id: string;
  fecha_programada: string; // YYYY-MM-DD
  estado: EstadoEjecucion;
  confirmada_en: string | null;
  nota: string | null;
  created_at: string;
  updated_at: string;
}

export interface EjecucionConTarea extends CronogramaEjecucion {
  tarea?: {
    id: string;
    tarea: string;
    rol: string;
    frecuencia: string;
    tiempo_requerido?: string | null;
    resumen?: string | null;
    video_url?: string | null;
  };
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Hook de ejecuciones para el empleado autenticado.
 * - Siembra lazy las del día.
 * - Devuelve tareas de HOY + pendientes últimos 30 días.
 */
export function useCronogramaEjecuciones() {
  const [hoy, setHoy] = useState<EjecucionConTarea[]>([]);
  const [pendientes, setPendientes] = useState<EjecucionConTarea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const hoyIso = toISODate(new Date());
      const hace30 = new Date();
      hace30.setDate(hace30.getDate() - 30);
      const desdeIso = toISODate(hace30);

      // 1) Siembra lazy (idempotente)
      try {
        await supabase.rpc("seed_cronograma_ejecuciones", {
          p_fecha_desde: hoyIso,
          p_fecha_hasta: hoyIso,
        });
      } catch (e) {
        console.warn("[ejecuciones] seed RPC no disponible aún:", e);
      }

      // 2) Traer ejecuciones últimas 30 días con JOIN manual
      const { data: ejecData, error: ejecError } = await supabase
        .from("cronograma_ejecuciones")
        .select(
          "id, tarea_id, empresa_id, user_id, fecha_programada, estado, confirmada_en, nota, created_at, updated_at"
        )
        .gte("fecha_programada", desdeIso)
        .lte("fecha_programada", hoyIso)
        .order("fecha_programada", { ascending: false });

      if (ejecError) throw ejecError;
      const rawEjec = (ejecData ?? []) as CronogramaEjecucion[];

      if (rawEjec.length === 0) {
        setHoy([]);
        setPendientes([]);
        setIsLoading(false);
        return;
      }

      const tareaIds = Array.from(new Set(rawEjec.map((e) => e.tarea_id)));
      const { data: tareasData, error: tareasError } = await supabase
        .from("cronogramas_operativos")
        .select("id, tarea, rol, frecuencia, tiempo_requerido, resumen, video_url")
        .in("id", tareaIds);

      if (tareasError) throw tareasError;
      const tareasMap = new Map(
        (tareasData ?? []).map((t) => [t.id as string, t as EjecucionConTarea["tarea"]])
      );

      const enriched: EjecucionConTarea[] = rawEjec.map((e) => ({
        ...e,
        tarea: tareasMap.get(e.tarea_id),
      }));

      const deHoy = enriched.filter((e) => e.fecha_programada === hoyIso);
      const pendAntes = enriched.filter(
        (e) => e.fecha_programada < hoyIso && e.estado === "pendiente"
      );

      setHoy(deHoy);
      setPendientes(pendAntes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ejecuciones] Error:", msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const confirmar = useCallback(
    async (id: string, estado: EstadoEjecucion = "hecha", nota?: string) => {
      try {
        const patch: Partial<CronogramaEjecucion> = {
          estado,
          confirmada_en: estado === "hecha" ? new Date().toISOString() : null,
          nota: nota ?? null,
        };
        const { error } = await supabase
          .from("cronograma_ejecuciones")
          .update(patch)
          .eq("id", id);
        if (error) throw error;

        const applyPatch = (arr: EjecucionConTarea[]) =>
          arr.map((e) => (e.id === id ? { ...e, ...patch } as EjecucionConTarea : e));
        setHoy((prev) => applyPatch(prev));
        setPendientes((prev) =>
          estado === "hecha" ? prev.filter((e) => e.id !== id) : applyPatch(prev)
        );
        return { ok: true as const };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[ejecuciones] confirmar error:", msg);
        return { ok: false as const, error: msg };
      }
    },
    [supabase]
  );

  return {
    hoy,
    pendientes,
    isLoading,
    error,
    refresh: fetchAll,
    confirmar,
  };
}
