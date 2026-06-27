import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { registrarMovimiento, revertirMovimientosPorDocumento } from "./kardex";

/**
 * Entradas de stock por recepción de albarán (PRP-057, Fase 3).
 *
 * Al pasar un albarán a estado "Entregado" (recepción), cada línea (productoId × cantidad) genera
 * un movimiento de ENTRADA en el kardex con `referencia = numero de albarán` y suma
 * al stock. Idempotente: antes de aplicar se revierte cualquier entrada previa de ese
 * albarán, de modo que recepcionar dos veces no duplica.
 */

interface LineaAlbaranRaw {
  id?: string;
  productoId?: string;
  producto?: string;
  cantidad?: number;
}

export async function aplicarEntradasAlbaran(
  albaranId: string,
  createdBy?: string | null,
): Promise<{ ok: boolean; aplicados?: number; omitidos?: number; error?: string }> {
  const admin = createAdminClient();
  const { data: alb } = await admin
    .from("albaranes")
    .select("id, empresa_id, numero, fecha, lineas")
    .eq("id", albaranId)
    .maybeSingle();
  if (!alb) return { ok: false, error: "Albarán no encontrado" };

  // Idempotencia: limpiar entradas previas de este albarán antes de rehacer.
  await revertirMovimientosPorDocumento(
    { empresaId: alb.empresa_id as string, documentoTipo: "albaran", documentoId: alb.id as string },
    admin,
  );

  const lineas = Array.isArray(alb.lineas) ? (alb.lineas as LineaAlbaranRaw[]) : [];
  const fechaISO = alb.fecha ? new Date(alb.fecha as string).toISOString() : undefined;
  let aplicados = 0;
  let omitidos = 0;

  for (const l of lineas) {
    const cantidad = Number(l.cantidad ?? 0);
    if (!l.productoId || cantidad <= 0) {
      omitidos++;
      continue;
    }
    await registrarMovimiento(
      {
        empresaId: alb.empresa_id as string,
        productoId: l.productoId,
        tipo: "entrada",
        cantidad,
        referencia: (alb.numero as string) ?? null,
        documentoTipo: "albaran",
        documentoId: alb.id as string,
        origenLineaId: l.id ?? null,
        fecha: fechaISO,
        createdBy,
      },
      admin,
    );
    aplicados++;
  }

  return { ok: true, aplicados, omitidos };
}

export async function revertirEntradasAlbaran(
  albaranId: string,
): Promise<{ ok: boolean; revertidos?: number; error?: string }> {
  const admin = createAdminClient();
  const { data: alb } = await admin
    .from("albaranes")
    .select("empresa_id")
    .eq("id", albaranId)
    .maybeSingle();
  if (!alb) return { ok: false, error: "Albarán no encontrado" };
  const r = await revertirMovimientosPorDocumento(
    { empresaId: alb.empresa_id as string, documentoTipo: "albaran", documentoId: albaranId },
    admin,
  );
  return { ok: true, revertidos: r.revertidos };
}
