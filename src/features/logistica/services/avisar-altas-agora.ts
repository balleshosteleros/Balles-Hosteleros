import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import type { PermisoModulo } from "@/features/ajustes/data/ajustes";

/**
 * Avisar de que el TPV vende algo que Balles no conoce (PRP-080 Fase 5).
 *
 * A QUIÉN: solo a quien tenga Logística con permiso de edición. Un camarero no puede
 * dar de alta un producto, y bloquearle con un aviso que no puede resolver enseña a la
 * gente a saltarse los avisos.
 *
 * CUÁNTAS VECES: una por producto y persona, y punto. El cron ve los mismos huérfanos
 * todas las noches, así que sin la clave de deduplicación la campana acabaría con
 * cientos de avisos del mismo sabor de shisha. La clave va por identificador de Ágora.
 *
 * Nunca tumba la ingesta: si algo falla aquí se anota y se sigue. Las ventas ya están
 * guardadas, que es lo que importa.
 */
export async function avisarDeAltasPendientes(
  empresaId: string,
): Promise<{ avisados: number; pendientes: number }> {
  const admin = createAdminClient();

  const { data: pendientes, error } = await admin.rpc("agora_ventas_huerfanas", {
    p_empresa: empresaId,
  });
  if (error) throw error;

  const filas = (pendientes ?? []) as {
    origen: string;
    agora_product_id: number;
    nombre: string;
    veces: number;
  }[];
  if (filas.length === 0) return { avisados: 0, pendientes: 0 };

  // Quién puede arreglarlo: los roles de esta empresa con Logística editable.
  const { data: roles } = await admin
    .from("empresa_roles")
    .select("id, permisos")
    .eq("empresa_id", empresaId);

  // Con el mismo criterio que la aplicación: `puedeEditarModulo` normaliza acentos y
  // grafías, así que no hay que adivinar cómo está escrito "LOGÍSTICA" en cada rol.
  const rolesConLogistica = (roles ?? [])
    .filter((r) => {
      const permisos = r.permisos;
      if (!Array.isArray(permisos)) return false;
      return puedeEditarModulo(permisos as PermisoModulo[], "LOGÍSTICA");
    })
    .map((r) => r.id as string);

  if (rolesConLogistica.length === 0) return { avisados: 0, pendientes: filas.length };

  const { data: usuarios } = await admin
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresaId)
    .in("rol_id", rolesConLogistica);

  const usuarioIds = (usuarios ?? []).map((u) => u.id as string);
  if (usuarioIds.length === 0) return { avisados: 0, pendientes: filas.length };

  let avisados = 0;
  for (const f of filas) {
    try {
      const r = await emitirNotificacion({
        empresaId,
        tipo: "producto_agora_sin_alta",
        titulo: `«${f.nombre}» se vende y no está dado de alta`,
        mensaje:
          `El TPV lo lleva registrando ${f.veces} ${f.veces === 1 ? "vez" : "veces"} y Balles no sabe a qué producto corresponde, ` +
          `así que lo que gasta no sale del almacén. Las ventas están guardadas esperando: al darlo de alta se recuperan todas.`,
        segmento: { tipo: "usuarios", usuarioIds },
        accionUrl: "/logistica/altas-agora",
        dedupeKey: `alta_agora:${f.agora_product_id}`,
        payload: { agoraProductId: f.agora_product_id, origen: f.origen, veces: f.veces },
        system: true,
      });
      avisados += r.creadas ?? 0;
    } catch (e) {
      // Un aviso que falla no puede tumbar la ingesta de ventas.
      console.error(`[altas-agora] aviso de ${f.nombre}:`, e);
    }
  }

  return { avisados, pendientes: filas.length };
}
