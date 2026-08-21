import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Computa tiempo" (`tipos_fichaje.computa_tiempo`): fuente ÚNICA de la regla.
 *
 * Un tipo de fichaje con `computa_tiempo = false` se registra igual (queda el
 * rastro de entrada/salida y su tipo, y se ve en el listado de fichajes), pero
 * NO suma horas: al cerrarlo se graba `horas_totales = 0`. Como el 0 queda en la
 * propia fila, todos los totales que suman `fichajes.horas_totales` (horas del
 * mes, balance, Pagos/Nóminas, resumen de Mi Panel, KPI de Dirección) quedan
 * corregidos sin tocarlos uno a uno.
 *
 * Con `computa_tiempo = true` — el valor por defecto de todos los tipos — el
 * comportamiento es el de siempre: se graban las horas calculadas.
 *
 * Ojo: `fichajes.tipo` NO tiene FK contra `tipos_fichaje`; el enlace es por
 * (empresa_id, upper(codigo)). Los códigos legacy (ENT/MAN/…) que no existan en
 * el catálogo computan, que es como se han comportado hasta ahora.
 */

/**
 * ¿Computa tiempo este tipo de fichaje en esta empresa?
 *
 * Ante la duda (sin tipo, sin empresa, tipo no catalogado o error de consulta)
 * devuelve `true`: no computar es la excepción que hay que configurar
 * expresamente, nunca el resultado de un fallo.
 */
export async function tipoComputaTiempo(
  supabase: SupabaseClient,
  empresaId: string | null | undefined,
  tipoCodigo: string | null | undefined,
): Promise<boolean> {
  const codigo = (tipoCodigo ?? "").trim();
  if (!codigo || !empresaId) return true;

  const { data, error } = await supabase
    .from("tipos_fichaje")
    .select("computa_tiempo")
    .eq("empresa_id", empresaId)
    .ilike("codigo", codigo)
    .limit(1)
    .maybeSingle();

  if (error || !data) return true;
  return data.computa_tiempo !== false;
}

/**
 * Horas a grabar en `fichajes.horas_totales`: las calculadas si el tipo computa,
 * 0 si no. Envoltorio de `tipoComputaTiempo` para los puntos de cierre, que es
 * donde siempre se aplica la regla.
 */
export async function horasSegunTipo(
  supabase: SupabaseClient,
  empresaId: string | null | undefined,
  tipoCodigo: string | null | undefined,
  horasCalculadas: number,
): Promise<number> {
  if (horasCalculadas === 0) return 0;
  return (await tipoComputaTiempo(supabase, empresaId, tipoCodigo)) ? horasCalculadas : 0;
}

/**
 * Versión en lote para cierres masivos (cron, cierre de fichajes abiertos): una
 * sola consulta por empresa en vez de una por fichaje. Devuelve el conjunto de
 * códigos (en mayúsculas) que NO computan; el resto computa.
 */
export async function codigosQueNoComputan(
  supabase: SupabaseClient,
  empresaId: string | null | undefined,
): Promise<Set<string>> {
  const vacio = new Set<string>();
  if (!empresaId) return vacio;

  const { data, error } = await supabase
    .from("tipos_fichaje")
    .select("codigo")
    .eq("empresa_id", empresaId)
    .eq("computa_tiempo", false);

  if (error || !data) return vacio;
  return new Set(data.map((t) => String(t.codigo ?? "").toUpperCase()).filter(Boolean));
}

/** ¿Está este código en el conjunto de "no computa"? (para uso con el lote). */
export function noComputa(codigosNoComputan: Set<string>, tipoCodigo: string | null | undefined): boolean {
  const codigo = (tipoCodigo ?? "").trim().toUpperCase();
  if (!codigo) return false;
  return codigosNoComputan.has(codigo);
}
