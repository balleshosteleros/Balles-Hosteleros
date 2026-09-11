import "server-only";

/**
 * Rastro de lo que el sistema manda fuera.
 *
 * Antes, cuando una solicitud disparaba un correo o un aviso, no quedaba nada:
 * nadie podía responder a «¿esto le llegó a la gestoría?», «¿lo vio?» o «¿quién
 * lo mandó?». Cada salida se apunta aquí con su vía, a quién, cuándo y quién le
 * dio al botón.
 *
 * Dos reglas que lo hacen útil:
 *   · Los envíos FALLIDOS también se guardan. Que un correo no salga es justo lo
 *     que hace falta poder ver después.
 *   · Solo se añade. La tabla no tiene UPDATE ni DELETE: un historial que se
 *     puede reescribir no prueba nada. Un reenvío es una línea nueva.
 *
 * Es genérico a propósito (`refTabla` + `refId`): nace para las solicitudes,
 * pero sirve para cualquier cosa que mande algo fuera.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type ViaComunicacion = "email" | "notificacion" | "push";

export interface ComunicacionRegistrada {
  id: string;
  via: ViaComunicacion;
  asunto: string;
  destinatario: string;
  destinoEmail: string | null;
  estado: "enviado" | "fallido";
  error: string | null;
  automatico: boolean;
  enviadoPorNombre: string | null;
  createdAt: string;
}

/**
 * Apunta una salida. Best-effort a propósito: si el registro falla, NO se rompe
 * el envío que lo provocó — perder una línea del historial nunca puede impedir
 * que una baja médica llegue a la gestoría.
 */
export async function registrarComunicacion(args: {
  empresaId: string;
  refTabla: string;
  refId: string;
  via: ViaComunicacion;
  /** Qué se mandó: asunto del correo o título del aviso. */
  asunto: string;
  /** A quién, en legible: «Gestoría», «Gerencia», «Laura Ortega Ruiz». */
  destinatario: string;
  /** El correo real, solo cuando la vía es email. */
  destinoEmail?: string | null;
  estado?: "enviado" | "fallido";
  error?: string | null;
  /** true = lo lanzó el sistema (un cron, una regla), sin persona detrás. */
  automatico?: boolean;
  enviadoPor?: string | null;
  enviadoPorNombre?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("comunicaciones").insert({
      empresa_id: args.empresaId,
      ref_tabla: args.refTabla,
      ref_id: args.refId,
      via: args.via,
      asunto: args.asunto,
      destinatario: args.destinatario,
      destino_email: args.destinoEmail ?? null,
      estado: args.estado ?? "enviado",
      error: args.error ?? null,
      automatico: args.automatico ?? false,
      enviado_por: args.enviadoPor ?? null,
      // El nombre se copia en vez de resolverse al leer: así el historial sigue
      // legible aunque esa persona se dé de baja o cambie de nombre.
      enviado_por_nombre: args.enviadoPorNombre ?? null,
    });
  } catch (e) {
    console.error(
      "[comunicaciones] no se pudo registrar:",
      e instanceof Error ? e.message : e,
    );
  }
}

/** Lo comunicado sobre algo concreto, lo último arriba. */
export async function listarComunicaciones(
  refTabla: string,
  refId: string,
): Promise<ComunicacionRegistrada[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("comunicaciones")
      .select(
        "id, via, asunto, destinatario, destino_email, estado, error, automatico, enviado_por_nombre, created_at",
      )
      .eq("ref_tabla", refTabla)
      .eq("ref_id", refId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        via: row.via as ViaComunicacion,
        asunto: row.asunto as string,
        destinatario: row.destinatario as string,
        destinoEmail: (row.destino_email as string | null) ?? null,
        estado: row.estado as "enviado" | "fallido",
        error: (row.error as string | null) ?? null,
        automatico: (row.automatico as boolean) ?? false,
        enviadoPorNombre: (row.enviado_por_nombre as string | null) ?? null,
        createdAt: row.created_at as string,
      };
    });
  } catch (e) {
    console.error(
      "[comunicaciones] no se pudo leer el historial:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

/**
 * ¿Se avisó YA a la gestoría de esto, con éxito?
 *
 * La respuesta sale del propio historial en vez de una columna aparte: un
 * segundo sitio donde apuntar lo mismo acaba contradiciendo al primero.
 */
export async function gestoriaYaAvisada(
  refTabla: string,
  refId: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("comunicaciones")
      .select("id")
      .eq("ref_tabla", refTabla)
      .eq("ref_id", refId)
      .eq("destinatario", DESTINATARIO_GESTORIA)
      .eq("estado", "enviado")
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** Etiquetas fijas: se comparan al consultar, así que no pueden variar. */
export const DESTINATARIO_GESTORIA = "Gestoría";
export const DESTINATARIO_GERENCIA = "Gerencia";
