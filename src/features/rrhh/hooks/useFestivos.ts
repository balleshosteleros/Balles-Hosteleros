"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { getFestivos, type FestivoBD } from "@/features/rrhh/actions/festivos-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

/**
 * Forma compatible con el antiguo mock `getFestivoEnFecha`, para que los
 * calendarios de RRHH y Mi Panel no necesiten reescribirse: un festivo trae
 * `{ fecha, nombre, tipo }`, y el resultado indica si el día es el festivo en sí
 * o su víspera.
 */
export interface FestivoInfo {
  tipo: "festivo" | "vispera";
  festivo: {
    fecha: string;
    nombre: string;
    tipo: "nacional" | "autonomico" | "local";
    /** Comunidad autónoma (para autonómicos/locales); vacío en nacionales. */
    region?: string;
  };
}

function sumarDiaISO(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

/**
 * Carga los festivos REALES de la empresa activa (desde la BD, generados
 * automáticamente cada año) y expone un `festivoEnFecha(fechaISO)` con la misma
 * firma que el mock anterior. Carga el año dado y los adyacentes (±1) para que
 * las vísperas y la navegación entre años funcionen sin recargas.
 */
export function useFestivos(anioBase: number) {
  const { empresaActual, ajustes } = useEmpresa();
  const empresaKey = empresaActual?.dbId ?? "";
  const comunidad = ajustes?.configOperativa?.comunidadAutonoma ?? "";
  const [festivos, setFestivos] = useState<FestivoBD[]>([]);

  useEffect(() => {
    let alive = true;
    if (!empresaKey) {
      setFestivos([]);
      return;
    }
    const anios = [anioBase - 1, anioBase, anioBase + 1];
    Promise.all(anios.map((a) => getFestivos(a))).then((resultados) => {
      if (!alive) return;
      const todos = resultados.flatMap((r) => (r.ok ? r.data : []));
      // Deduplica por id (los años solapan en fechas límite pero no en ids).
      const map = new Map<string, FestivoBD>();
      for (const f of todos) map.set(f.id, f);
      setFestivos([...map.values()]);
    });
    return () => {
      alive = false;
    };
  }, [empresaKey, anioBase]);

  const porFecha = useMemo(() => {
    const m = new Map<string, FestivoBD>();
    for (const f of festivos) m.set(f.fecha, f);
    return m;
  }, [festivos]);

  const festivoEnFecha = useCallback(
    (fechaISO: string): FestivoInfo | null => {
      const aInfo = (f: FestivoBD, tipo: FestivoInfo["tipo"]): FestivoInfo => ({
        tipo,
        festivo: {
          fecha: f.fecha,
          nombre: f.nombre,
          tipo: f.ambito,
          // Los nacionales aplican a toda España; los demás, a la comunidad.
          region: f.ambito === "nacional" ? undefined : comunidad || undefined,
        },
      });
      const directo = porFecha.get(fechaISO);
      if (directo) return aInfo(directo, "festivo");
      const manana = porFecha.get(sumarDiaISO(fechaISO));
      if (manana) return aInfo(manana, "vispera");
      return null;
    },
    [porFecha, comunidad],
  );

  return { festivos, festivoEnFecha };
}
