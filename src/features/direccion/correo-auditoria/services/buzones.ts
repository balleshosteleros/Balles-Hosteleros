import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Buzones auditados: quién sostiene la conexión (PRP-094, Fase 1).
 *
 * REGLA DE NEGOCIO (Iván, 10-09-2026): «son correos de empresa nuestros todos».
 * La conexión con Google la sostiene LA EMPRESA, no la persona que la vinculó.
 *
 * En la práctica eso significa tres cosas:
 *
 *  1. Da igual quién vincule el buzón. Si un encargado conecta
 *     `rrhh.grupohabana@gmail.com` desde su ordenador, el permiso se guarda a
 *     nombre del BUZÓN (`correo_buzones_tokens`) y la auditoría de la empresa
 *     empieza a contar. No hace falta que lo repita nadie más.
 *
 *  2. Quitarse esa cuenta del selector personal NO apaga la auditoría. Ese botón
 *     (`/api/google/disconnect`) toca el roster del usuario
 *     (`google_cuentas_usuario`), que es otro almacén distinto. Aquí no entra.
 *
 *  3. Solo apagan la auditoría dos gestos: desconectar el buzón a propósito desde
 *     Ajustes, o revocar el permiso desde la propia cuenta de Google (y eso se ve
 *     como «conexión caducada», nunca como «0 correos»).
 *
 * Todo lo de este archivo usa el cliente ADMIN: la tabla de tokens tiene RLS
 * activada y ninguna policy, así que no es accesible de ninguna otra forma.
 */

/** Normaliza un correo para cruzarlo: minúsculas y sin espacios. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type ResultadoVinculacion = {
  /** Cuántos buzones (de cualquier empresa) han quedado conectados con esto. */
  buzones: number;
};

/**
 * Engancha una cuenta de Google recién vinculada con los buzones auditados.
 *
 * Se llama desde `vincular-callback` con CUALQUIER cuenta que alguien vincule.
 * Si ese correo no es un buzón auditado, no hace nada y no molesta. Si lo es
 * —en una empresa o en varias del grupo— guarda el permiso y lo deja contando.
 *
 * Nunca lanza: vincular una cuenta de Google no puede romperse porque la
 * auditoría de correos tenga un mal día. Si algo falla, se registra y se sigue.
 */
export async function registrarBuzonDesdeVinculacion(
  email: string,
  refreshToken: string,
  userId: string | null,
): Promise<ResultadoVinculacion> {
  const correo = normalizarEmail(email);
  if (!correo || !refreshToken) return { buzones: 0 };

  try {
    const admin = createAdminClient();

    // Un mismo correo puede estar auditado en varias empresas del grupo: se
    // conectan TODAS de una vez. Por eso no se filtra por empresa activa.
    const { data: buzones, error } = await admin
      .from("correo_buzones")
      .select("id")
      .eq("estado", "Activo")
      .ilike("email", correo);

    if (error) {
      console.error("[correo-auditoria] buscar buzón falló:", error.message);
      return { buzones: 0 };
    }
    if (!buzones?.length) return { buzones: 0 };

    const ahora = new Date().toISOString();

    const { error: errToken } = await admin.from("correo_buzones_tokens").upsert(
      buzones.map((b) => ({
        buzon_id: b.id as string,
        refresh_token: refreshToken,
        actualizado: ahora,
      })),
      { onConflict: "buzon_id" },
    );
    if (errToken) {
      console.error("[correo-auditoria] guardar token falló:", errToken.message);
      return { buzones: 0 };
    }

    // Al reconectar se limpia el estado de caducado y el último error: el buzón
    // vuelve a contar sin que nadie tenga que tocar nada más.
    const { error: errEstado } = await admin
      .from("correo_buzones")
      .update({
        conexion: "conectado",
        conectado_por: userId,
        conectado_at: ahora,
        ultimo_error: null,
      })
      .in(
        "id",
        buzones.map((b) => b.id as string),
      );
    if (errEstado) {
      console.error(
        "[correo-auditoria] marcar conectado falló:",
        errEstado.message,
      );
    }

    return { buzones: buzones.length };
  } catch (err) {
    console.error("[correo-auditoria] vinculación error:", err);
    return { buzones: 0 };
  }
}

/**
 * Marca un buzón como caducado.
 *
 * SOLO se llama cuando Google responde `invalid_grant`, que es la única
 * respuesta que significa de verdad «ese permiso ya no existe». Un 5xx o un
 * corte de red hacen fallar el refresco sin que nadie haya revocado nada: si se
 * marcase caducado por eso, un fallo de tres minutos dejaría a la empresa
 * creyendo que tiene que reconectar ocho buzones.
 */
export async function marcarBuzonCaducado(
  buzonId: string,
  motivo: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("correo_buzones")
      .update({ conexion: "caducado", ultimo_error: motivo })
      .eq("id", buzonId);
  } catch (err) {
    console.error("[correo-auditoria] marcar caducado error:", err);
  }
}

/**
 * Desconecta un buzón A PROPÓSITO (desde Ajustes): borra el permiso y deja de
 * contar. Es el único camino por el que la empresa suelta un buzón.
 */
export async function desconectarBuzon(buzonId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("correo_buzones_tokens").delete().eq("buzon_id", buzonId);
  await admin
    .from("correo_buzones")
    .update({
      conexion: "sin_conectar",
      conectado_por: null,
      conectado_at: null,
      last_history_id: null,
      ultimo_error: null,
    })
    .eq("id", buzonId);
}

/**
 * Devuelve el `refresh_token` de un buzón. Server-only y solo para la ingesta.
 * Nunca debe llegar a una server action que responda al navegador.
 */
export async function leerRefreshTokenBuzon(
  buzonId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("correo_buzones_tokens")
    .select("refresh_token")
    .eq("buzon_id", buzonId)
    .maybeSingle();
  return (data?.refresh_token as string) ?? null;
}
