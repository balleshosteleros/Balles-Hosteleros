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
import { leerTodas } from "@/shared/lib/supabase-paginado";

/**
 * Margen entre enviar el correo y archivarlo. Medido en producción: 3 segundos.
 * Dos minutos deja sitio de sobra sin llegar a rozar otros correos del mismo día.
 */
const VENTANA_MS = 120_000;

export type TipoTramiteGestoria = "alta" | "baja" | "modificacion";

/** Clave de un trámite: `tipo:id`. */
export function claveTramite(tipo: TipoTramiteGestoria, id: string): string {
  return `${tipo}:${id}`;
}

/** Trámite comunicado a la gestoría, reducido a lo que hace falta para emparejar. */
export interface TramiteGestoria {
  tipo: TipoTramiteGestoria;
  id: string;
  empleadoId: string | null;
  /** Instante en que salió el aviso. */
  enviadoEn: string;
}

/** Correo archivado en el historial de un candidato. */
export interface CorreoHistorial {
  id: string;
  candidatoId: string;
  createdAt: string;
}

/**
 * Empareja trámites con correos archivados. Función pura: el reparto es el mismo
 * se mire desde Gestoría o desde la ficha del candidato.
 *
 * Devuelve `clave del trámite → id del correo`. Cada correo se gasta con un solo
 * trámite: si dos cayeran a la vez, el segundo se queda sin copia antes que
 * enseñar el correo del primero.
 */
export function emparejarCorreos(
  tramites: Array<{ clave: string; candidatoId: string; enviadoEn: string }>,
  correos: CorreoHistorial[],
): Map<string, string> {
  const out = new Map<string, string>();
  const porCandidato = new Map<string, CorreoHistorial[]>();
  for (const c of correos) {
    const lista = porCandidato.get(c.candidatoId);
    if (lista) lista.push(c);
    else porCandidato.set(c.candidatoId, [c]);
  }

  const usados = new Set<string>();
  for (const t of tramites) {
    const ref = new Date(t.enviadoEn).getTime();
    if (Number.isNaN(ref)) continue;
    let mejorId: string | null = null;
    let mejorDist = Number.POSITIVE_INFINITY;
    for (const c of porCandidato.get(t.candidatoId) ?? []) {
      if (usados.has(c.id)) continue;
      const dist = Math.abs(new Date(c.createdAt).getTime() - ref);
      if (dist <= VENTANA_MS && dist < mejorDist) {
        mejorId = c.id;
        mejorDist = dist;
      }
    }
    if (!mejorId) continue;
    usados.add(mejorId);
    out.set(t.clave, mejorId);
  }
  return out;
}

/**
 * Para una tanda de trámites ya leídos, qué correo archivado le corresponde a
 * cada uno. Dos consultas en total, pase el listado por las filas que pase.
 */
export async function correosGestoriaPorTramite(
  db: SupabaseClient,
  empresaId: string,
  tramites: TramiteGestoria[],
): Promise<Map<string, string>> {
  const vacio = new Map<string, string>();
  const empleadoIds = Array.from(new Set(tramites.map((t) => t.empleadoId).filter(Boolean) as string[]));
  if (empleadoIds.length === 0) return vacio;

  // Solo los que tienen ficha en Reclutamiento: ahí es donde se archiva el correo.
  const { data: cands } = await db
    .from("candidatos")
    .select("id, empleado_id")
    .eq("empresa_id", empresaId)
    .in("empleado_id", empleadoIds);
  const candidatoDeEmpleado = new Map<string, string>(
    ((cands ?? []) as Array<Record<string, unknown>>).map((c) => [
      c.empleado_id as string,
      c.id as string,
    ]),
  );
  const candidatoIds = Array.from(new Set(candidatoDeEmpleado.values()));
  if (candidatoIds.length === 0) return vacio;

  const correos = await leerTodas<Record<string, unknown>>(() =>
    db
      .from("candidato_historial")
      .select("id, candidato_id, created_at")
      .eq("empresa_id", empresaId)
      .in("candidato_id", candidatoIds)
      .eq("email_enviado", true)
      .not("email_html", "is", null)
      .order("created_at", { ascending: true }),
  );

  const paraEmparejar: Array<{ clave: string; candidatoId: string; enviadoEn: string }> = [];
  for (const t of tramites) {
    const candidatoId = t.empleadoId ? candidatoDeEmpleado.get(t.empleadoId) : null;
    if (!candidatoId) continue;
    paraEmparejar.push({ clave: claveTramite(t.tipo, t.id), candidatoId, enviadoEn: t.enviadoEn });
  }

  return emparejarCorreos(
    paraEmparejar,
    correos.map((c) => ({
      id: c.id as string,
      candidatoId: c.candidato_id as string,
      createdAt: c.created_at as string,
    })),
  );
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
  const empujar = (tipo: TipoTramiteGestoria, filas: unknown, campoFecha: string) => {
    for (const f of (filas ?? []) as Array<Record<string, unknown>>) {
      const iso = f[campoFecha] as string | null;
      if (iso) out.push({ tipo, id: f.id as string, empleadoId, enviadoEn: iso });
    }
  };
  empujar("alta", altas.data, "alta_enviada_en");
  empujar("baja", bajas.data, "enviado_en");
  empujar("modificacion", modificaciones.data, "gestoria_enviado_at");
  return out;
}

/**
 * Los correos de un candidato que en realidad fueron A LA GESTORÍA. La ficha de
 * Reclutamiento lo usa para no decir que ese correo lo recibió el candidato
 * cuando no es verdad.
 */
export async function correosDeGestoriaDeUnCandidato(
  db: SupabaseClient,
  params: { empresaId: string; empleadoId: string },
): Promise<Set<string>> {
  const tramites = await tramitesGestoriaDeEmpleado(db, params.empresaId, params.empleadoId);
  if (tramites.length === 0) return new Set();
  const mapa = await correosGestoriaPorTramite(db, params.empresaId, tramites);
  return new Set(mapa.values());
}
