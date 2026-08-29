"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  registrarMovimiento,
  revertirMovimientosPorDocumento,
} from "@/features/logistica/services/kardex";

export interface MermaRow {
  id: string;
  producto_id: string;
  producto_nombre: string | null;
  cantidad: number;
  unidad: string | null;
  motivo: string;
  created_at: string;
}

const mermaSchema = z.object({
  productoId: z.string().guid("Producto no válido"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor que 0"),
  unidad: z.string().optional().nullable(),
  motivo: z.string().trim().min(1, "El motivo es obligatorio"),
});

export type MermaInput = z.input<typeof mermaSchema>;

/** Lista las mermas de la empresa (más recientes primero). */
export async function listMermas(): Promise<{ ok: boolean; data: MermaRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("mermas")
      .select("id, producto_id, cantidad, unidad, motivo, created_at, productos(nombre)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows: MermaRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      const prod = r.productos as { nombre?: string } | { nombre?: string }[] | null;
      const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre;
      return {
        id: r.id as string,
        producto_id: r.producto_id as string,
        producto_nombre: nombre ?? null,
        cantidad: Number(r.cantidad ?? 0),
        unidad: (r.unidad as string) ?? null,
        motivo: (r.motivo as string) ?? "",
        created_at: r.created_at as string,
      };
    });
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[mermas] listMermas:", err);
    return { ok: false, data: [], error: friendlyError(err, "listMermas") };
  }
}

/**
 * Registra una merma: fila en `mermas` + movimiento de SALIDA en el kardex
 * (descuenta stock vía registrarMovimiento, que respeta controla_stock).
 */
export async function createMerma(
  input: MermaInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const parsed = mermaSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { productoId, cantidad, unidad, motivo } = parsed.data;

    const admin = createAdminClient();

    // No se puede tirar más de lo que hay. Se comprueba ANTES de apuntar nada,
    // para poder decir cuánto queda de verdad en vez de un "no se pudo".
    const { data: filaStock } = await admin
      .from("stock")
      .select("cantidad_actual")
      .eq("empresa_id", empresaId)
      .eq("producto_id", productoId)
      .maybeSingle();
    const disponible = Number(filaStock?.cantidad_actual ?? 0);
    if (cantidad > disponible) {
      const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 3 });
      return {
        ok: false,
        error:
          disponible <= 0
            ? "No queda nada de este producto en el almacén, así que no hay merma que apuntar. Si el stock está mal, corrígelo primero en Logística → Stock."
            : `Solo quedan ${fmt(disponible)}${unidad ? " " + unidad : ""} en el almacén y estás apuntando ${fmt(cantidad)}. Corrige la cantidad, o ajusta primero las existencias en Logística → Stock si el dato está mal.`,
      };
    }

    const { data: merma, error } = await admin
      .from("mermas")
      .insert({
        empresa_id: empresaId,
        producto_id: productoId,
        cantidad,
        unidad: unidad ?? null,
        motivo,
        created_by: userId ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    const mov = await registrarMovimiento(
      {
        empresaId,
        productoId,
        tipo: "salida",
        cantidad,
        referencia: "Merma",
        documentoTipo: "merma",
        documentoId: merma.id as string,
        motivo,
        createdBy: userId ?? null,
        impedirNegativo: true,
      },
      admin,
    );

    // Red de seguridad por si otra persona vació el almacén entre la
    // comprobación de arriba y este punto: se retira la merma recién apuntada
    // para no dejarla sin su movimiento (una merma que no descuenta engaña más
    // que no tenerla).
    if (mov.rechazado) {
      await admin.from("mermas").delete().eq("id", merma.id as string);
      return {
        ok: false,
        error: "Alguien ha movido el stock de este producto mientras lo apuntabas. Vuelve a mirar lo que queda e inténtalo de nuevo.",
      };
    }

    revalidatePath("/cocina/mermas");
    revalidatePath("/logistica/stock");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mermas] createMerma:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Borra una merma y **devuelve al stock lo que descontó**.
 *
 * POR QUÉ: una merma se apunta con prisa, en cocina, y equivocarse es normal (producto
 * confundido, cantidad de más, apuntada dos veces). Hasta ahora no había forma de
 * deshacerla: la fila se quedaba y el stock descontado también, así que la única salida
 * era apuntar una entrada falsa para compensar — que ensucia el histórico y engaña al
 * recuento. Los inventarios ya se podían revertir; las mermas no.
 *
 * El orden importa: primero se revierte el kardex (que devuelve el saldo y borra el
 * movimiento) y solo después se borra la fila. Si se hiciera al revés y fallara la
 * reversión, quedaría un movimiento huérfano apuntando a una merma que ya no existe.
 */
export async function deleteMerma(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    // La merma tiene que ser de la empresa activa.
    const { data: merma } = await admin
      .from("mermas")
      .select("id")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!merma) return { ok: false, error: "Esa merma no existe o no es de esta empresa" };

    await revertirMovimientosPorDocumento(
      { empresaId, documentoTipo: "merma", documentoId: id },
      admin,
    );

    const { error } = await admin.from("mermas").delete().eq("id", id).eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/cocina/mermas");
    revalidatePath("/logistica/stock");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mermas] deleteMerma:", msg);
    return { ok: false, error: msg };
  }
}
