/**
 * Supabase devuelve como mucho 1.000 filas por consulta, y lo hace en silencio:
 * no da error ni avisa de que hay más. Un listado sin paginar se queda clavado
 * en mil registros aunque la tabla tenga cien mil.
 *
 * `leerTodas` pide tandas hasta agotar la tabla. Úsalo SIEMPRE que una consulta
 * pueda superar el millar (clientes, reservas, documentos…).
 */

const TANDA = 1000;

/** Trozo de consulta al que aún se le puede aplicar `.range()`. */
type ConsultaPaginable<T> = {
  range: (desde: number, hasta: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>;
};

/**
 * @param construir Devuelve la consulta YA filtrada y ordenada, sin `.range()`.
 *   Se invoca una vez por tanda: no reutilices un builder entre llamadas, que
 *   supabase-js los muta al ejecutarlos.
 */
export async function leerTodas<T>(
  construir: () => ConsultaPaginable<T>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += TANDA) {
    const { data, error } = await construir().range(desde, desde + TANDA - 1);
    if (error) throw error;
    const tanda = data ?? [];
    todas.push(...tanda);
    if (tanda.length < TANDA) return todas;
  }
}
