"use server";

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { registrarMovimiento } from "@/features/logistica/services/kardex";
import { friendlyError } from "@/shared/lib/friendly-errors";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listStock() {
  try {
    const { supabase, empresaId } = await getContext();
    let query = supabase
      .from("stock")
      .select("*")
      .order("producto_nombre", { ascending: true });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[stock] listStock:", err);
    return { ok: false, data: [], error: friendlyError(err, "listStock") };
  }
}

/**
 * Ajusta los TOPES de un producto (mínimo de seguridad y máximo de reposición).
 *
 * Deliberadamente NO permite tocar `cantidad_actual`: ese saldo lo mantiene el kardex
 * (`stock_movimientos`) y escribirlo a mano lo descuadraría — el histórico diría una cosa
 * y el listado otra, sin rastro de quién lo cambió ni por qué. Para corregir existencias
 * está `crearAjusteStock`, que deja el movimiento correspondiente.
 */
export async function updateStock(
  id: string,
  input: { cantidad_minima?: number; cantidad_maxima?: number }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("stock")
      .update({
        cantidad_minima: input.cantidad_minima,
        cantidad_maxima: input.cantidad_maxima,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] updateStock:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Corrige las existencias de un producto dejando constancia en el kardex.
 *
 * POR QUÉ EXISTE: hasta ahora la única forma de corregir una cantidad era escribirla
 * directamente en la tabla de stock, saltándose el histórico. El saldo quedaba bien pero
 * el kardex no cuadraba, y nadie podía saber después de dónde salía esa diferencia.
 *
 * Aquí el motivo es OBLIGATORIO (mismo criterio que las mermas): un ajuste sin explicación
 * es exactamente lo que hace que un inventario no se pueda auditar seis meses después.
 * Para un recuento completo de una categoría es mejor un inventario, que además guarda el
 * conteo; esto es para la corrección puntual ("me he equivocado al recibir el albarán").
 */
export async function crearAjusteStock(input: {
  productoId: string;
  /** Existencias que debe haber tras el ajuste. */
  cantidadNueva: number;
  motivo: string;
}): Promise<{ ok: boolean; error?: string; saldoAnterior?: number; saldoResultante?: number }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No tienes empresa asignada" };

    const motivo = (input.motivo ?? "").trim();
    if (!motivo) return { ok: false, error: "Explica por qué se ajusta: el motivo es obligatorio" };

    const cantidadNueva = Number(input.cantidadNueva);
    if (!Number.isFinite(cantidadNueva) || cantidadNueva < 0) {
      return { ok: false, error: "La cantidad no es válida" };
    }

    // El producto tiene que ser de la empresa activa (multi-empresa: la del selector).
    const { data: producto } = await supabase
      .from("productos")
      .select("id, nombre")
      .eq("id", input.productoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!producto) return { ok: false, error: "Ese producto no es de esta empresa" };

    const { data: filaStock } = await supabase
      .from("stock")
      .select("cantidad_actual")
      .eq("empresa_id", empresaId)
      .eq("producto_id", input.productoId)
      .maybeSingle();
    const saldoAnterior = Number(filaStock?.cantidad_actual ?? 0);

    const diferencia = cantidadNueva - saldoAnterior;
    if (Math.abs(diferencia) < 0.0005) {
      return { ok: true, saldoAnterior, saldoResultante: saldoAnterior };
    }

    const resultado = await registrarMovimiento({
      empresaId,
      productoId: input.productoId,
      tipo: diferencia > 0 ? "entrada" : "salida",
      cantidad: Math.abs(diferencia),
      referencia: "Ajuste",
      documentoTipo: "ajuste",
      motivo,
      createdBy: user?.id ?? null,
    });

    if (resultado.omitido) {
      return {
        ok: false,
        error: `"${producto.nombre}" tiene el control de stock desactivado, así que no lleva existencias que ajustar.`,
      };
    }

    revalidatePath("/logistica/stock");
    return { ok: true, saldoAnterior, saldoResultante: resultado.saldoResultante };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] crearAjusteStock:", msg);
    return { ok: false, error: msg };
  }
}

export async function sumarStockDesdeAlbaran(
  lineas: { productoId?: string; productoNombre: string; cantidad: number; unidad: string }[]
) {
  if (lineas.length === 0) return { ok: true };
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const now = new Date().toISOString();

    for (const linea of lineas) {
      if (!linea.productoNombre || linea.cantidad <= 0) continue;

      // Buscar fila de stock: primero por producto_id (exacto), luego por nombre
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let existing: any = null;

      if (linea.productoId) {
        const { data } = await supabase
          .from("stock")
          .select("id, cantidad_actual")
          .eq("empresa_id", empresaId)
          .eq("producto_id", linea.productoId)
          .maybeSingle();
        existing = data;
      }

      if (!existing) {
        const { data } = await supabase
          .from("stock")
          .select("id, cantidad_actual")
          .eq("empresa_id", empresaId)
          .ilike("producto_nombre", linea.productoNombre)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        const nuevaCantidad = Number(existing.cantidad_actual ?? 0) + linea.cantidad;
        await supabase
          .from("stock")
          .update({ cantidad_actual: nuevaCantidad, ultimo_movimiento: now })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("stock")
          .insert({
            empresa_id: empresaId,
            producto_id: linea.productoId ?? null,
            producto_nombre: linea.productoNombre,
            cantidad_actual: linea.cantidad,
            unidad: linea.unidad || "ud",
            ultimo_movimiento: now,
          });
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] sumarStockDesdeAlbaran:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateStockBatch(
  updates: { id: string; cantidad_minima?: number; cantidad_maxima?: number }[]
) {
  if (updates.length === 0) return { ok: true };
  try {
    const { supabase } = await getContext();
    const now = new Date().toISOString();
    const results = await Promise.all(
      updates.map(({ id, ...fields }) =>
        supabase.from("stock").update({ ...fields, updated_at: now }).eq("id", id)
      )
    );
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) throw new Error(`${failed.length} actualizaciones fallaron`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] updateStockBatch:", msg);
    return { ok: false, error: msg };
  }
}
