"use server";

/**
 * Estado de un plato EN LA CARTA. Tres, y excluyentes:
 *
 *   VISIBLE    — se ve y se puede pedir.
 *   AGOTADO    — se ve en gris, con la etiqueta "Agotado", y no se pide.
 *   INVISIBLE  — desaparece de la carta.
 *
 * Es lo único, junto con el nombre y el texto, que se decide desde Marketing.
 * El precio, los alérgenos y la estrella son del producto de venta y no se
 * tocan desde aquí (Iván, 10-09-2026).
 *
 * DÓNDE SE GUARDA EL AGOTADO: en el PRODUCTO cuando el plato está vinculado a
 * uno, porque el mismo apagado tiene que valer para la tecla del TPV y para la
 * comanda del camarero, no solo para la carta. Solo los platos escritos a mano
 * en la carta —los que no tienen producto detrás— lo llevan en su propia fila.
 * Ojo: esto NO es editar la ficha del producto; es un estado que caduca solo,
 * pasadas las horas configuradas en Cocina → Comandas (12 por defecto).
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";

export type EstadoCartaItem = "VISIBLE" | "AGOTADO" | "INVISIBLE";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function cambiarEstadoItem(
  itemId: string,
  estado: EstadoCartaItem,
): Promise<ActionResult> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: item } = await supabase
      .from("carta_items")
      .select("id, producto_id")
      .eq("id", itemId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!item) return { ok: false, error: "El plato ya no existe." };

    const productoId = (item as { producto_id: string | null }).producto_id;
    const agotar = estado === "AGOTADO";
    // El plazo no se guarda aquí: se guarda CUÁNDO se marcó y las horas se
    // leen al pintar. Así, si la empresa cambia el plazo, lo ya marcado se
    // rige por el plazo nuevo sin tener que recalcular nada.
    const marca = agotar
      ? { agotado_por: userId, agotado_at: new Date().toISOString() }
      : { agotado_por: null, agotado_at: null };

    // "Invisible" también limpia el agotado: son tres estados excluyentes, y
    // un plato que vuelve a la carta no debe reaparecer marcado de antes.
    const { error: errItem } = await supabase
      .from("carta_items")
      .update({ visible: estado !== "INVISIBLE", ...marca })
      .eq("id", itemId)
      .eq("empresa_id", empresaId);
    if (errItem) {
      console.error("[carta][estadoItem] item:", errItem.message);
      return { ok: false, error: "No se pudo cambiar el estado del plato." };
    }

    if (productoId) {
      const { error: errProd } = await supabase
        .from("productos")
        .update(marca)
        .eq("id", productoId)
        .eq("empresa_id", empresaId);
      if (errProd) {
        console.error("[carta][estadoItem] producto:", errProd.message);
        return { ok: false, error: "El plato cambió, pero no se pudo avisar al punto de venta." };
      }
    }

    revalidatePath("/marketing/carta-digital");
    return { ok: true };
  } catch (err) {
    console.error("[carta][estadoItem] fatal:", err);
    return { ok: false, error: friendlyError(err, "cambiarEstadoItem") };
  }
}
