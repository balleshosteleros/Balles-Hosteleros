import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * UNA LÍNEA POR CADA VEZ QUE SALE UN COMUNICADO QUE SE REPITE.
 *
 * La línea que se escribe es la PLANTILLA: guarda el texto, a quién va y cada
 * cuánto se repite, y se queda esperando su próxima fecha. Cada vez que le toca
 * salir nace una línea nueva —una copia publicada, con el día que ha salido y
 * su propio porcentaje de vistos—, para que cada salida se persiga por separado
 * y no se mezclen los vistos de todos los años (Iván, 12-09-2026).
 *
 * Lo usan los dos caminos por los que sale un comunicado: el cron del día que
 * le toca y el botón de publicar del listado. Antes cada uno hacía su cuenta.
 */

/** Campos que se copian de la plantilla a la salida: TODO su contenido. */
const CAMPOS_PLANTILLA =
  "id, empresa_id, titulo, asunto, cuerpo, tipo, recurrencia, envio, toda_empresa, " +
  "roles_destinatarios, empleados_destinatarios, departamentos_destinatarios, adjuntos, " +
  "enviar_email, enlace, enlace_texto, observaciones, creador_id, repeticion_parada_at";

/** La siguiente vez que toca, conservando la hora del envío. */
export function siguienteEnvio(iso: string, recurrencia: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  switch (recurrencia) {
    case "anual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d.toISOString();
    case "mensual":
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d.toISOString();
    case "semanal":
      d.setUTCDate(d.getUTCDate() + 7);
      return d.toISOString();
    case "diaria":
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString();
    default:
      return null;
  }
}

/** `true` si esa fila es una plantilla que se repite. */
export function seRepite(recurrencia: string | null | undefined): boolean {
  return !!recurrencia && recurrencia !== "sin_repeticion";
}

export type ResultadoSalida =
  | { ok: true; idSalida: string }
  | { ok: false; error: string };

/**
 * Saca la salida de hoy de una plantilla que se repite: deja la línea nueva
 * publicada y la plantilla esperando la siguiente fecha.
 *
 * Devuelve el id de la SALIDA: es a ella a la que hay que colgar los avisos, el
 * push y el correo, porque es la que recibe la plantilla y la que guarda quién
 * la ha abierto.
 */
export async function crearSalidaDePlantilla(
  client: SupabaseClient,
  plantillaId: string,
  /** Momento de la salida. Se pasa para que el cron use el suyo. */
  cuando: string = new Date().toISOString(),
): Promise<ResultadoSalida> {
  const { data: plantilla, error: errLeer } = await client
    .from("comunicados")
    .select(CAMPOS_PLANTILLA)
    .eq("id", plantillaId)
    .maybeSingle();
  if (errLeer) return { ok: false, error: errLeer.message };
  if (!plantilla) return { ok: false, error: "El comunicado ya no existe" };

  const p = plantilla as unknown as Record<string, unknown>;
  const recurrencia = (p.recurrencia as string | null) ?? "sin_repeticion";
  if (!seRepite(recurrencia)) {
    return { ok: false, error: "Ese comunicado no se repite: no tiene salidas que sacar" };
  }

  const { data: salida, error: errCopia } = await client
    .from("comunicados")
    .insert({
      empresa_id: p.empresa_id,
      titulo: p.titulo,
      asunto: p.asunto,
      cuerpo: p.cuerpo,
      estado: "publicado",
      tipo: p.tipo,
      // La salida no se repite: la que se repite es su plantilla.
      recurrencia: "sin_repeticion",
      toda_empresa: p.toda_empresa ?? false,
      roles_destinatarios: p.roles_destinatarios ?? [],
      empleados_destinatarios: p.empleados_destinatarios ?? [],
      departamentos_destinatarios: p.departamentos_destinatarios ?? [],
      adjuntos: p.adjuntos ?? [],
      enviar_email: p.enviar_email === true,
      enlace: p.enlace,
      enlace_texto: p.enlace_texto,
      observaciones: p.observaciones,
      creador_id: p.creador_id,
      // El día que ha salido de verdad, no el que estaba apuntado: si sale con
      // retraso, la plantilla lo recibió cuando lo recibió.
      envio: cuando,
      origen_id: plantillaId,
    })
    .select("id")
    .single();
  if (errCopia) return { ok: false, error: errCopia.message };

  // La plantilla se queda esperando la siguiente vez.
  const desde = (p.envio as string | null) ?? cuando;
  const proximo = siguienteEnvio(desde, recurrencia);
  const { error: errPlantilla } = await client
    .from("comunicados")
    .update({ estado: "programado", envio: proximo ?? desde })
    .eq("id", plantillaId);
  if (errPlantilla) return { ok: false, error: errPlantilla.message };

  return { ok: true, idSalida: salida.id as string };
}
