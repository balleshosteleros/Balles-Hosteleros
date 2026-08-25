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
import { revalidatePath } from "next/cache";
import type { SolicitudSubtipoAusencia } from "@/features/mi-panel/types";

type Sb = Awaited<ReturnType<typeof getAppContext>>["supabase"];

/** Una ausencia ya lista para el calendario. */
export interface AusenciaCalendario {
  id: string;
  /** Para agrupar por persona y no repetir su avatar el mismo día. */
  userId: string | null;
  empleadoNombre: string;
  departamento: string;
  /** Foto del empleado; sin ella se pintan sus iniciales. */
  avatarUrl: string | null;
  /** Qué tipo de ausencia es: decide el color del aro del avatar. */
  subtipo: SolicitudSubtipoAusencia;
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

/** Los cuatro tipos que se pintan en el calendario. */
const SUBTIPOS_CALENDARIO: SolicitudSubtipoAusencia[] = [
  "vacaciones",
  "baja_medica",
  "permiso",
  "baja_contrato",
];

/**
 * TODAS las ausencias de la empresa que se solapan con el año pedido, de los
 * cuatro tipos a la vez. Antes había que pedirlas tipo por tipo (cuatro
 * llamadas) porque el calendario tenía una pestaña para cada uno.
 *
 * El solape se calcula con el rango completo: una baja de diciembre a enero
 * aparece en los dos años, que es lo que se espera al mirar el calendario.
 */
export async function listAusenciasEmpresa(
  empresaIdOrSlug: string,
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
      .select("id, user_id, empleado_nombre, subtipo, fecha_inicio, fecha_fin, estado, motivo")
      .eq("empresa_id", empresaId)
      .eq("tipo", "ausencia")
      .in("subtipo", SUBTIPOS_CALENDARIO)
      .in("estado", ["aprobada", "pendiente"])
      .lte("fecha_inicio", hasta)
      .or(`fecha_fin.gte.${desde},fecha_fin.is.null`)
      .order("fecha_inicio", { ascending: true });
    if (error) throw error;

    const filas = data ?? [];
    if (filas.length === 0) return { ok: true, data: [] };

    // Departamento y foto de cada empleado, en una sola consulta. El nombre se
    // guarda en la propia solicitud, pero la foto no, y es lo que identifica a
    // cada persona de un vistazo en el calendario.
    const userIds = [...new Set(filas.map((f) => f.user_id as string).filter(Boolean))];
    const fichaPorUser = new Map<string, { depto: string | null; avatarUrl: string | null }>();
    if (userIds.length > 0) {
      // La foto puede estar en la ficha del empleado o solo en su perfil de
      // usuario (si se la subió él desde su cuenta y nadie la copió a la
      // ficha). Se miran las dos, o saldrían iniciales teniendo foto.
      const [{ data: empleados }, { data: perfiles }] = await Promise.all([
        supabase
          .from("empleados")
          .select("user_id, avatar_url, departamentos!empleados_departamento_id_fkey(nombre)")
          .eq("empresa_id", empresaId)
          .in("user_id", userIds),
        supabase
          .from("usuarios")
          .select("user_id, avatar_url")
          .in("user_id", userIds)
          .not("avatar_url", "is", null),
      ]);

      const fotoDePerfil = new Map<string, string>();
      for (const p of perfiles ?? []) {
        const url = p.avatar_url as string | null;
        if (p.user_id && url) fotoDePerfil.set(p.user_id as string, url);
      }

      for (const e of empleados ?? []) {
        const depto = e.departamentos as { nombre?: string } | null;
        if (e.user_id) {
          const uid = e.user_id as string;
          fichaPorUser.set(uid, {
            depto: depto?.nombre ?? null,
            avatarUrl: (e.avatar_url as string | null) ?? fotoDePerfil.get(uid) ?? null,
          });
        }
      }
    }

    return {
      ok: true,
      data: filas.map((f) => {
        const inicio = f.fecha_inicio as string;
        const fin = (f.fecha_fin as string | null) ?? null;
        const ficha = fichaPorUser.get(f.user_id as string);
        return {
          id: f.id as string,
          userId: (f.user_id as string) ?? null,
          empleadoNombre: (f.empleado_nombre as string) || "Sin nombre",
          departamento: ficha?.depto ?? "Sin departamento",
          avatarUrl: ficha?.avatarUrl ?? null,
          subtipo: f.subtipo as SolicitudSubtipoAusencia,
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

/**
 * Registra una ausencia a un empleado desde el calendario de RRHH.
 *
 * Entra ya APROBADA: si la mete RRHH es porque el hecho ya ha ocurrido (el
 * empleado ha llamado diciendo que está de baja), no es una petición que haya
 * que decidir. Queda constancia de quién la registró.
 *
 * No se aplica el tope anual del tipo de ausencia: RRHH está registrando algo
 * que ya ha pasado, y no tendría sentido impedírselo porque el empleado se
 * pase de días. El tope existe para frenar al empleado al pedir, no a RRHH al
 * dar de alta un hecho.
 */
export async function registrarAusenciaEmpleado(input: {
  empleadoUserId: string;
  subtipo: SolicitudSubtipoAusencia;
  fechaInicio: string;
  fechaFin: string | null;
  motivo: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, error: "No autenticado" };

    if (!input.fechaInicio) return { ok: false, error: "Indica la fecha de inicio." };
    if (input.fechaFin && input.fechaFin < input.fechaInicio) {
      return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };
    }
    if (input.subtipo === "baja_contrato") {
      return {
        ok: false,
        error: "La baja de contrato no se registra aquí: la solicita el empleado y requiere firma.",
      };
    }

    // El empleado debe ser de esta empresa: si no, se estaría metiendo una
    // ausencia en la plantilla de otra.
    const { data: emp } = await supabase
      .from("empleados")
      .select("nombre, apellidos")
      .eq("empresa_id", empresaId)
      .eq("user_id", input.empleadoUserId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Ese empleado no es de esta empresa." };

    const nombreCompleto = [emp.nombre, emp.apellidos].filter(Boolean).join(" ").trim();

    const { error } = await supabase.from("solicitudes_personal").insert({
      empresa_id: empresaId,
      user_id: input.empleadoUserId,
      empleado_nombre: nombreCompleto || "Sin nombre",
      tipo: "ausencia",
      subtipo: input.subtipo,
      fecha_inicio: input.fechaInicio,
      fecha_fin: input.fechaFin,
      horas: null,
      motivo: input.motivo.trim(),
      estado: "aprobada",
      revisado_por: userId,
      revisado_at: new Date().toISOString(),
    });
    if (error) throw error;

    revalidatePath("/rrhh/calendarios");
    revalidatePath("/rrhh/solicitudes");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] registrarAusenciaEmpleado:", msg);
    return { ok: false, error: msg };
  }
}
