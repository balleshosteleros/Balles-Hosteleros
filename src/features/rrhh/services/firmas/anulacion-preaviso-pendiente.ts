/**
 * ¿Tiene el trabajador la anulación de su preaviso sin firmar?
 *
 * Mientras la tenga pendiente NO puede fichar. La razón no es burocrática: el
 * trabajador presentó su baja, se le convenció de que se quedara y volvió al
 * trabajo, pero sobre la mesa sigue habiendo una baja voluntaria firmada por él.
 * Si vuelve a trabajar sin anularla por escrito, la empresa no puede acreditar
 * en qué situación está. El fichaje es el único momento en que se le puede parar
 * de verdad, así que es ahí donde se le pide.
 *
 * Puede firmarla desde el correo o desde la app (Mi Panel → Mis documentos); en
 * cuanto firma, el documento pasa a `firmado` y esta comprobación deja de
 * bloquear (y el enlace del correo queda consumido).
 *
 * Se consulta con el cliente que reciba, para que respete la RLS del llamador.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Texto que ve el trabajador cuando intenta fichar sin haberla firmado. */
export const MENSAJE_ANULACION_PENDIENTE =
  "Tienes pendiente firmar la anulación de tu baja. Fírmala en «Mis documentos» " +
  "o desde el enlace que te hemos enviado por correo, y ya podrás fichar.";

/**
 * `true` si le queda alguna anulación de preaviso en estado pendiente.
 *
 * Nunca lanza: si la consulta falla, devuelve `false` (no bloquear un fichaje
 * por un fallo de lectura — dejar a alguien sin poder fichar su jornada es peor
 * que un documento firmado un día más tarde).
 */
export async function tieneAnulacionPreavisoPendiente(
  supabase: SupabaseClient,
  args: { empresaId: string; empleadoId: string },
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("firmas_documentos")
      .select("id")
      .eq("empresa_id", args.empresaId)
      .eq("empleado_id", args.empleadoId)
      .eq("tipo", "anulacion_preaviso")
      .eq("estado", "pendiente")
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  } catch (err) {
    console.error(
      "[rrhh] tieneAnulacionPreavisoPendiente:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
