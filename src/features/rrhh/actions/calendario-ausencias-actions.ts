"use server";

/**
 * Ausencias de TODA la plantilla para pintarlas en el calendario de RRHH
 * (vacaciones, bajas médicas y permisos justificados).
 *
 * Hasta ahora esta pantalla enseñaba datos inventados: nombres y fechas
 * escritos a mano en `data/calendarios.ts`. Esto lee las solicitudes de verdad.
 *
 * Se muestran las APROBADAS y las PENDIENTES: quien cuadra los turnos necesita
 * ver lo que está por decidir para detectar el choque antes de aprobarlo. Las
 * rechazadas y anuladas no se pintan porque no afectan a la plantilla.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

type Sb = Awaited<ReturnType<typeof getAppContext>>["supabase"];

/** Una ausencia ya lista para el calendario. */
export interface AusenciaCalendario {
  id: string;
  empleadoNombre: string;
  departamento: string;
  fechaInicio: string;
  /** null en bajas médicas sin fecha de alta prevista (siguen abiertas). */
  fechaFin: string | null;
  /** "aprobada" | "pendiente" — el calendario las pinta con distinto color. */
  estado: string;
  /** Días naturales que abarca, o null si la baja sigue abierta. */
  dias: number | null;
  /** Lo que escribió el empleado al solicitarla. */
  motivo: string | null;
}

async function resolveEmpresaUuid(supabase: Sb, idOrSlug: string): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Días naturales de un rango, ambos incluidos. null si la baja sigue abierta. */
function diasNaturales(inicio: string, fin: string | null): number | null {
  if (!fin) return null;
  const a = Date.parse(inicio + "T00:00:00Z");
  const b = Date.parse(fin + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Ausencias de un subtipo (vacaciones / baja_medica / permiso) que se solapan
 * con el año pedido, en toda la empresa.
 *
 * El solape se calcula con el rango completo: una baja de diciembre a enero
 * aparece en los dos años, que es lo que se espera al mirar el calendario.
 */
export async function listAusenciasEmpresa(
  empresaIdOrSlug: string,
  subtipo: SolicitudSubtipoAusencia,
  anio: number,
): Promise<{ ok: boolean; data: AusenciaCalendario[]; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, data: [], error: "Empresa no encontrada" };

    const desde = `${anio}-01-01`;
    const hasta = `${anio}-12-31`;

    // Solapa con el año si empieza antes de que acabe y (no ha terminado o
    // terminó después de que empezara). `fecha_fin` nula = sigue abierta.
    const { data, error } = await supabase
      .from("solicitudes_personal")
      .select("id, user_id, empleado_nombre, fecha_inicio, fecha_fin, estado, motivo")
      .eq("empresa_id", empresaId)
      .eq("tipo", "ausencia")
      .eq("subtipo", subtipo)
      .in("estado", ["aprobada", "pendiente"])
      .lte("fecha_inicio", hasta)
      .or(`fecha_fin.gte.${desde},fecha_fin.is.null`)
      .order("fecha_inicio", { ascending: true });
    if (error) throw error;

    const filas = data ?? [];
    if (filas.length === 0) return { ok: true, data: [] };

    // Departamento de cada empleado, en una sola consulta. El nombre se guarda
    // en la propia solicitud, pero el departamento no, y es lo que agrupa el
    // calendario.
    const userIds = [...new Set(filas.map((f) => f.user_id as string).filter(Boolean))];
    const deptoPorUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: empleados } = await supabase
        .from("empleados")
        .select("user_id, departamentos!empleados_departamento_id_fkey(nombre)")
        .eq("empresa_id", empresaId)
        .in("user_id", userIds);
      for (const e of empleados ?? []) {
        const depto = e.departamentos as { nombre?: string } | null;
        if (e.user_id && depto?.nombre) deptoPorUser.set(e.user_id as string, depto.nombre);
      }
    }

    return {
      ok: true,
      data: filas.map((f) => {
        const inicio = f.fecha_inicio as string;
        const fin = (f.fecha_fin as string | null) ?? null;
        return {
          id: f.id as string,
          empleadoNombre: (f.empleado_nombre as string) || "Sin nombre",
          departamento: deptoPorUser.get(f.user_id as string) ?? "Sin departamento",
          fechaInicio: inicio,
          fechaFin: fin,
          estado: f.estado as string,
          dias: diasNaturales(inicio, fin),
          motivo: (f.motivo as string | null) || null,
        };
      }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] listAusenciasEmpresa:", msg);
    return { ok: false, data: [], error: msg };
  }
}
