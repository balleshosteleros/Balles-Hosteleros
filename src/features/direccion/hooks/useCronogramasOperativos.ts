"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Frecuencia = "DIARIO" | "SEMANAL" | "MENSUAL" | "TRIMESTRAL" | "ANUAL" | "POR NECESIDAD" | "OTRO";

export interface CronogramaOperativo {
  id: string;
  rol: string;
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
  // Calendario (PRP-032)
  dia_semana?: number[] | null;          // ISO 1=lun..7=dom (SEMANAL)
  dia_mes?: number | null;                // 1-31 (MENSUAL / TRIMESTRAL)
  fecha_anual?: string | null;            // 'MM-DD' (ANUAL)
  meses_trimestrales?: number[] | null;   // default [1,4,7,10]
  empleados_asignados?: string[] | null;  // null = todos los del rol
}

import { fallbackCronogramas } from "../data/cronogramasMockData";

export function useCronogramasOperativos() {
  const [data, setData] = useState<CronogramaOperativo[]>(fallbackCronogramas);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const fetchCronogramas = async () => {
    setIsLoading(true);
    const { data: result, error } = await supabase
      .from("cronogramas_operativos")
      .select("*")
      .order("rol", { ascending: true })
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && result && result.length > 0) {
      setData(result as CronogramaOperativo[]);
    } else {
      // Fallback a los datos mockeados si la DB está vacía o falla
      setData(fallbackCronogramas);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCronogramas();
  }, []);

  const addTarea = async (nueva: Partial<CronogramaOperativo>) => {
    const { data: inserted, error } = await supabase
      .from("cronogramas_operativos")
      .insert(nueva)
      .select()
      .single();

    if (!error && inserted) {
      setData((prev) => [...prev, inserted as CronogramaOperativo]);
    } else {
      console.error("Supabase Error [addTarea]:", error);
      const mockId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      setData((prev) => [...prev, { ...nueva, id: mockId } as CronogramaOperativo]);
    }
    return { inserted, error };
  };

  const updateTarea = async (id: string, parcial: Partial<CronogramaOperativo>) => {
    const { data: updated, error } = await supabase
      .from("cronogramas_operativos")
      .update(parcial)
      .eq("id", id)
      .select()
      .single();

    if (!error && updated) {
      setData((prev) => prev.map((t) => (t.id === id ? (updated as CronogramaOperativo) : t)));
    } else {
      console.error("Supabase Error [updateTarea]:", error);
      setData((prev) => prev.map((t) => (t.id === id ? { ...t, ...parcial } : t)));
    }
    return { updated, error };
  };

  const deleteTarea = async (id: string) => {
    const { error } = await supabase.from("cronogramas_operativos").delete().eq("id", id);
    if (!error) {
      setData((prev) => prev.filter((t) => t.id !== id));
    } else {
      console.error("Supabase Error [deleteTarea]:", error);
      setData((prev) => prev.filter((t) => t.id !== id));
    }
    return { error };
  };

  return {
    data,
    isLoading,
    addTarea,
    updateTarea,
    deleteTarea,
    refresh: fetchCronogramas,
  };
}
