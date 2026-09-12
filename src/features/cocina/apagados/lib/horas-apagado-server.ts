import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HORAS_APAGADO_DEFAULT, horasApagadoSeguras } from "./caducidad";

/**
 * Horas que dura el apagado en ESTA empresa, según su configuración de
 * Comandas. Si no hay fila de configuración todavía, manda el valor por
 * defecto: la empresa no tiene que configurar nada para que funcione.
 */
export async function getHorasApagado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  empresaId: string | null,
): Promise<number> {
  if (!empresaId) return HORAS_APAGADO_DEFAULT;
  const { data } = await supabase
    .from("cocina_alarmas_config")
    .select("horas_apagado_producto")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return horasApagadoSeguras((data as { horas_apagado_producto?: number } | null)?.horas_apagado_producto);
}
