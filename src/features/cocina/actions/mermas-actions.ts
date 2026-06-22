"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarMovimiento } from "@/features/logistica/services/kardex";

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
export async function listMermas(): Promise<{ ok: boolean; data: MermaRow[] }> {
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
    return { ok: false, data: [] };
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

    await registrarMovimiento(
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
      },
      admin,
    );

    revalidatePath("/cocina/mermas");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mermas] createMerma:", msg);
    return { ok: false, error: msg };
  }
}
