"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

/** Estado de los avisos de un usuario en un tipo de aparato. */
export interface EstadoDispositivo {
  /** Hay al menos un dispositivo de este tipo dado de alta y activo. */
  activo: boolean;
  /** Última vez que se vio el dispositivo (ISO), para el detalle al pasar el ratón. */
  ultimaVez: string | null;
}

export interface EstadoPushUsuario {
  ordenador: EstadoDispositivo;
  movil: EstadoDispositivo;
}

/**
 * ¿Es un user_agent de móvil/tablet?
 *
 * Ojo con el orden: "iPad" y "Android" pueden aparecer junto a "Macintosh"/"Linux",
 * así que se decide por los marcadores móviles y NO por descarte de escritorio.
 */
function esMovil(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /iPhone|iPad|iPod|Android|Mobile|Windows Phone/i.test(userAgent);
}

/**
 * Estado de los avisos push de TODOS los usuarios de la empresa activa.
 *
 * Devuelve un mapa user_id → { ordenador, movil }. Un tipo de aparato sale
 * "activo" solo si hay una suscripción con `enabled = true`: cuando un envío
 * rebota (el empleado borró datos del navegador, cambió de móvil…) el servidor
 * marca esa fila como deshabilitada, así que el dispositivo caducado deja de
 * contar aunque la fila siga existiendo.
 *
 * IMPORTANTE — lo que este dato NO puede decir: si un usuario aparece sin
 * dispositivo, no se puede distinguir entre "pulsó Bloquear en su navegador"
 * y "todavía no lo ha activado". Ese bloqueo vive dentro del navegador del
 * empleado y no deja ningún rastro en servidor.
 */
export async function getEstadoPushEmpresa(): Promise<Record<string, EstadoPushUsuario>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return {};

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, user_agent, last_seen_at, enabled")
    .eq("empresa_id", empresaId)
    .eq("enabled", true);

  if (error || !data) return {};

  const mapa: Record<string, EstadoPushUsuario> = {};
  for (const fila of data) {
    const userId = fila.user_id as string;
    if (!mapa[userId]) {
      mapa[userId] = {
        ordenador: { activo: false, ultimaVez: null },
        movil: { activo: false, ultimaVez: null },
      };
    }
    const clave = esMovil(fila.user_agent as string | null) ? "movil" : "ordenador";
    const vista = (fila.last_seen_at as string | null) ?? null;
    const actual = mapa[userId][clave];
    actual.activo = true;
    // Un mismo empleado puede tener varios aparatos del mismo tipo: nos quedamos
    // con la actividad más reciente, que es la que dice si sigue vivo.
    if (!actual.ultimaVez || (vista && vista > actual.ultimaVez)) {
      actual.ultimaVez = vista;
    }
  }

  return mapa;
}

const recordatorioSchema = z.object({
  usuarioId: z.string().uuid(),
  nombre: z.string().min(1).max(120),
});

/**
 * Pide a un empleado que active los avisos, mandándole una notificación interna.
 *
 * Va SIN push a propósito (`push: false`): el destinatario es justo alguien que
 * no tiene avisos activos en algún aparato, así que mandarle un push sería
 * predicar en el desierto. Le llega a la campana, que sí ve al entrar.
 */
export async function pedirActivarAvisos(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = recordatorioSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  try {
    const res = await emitirNotificacion({
      tipo: "aviso_manual",
      titulo: "Activa los avisos",
      mensaje:
        "Activa las notificaciones para enterarte de los comunicados, mensajes y llamadas aunque no tengas Balles abierto.",
      segmento: { tipo: "usuarios", usuarioIds: [parsed.data.usuarioId] },
      push: false,
    });
    if (!res.ok || res.creadas === 0) {
      return { ok: false, error: "No se pudo enviar el aviso" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar" };
  }
}
