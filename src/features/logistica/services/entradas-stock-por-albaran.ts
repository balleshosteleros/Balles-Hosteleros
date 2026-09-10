import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { registrarMovimiento, revertirMovimientosPorDocumento } from "./kardex";
import { esErrorAlmacenCerrado } from "./cierre-almacen";

/**
 * Deshace la entrada de stock de un albarán (al des-recibirlo o al borrarlo).
 *
 * Si la recepción cae en un período cerrado devuelve el aviso en vez de reventar: con
 * el almacén cerrado el histórico no se toca (PRP-080 F2).
 */
export async function revertirEntradasAlbaran(
  albaranId: string,
): Promise<{ ok: boolean; revertidos?: number; error?: string }> {
  const admin = createAdminClient();
  const { data: alb } = await admin
    .from("albaranes")
    .select("empresa_id")
    .eq("id", albaranId)
    .maybeSingle();
  if (!alb) return { ok: false, error: "Albarán no encontrado" };
  try {
    const r = await revertirMovimientosPorDocumento(
      { empresaId: alb.empresa_id as string, documentoTipo: "albaran", documentoId: albaranId },
      admin,
    );
    return { ok: true, revertidos: r.revertidos };
  } catch (err) {
    if (esErrorAlmacenCerrado(err)) return { ok: false, error: (err as Error).message };
    throw err;
  }
}
