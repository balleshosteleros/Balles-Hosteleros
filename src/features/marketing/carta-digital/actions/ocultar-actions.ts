"use server";

/**
 * Ocultar un plato de la carta sin sacarlo del catálogo.
 *
 * Distinto del interruptor «Visible en carta digital» de la ficha del producto:
 * aquel decide si el producto ES de carta; esto es una pausa.
 *
 *   - Sin fechas       → oculto hasta que alguien lo devuelva ("se ha acabado").
 *   - Entre dos fechas → oculto solo en ese periodo y vuelve solo, sin que
 *                        nadie tenga que acordarse de reactivarlo.
 *
 * El plato conserva su descripción, foto, orden y likes: ocultar no destruye
 * trabajo editorial.
 *
 * Protocolo MEMORY.md: try/catch + logs en toda escritura.
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export interface OcultarItemInput {
  itemId: string;
  /** null = indefinido (desde ya). */
  desde?: string | null;
  /** null = sin fecha de vuelta. */
  hasta?: string | null;
  motivo?: string | null;
}

/** `YYYY-MM-DD`, que es como se guarda una fecha sin hora. */
function fechaValida(valor: string | null | undefined): boolean {
  if (!valor) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

export async function ocultarItemCarta(
  input: OcultarItemInput,
): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const desde = input.desde?.trim() || null;
    const hasta = input.hasta?.trim() || null;

    if (!fechaValida(desde) || !fechaValida(hasta)) {
      return { ok: false, error: "Las fechas no son válidas." };
    }
    // Un rango invertido dejaría el plato oculto para siempre sin que se note.
    if (desde && hasta && hasta < desde) {
      return { ok: false, error: "La fecha de vuelta es anterior a la de inicio." };
    }

    const { error } = await supabase
      .from("carta_items")
      .update({
        oculto: true,
        oculto_desde: desde,
        oculto_hasta: hasta,
        oculto_motivo: input.motivo?.trim() || null,
      })
      .eq("id", input.itemId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[carta][ocultarItem]", error.message);
      return { ok: false, error: "No se pudo ocultar el plato." };
    }

    revalidatePath("/marketing/carta-digital");
    return { ok: true };
  } catch (err) {
    console.error("[carta][ocultarItem] fatal:", err);
    return { ok: false, error: friendlyError(err, "ocultarItemCarta") };
  }
}

/** Devuelve el plato a la carta y limpia el periodo. */
export async function mostrarItemCarta(itemId: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { error } = await supabase
      .from("carta_items")
      .update({
        oculto: false,
        oculto_desde: null,
        oculto_hasta: null,
        oculto_motivo: null,
      })
      .eq("id", itemId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[carta][mostrarItem]", error.message);
      return { ok: false, error: "No se pudo mostrar el plato." };
    }

    revalidatePath("/marketing/carta-digital");
    return { ok: true };
  } catch (err) {
    console.error("[carta][mostrarItem] fatal:", err);
    return { ok: false, error: friendlyError(err, "mostrarItemCarta") };
  }
}
