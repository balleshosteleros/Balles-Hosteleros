/**
 * El correo que recibió LA GESTORÍA, recuperado tal cual salió.
 *
 * Todo correo enviado desde el software queda archivado en el historial del
 * candidato (`candidato_historial`, con su asunto y su HTML exacto). Eso incluye
 * los que NO van al candidato sino a la gestoría: el alta de contrato, el cambio
 * de puesto y la baja. La ficha de Reclutamiento ya los enseña; lo único que
 * faltaba era saber CUÁL de esos correos archivados corresponde a cada trámite.
 *
 * El enlace se hace por INSTANTE: el archivado se escribe segundos después de
 * enviar el correo, dentro de la misma operación. Se acepta como pareja el
 * correo archivado MÁS CERCANO al trámite dentro de una ventana corta, y cada
 * correo se empareja con un solo trámite. Fuera de esa ventana no se adivina
 * nada: antes «no hay copia» que enseñar el correo de otro.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Margen entre enviar el correo y archivarlo. Medido en producción: 3 segundos.
 * Dos minutos deja sitio de sobra sin llegar a rozar otros correos del mismo día.
 */
const VENTANA_MS = 120_000;

export type TipoTramiteGestoria = "alta" | "baja" | "modificacion";

/** Un correo archivado, listo para enseñar. */
export interface CorreoArchivado {
  historialId: string;
  asunto: string;
  html: string;
}

/** Trámite comunicado a la gestoría, reducido a lo que hace falta para emparejar. */
export interface TramiteGestoria {
  tipo: TipoTramiteGestoria;
  id: string;
  /** Instante en que salió el aviso. */
  enviadoEn: string;
}

/** Los tres tipos de trámite de un empleado, con el instante en que se avisaron. */
export async function tramitesGestoriaDeEmpleado(
  db: SupabaseClient,
  empresaId: string,
  empleadoId: string,
): Promise<TramiteGestoria[]> {
  const [altas, bajas, modificaciones] = await Promise.all([
    db
      .from("gestoria_contrato_tokens")
      .select("id, alta_enviada_en")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId),
    db
      .from("gestoria_bajas")
      .select("id, enviado_en")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId),
    db
      .from("empleado_promociones")
      .select("id, gestoria_enviado_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .not("gestoria_enviado_at", "is", null),
  ]);

  const out: TramiteGestoria[] = [];
  for (const a of altas.data ?? []) {
    const iso = (a as Record<string, unknown>).alta_enviada_en as string | null;
    if (iso) out.push({ tipo: "alta", id: (a as Record<string, unknown>).id as string, enviadoEn: iso });
  }
  for (const b of bajas.data ?? []) {
    const iso = (b as Record<string, unknown>).enviado_en as string | null;
    if (iso) out.push({ tipo: "baja", id: (b as Record<string, unknown>).id as string, enviadoEn: iso });
  }
  for (const m of modificaciones.data ?? []) {
    const iso = (m as Record<string, unknown>).gestoria_enviado_at as string | null;
    if (iso) out.push({ tipo: "modificacion", id: (m as Record<string, unknown>).id as string, enviadoEn: iso });
  }
  return out;
}

/** Clave de un trámite dentro del mapa: `tipo:id`. */
export function claveTramite(tipo: TipoTramiteGestoria, id: string): string {
  return `${tipo}:${id}`;
}

/**
 * Empareja los trámites de un empleado con sus correos archivados.
 *
 * Devuelve el mapa `tipo:id → correo` y, de paso, el conjunto de correos que
 * resultaron ser DE LA GESTORÍA: la ficha del candidato lo usa para no decir que
 * ese correo lo recibió el candidato cuando no es verdad.
 */
export async function emparejarCorreosGestoria(
  db: SupabaseClient,
  params: { empresaId: string; empleadoId: string; candidatoId: string; tramites?: TramiteGestoria[] },
): Promise<{ porTramite: Map<string, CorreoArchivado>; historialIds: Set<string> }> {
  const porTramite = new Map<string, CorreoArchivado>();
  const historialIds = new Set<string>();

  const tramites = params.tramites ?? (await tramitesGestoriaDeEmpleado(db, params.empresaId, params.empleadoId));
  if (tramites.length === 0) return { porTramite, historialIds };

  const { data } = await db
    .from("candidato_historial")
    .select("id, email_asunto, email_html, created_at")
    .eq("candidato_id", params.candidatoId)
    .eq("email_enviado", true)
    .not("email_html", "is", null)
    .order("created_at", { ascending: true });
  const correos = (data ?? []) as Array<Record<string, unknown>>;
  if (correos.length === 0) return { porTramite, historialIds };

  // Cada correo se gasta con un solo trámite: si dos trámites cayeran a la vez,
  // el segundo se queda sin copia antes que enseñar el correo del primero.
  const usados = new Set<string>();
  for (const t of tramites) {
    const ref = new Date(t.enviadoEn).getTime();
    if (Number.isNaN(ref)) continue;
    let mejor: Record<string, unknown> | null = null;
    let mejorDist = Number.POSITIVE_INFINITY;
    for (const c of correos) {
      const cid = c.id as string;
      if (usados.has(cid)) continue;
      const dist = Math.abs(new Date(c.created_at as string).getTime() - ref);
      if (dist <= VENTANA_MS && dist < mejorDist) {
        mejor = c;
        mejorDist = dist;
      }
    }
    if (!mejor) continue;
    const id = mejor.id as string;
    usados.add(id);
    historialIds.add(id);
    porTramite.set(claveTramite(t.tipo, t.id), {
      historialId: id,
      asunto: (mejor.email_asunto as string | null) ?? "Correo a la gestoría",
      html: mejor.email_html as string,
    });
  }

  return { porTramite, historialIds };
}
