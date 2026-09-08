import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cierre de almacén (PRP-080 Fase 2).
 *
 * REGLA (de Iván): **almacén abierto** → cualquier movimiento se crea, se corrige o
 * se borra, y el sistema recalcula el histórico solo. **Almacén cerrado** → nada
 * anterior al corte se toca: ni mermas, ni albaranes, ni ventas, ni ajustes, ni
 * inventarios.
 *
 * Quien de verdad impide escribir es un trigger en la base de datos
 * (`stock_mov_guard_cierre`, migración 20260909210000), porque los movimientos entran
 * por cuatro sitios distintos y un `if` aquí solo taparía uno. Lo de este módulo es
 * para **avisar antes y bien**: comprobar el corte antes de empezar un proceso de
 * varias filas (un inventario, una elaboración, un día de ventas) en vez de dejar la
 * mitad escrita, y traducir el rechazo del trigger a algo que se pueda enseñar.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/** El almacén está cerrado a esa fecha. El mensaje ya viene listo para pantalla. */
export class AlmacenCerradoError extends Error {
  readonly corte: string | null;
  constructor(mensaje: string, corte: string | null = null) {
    super(mensaje);
    this.name = "AlmacenCerradoError";
    this.corte = corte;
  }
}

/**
 * ¿Es este error el rechazo del cierre? El trigger lo marca con `hint`, no con el
 * texto: el mensaje está en castellano y cambia, la pista no.
 */
export function esErrorAlmacenCerrado(err: unknown): boolean {
  if (err instanceof AlmacenCerradoError) return true;
  if (!err || typeof err !== "object") return false;
  const e = err as { hint?: unknown; message?: unknown };
  if (typeof e.hint === "string" && e.hint === "almacen_cerrado") return true;
  // PostgREST a veces envuelve el error y solo conserva el texto.
  return typeof e.message === "string" && e.message.includes("El almacén está cerrado hasta");
}

/**
 * Primer instante ABIERTO del almacén de la empresa (ISO), o `null` si no hay nada
 * cerrado. Todo lo anterior a este instante es intocable.
 */
export async function getCierreVigente(
  admin: AdminClient,
  empresaId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("almacen_cierres")
    .select("corte")
    .eq("empresa_id", empresaId)
    .is("reabierto_at", null)
    .order("corte", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data.corte as string) ?? null;
}

/** Fecha de un movimiento formateada para un mensaje (dd/mm/aaaa). */
function comoDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
}

/**
 * Lanza `AlmacenCerradoError` si esa fecha cae en período cerrado.
 *
 * Se llama ANTES de empezar cualquier proceso que escriba varias filas. Sin esto, el
 * trigger pararía a mitad y dejaría media elaboración registrada: no hay transacción
 * que envuelva esos bucles.
 */
export async function assertAlmacenAbierto(
  admin: AdminClient,
  empresaId: string,
  fechaISO: string,
): Promise<void> {
  const corte = await getCierreVigente(admin, empresaId);
  if (!corte) return;
  if (new Date(fechaISO).getTime() >= new Date(corte).getTime()) return;
  const ultimoDiaCerrado = new Date(new Date(corte).getTime() - 1000).toISOString();
  throw new AlmacenCerradoError(
    `El almacén está cerrado hasta el ${comoDia(ultimoDiaCerrado)} (incluido), así que no se puede tocar nada del ${comoDia(fechaISO)}. Si de verdad hay que corregirlo, un responsable puede reabrirlo desde Logística → Stock.`,
    corte,
  );
}

/**
 * Igual que `assertAlmacenAbierto` pero devolviendo el mensaje en vez de lanzar, para
 * los caminos que ya contestan `{ ok: false, error }`.
 */
export async function comprobarAlmacenAbierto(
  admin: AdminClient,
  empresaId: string,
  fechaISO: string,
): Promise<{ abierto: boolean; error?: string; corte?: string }> {
  try {
    await assertAlmacenAbierto(admin, empresaId, fechaISO);
    return { abierto: true };
  } catch (err) {
    if (err instanceof AlmacenCerradoError) {
      return { abierto: false, error: err.message, corte: err.corte ?? undefined };
    }
    throw err;
  }
}
