"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
  ZONA_HORARIA_DEFAULT,
} from "@/features/empresa/lib/empresa-server";

/**
 * Historial de altas y bajas del empleado en el sistema.
 *
 * El cambio de estado desde la ficha es manual, así que se salta el flujo de
 * contratación de reclutamiento (alta a gestoría, contrato a firmar, condiciones,
 * email de acceso). Aquí se deja constancia de quién lo hizo, cuándo, con qué
 * fecha efectiva y qué pasos quedaron pendientes de hacer a mano.
 *
 * Solo-append: no hay update ni delete (tampoco en las policies de RLS).
 */

export type MovimientoEstado = {
  id: string;
  accion: "Alta" | "Baja";
  fechaEfectiva: string;
  fechaEfectivaTexto: string;
  motivo: string | null;
  avisosOmitidos: string[];
  origen: string;
  usuarioNombre: string;
  creadoTexto: string;
};

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Nombre legible del usuario actual (nombre+apellidos → full_name → email). */
async function nombreUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Usuario";
  const nombreCompleto = [data.nombre, data.apellidos].filter(Boolean).join(" ").trim();
  return (
    nombreCompleto ||
    (data.full_name as string | null) ||
    (data.email as string | null) ||
    "Usuario"
  );
}

/** Instante UTC → texto en la zona horaria de la empresa. La BD sigue en UTC. */
function fmtInstante(iso: string, tz: string = ZONA_HORARIA_DEFAULT): string {
  return new Date(iso).toLocaleString("es-ES", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Fecha suelta (YYYY-MM-DD) → dd/mm/aaaa. Se formatea partiendo la cadena, sin
 * pasar por Date: una fecha sin hora no tiene zona, y construir un Date la
 * interpretaría como medianoche UTC, que en zonas al oeste cae el día anterior.
 */
function fmtFechaSuelta(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return d && m && a ? `${d}/${m}/${a}` : fecha;
}

/**
 * Registra un movimiento de alta o baja. Pensada para llamarse DESDE otra server
 * action que ya ha hecho el cambio de estado, por eso nunca lanza: un fallo al
 * escribir el historial no puede tumbar el guardado del estado.
 */
export async function registrarMovimientoEstado(input: {
  empleadoId: string;
  accion: "Alta" | "Baja";
  estadoAnterior: string | null;
  estadoNuevo: string;
  fechaEfectiva: string;
  motivo?: string | null;
  avisosOmitidos?: string[];
  origen?: string;
}): Promise<void> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return;

    await supabase.from("empleado_estado_historial").insert({
      empresa_id: empresaId,
      empleado_id: input.empleadoId,
      accion: input.accion,
      estado_anterior: input.estadoAnterior,
      estado_nuevo: input.estadoNuevo,
      fecha_efectiva: input.fechaEfectiva,
      motivo: input.motivo?.trim() || null,
      avisos_omitidos: input.avisosOmitidos ?? [],
      origen: input.origen ?? "ficha",
      usuario_id: user.id,
      usuario_nombre: await nombreUsuario(supabase, user.id),
    });
  } catch (e) {
    console.error(
      "[rrhh] registrarMovimientoEstado:",
      e instanceof Error ? e.message : e,
    );
  }
}

/** Movimientos de un empleado, del más reciente al más antiguo. */
export async function getHistorialEstadoEmpleado(
  empleadoId: string,
): Promise<MovimientoEstado[]> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return [];

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);

    const { data, error } = await supabase
      .from("empleado_estado_historial")
      .select(
        "id, accion, fecha_efectiva, motivo, avisos_omitidos, origen, usuario_nombre, created_at",
      )
      .eq("empleado_id", empleadoId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((f) => ({
      id: f.id as string,
      accion: f.accion as "Alta" | "Baja",
      fechaEfectiva: f.fecha_efectiva as string,
      fechaEfectivaTexto: fmtFechaSuelta(f.fecha_efectiva as string),
      motivo: (f.motivo as string | null) ?? null,
      avisosOmitidos: Array.isArray(f.avisos_omitidos)
        ? (f.avisos_omitidos as string[])
        : [],
      origen: (f.origen as string) ?? "ficha",
      usuarioNombre: (f.usuario_nombre as string | null) ?? "Usuario",
      creadoTexto: fmtInstante(f.created_at as string, tz),
    }));
  } catch (e) {
    console.error(
      "[rrhh] getHistorialEstadoEmpleado:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}
