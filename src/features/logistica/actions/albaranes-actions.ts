"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  aplicarEntradasAlbaran,
  revertirEntradasAlbaran,
} from "@/features/logistica/services/entradas-stock-por-albaran";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listAlbaranes() {
  try {
    const { supabase, empresaId } = await getContext();
    let query = supabase
      .from("albaranes")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[albaranes] listAlbaranes:", err);
    return { ok: false, data: [] };
  }
}

/** Estados con la mercancía ya recepcionada (stock aplicado): "Entregado" y "Confirmado". */
const ESTADOS_COMPRA_CONFIRMADA = ["Entregado", "Confirmado"];

export interface CompraProductoRow {
  albaranId: string;
  numero: string;
  numeroProveedor: string | null;
  proveedor: string;
  fecha: string;
  estado: string;
  lineaId: string;
  producto: string;
  cantidad: number;
  unidad: string;
  precioUC: number;
  impuesto: number;
  dtoPct: number;
  dtoEur: number;
  total: number;
}

interface LineaAlbaranJson {
  id?: string;
  productoId?: string;
  producto?: string;
  cantidad?: number;
  unidad?: string;
  precioUC?: number;
  impuesto?: number;
  dtoPct?: number;
  dtoEur?: number;
  total?: number;
}

/**
 * Histórico de compras de un producto: recorre los albaranes ya confirmados de la
 * empresa y extrae únicamente las líneas que corresponden a este producto.
 */
export async function listComprasPorProducto(
  productoId: string,
): Promise<{ ok: boolean; data: CompraProductoRow[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId || !productoId) return { ok: true, data: [] };

    let query = supabase
      .from("albaranes")
      .select("id, numero, numero_proveedor, proveedor_nombre, fecha, estado, lineas")
      .in("estado", ESTADOS_COMPRA_CONFIRMADA)
      .order("fecha", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);

    const { data, error } = await query;
    if (error) throw error;

    const rows: CompraProductoRow[] = [];
    for (const alb of data ?? []) {
      const lineas = Array.isArray(alb.lineas) ? (alb.lineas as LineaAlbaranJson[]) : [];
      for (const l of lineas) {
        if (l.productoId !== productoId) continue;
        rows.push({
          albaranId: alb.id as string,
          numero: (alb.numero as string) ?? "",
          numeroProveedor: (alb.numero_proveedor as string | null) ?? null,
          proveedor: (alb.proveedor_nombre as string) ?? "",
          fecha: (alb.fecha as string) ?? "",
          estado: (alb.estado as string) ?? "",
          lineaId: l.id ?? `${alb.id}-${rows.length}`,
          producto: l.producto ?? "",
          cantidad: Number(l.cantidad ?? 0),
          unidad: l.unidad ?? "",
          precioUC: Number(l.precioUC ?? 0),
          impuesto: Number(l.impuesto ?? 0),
          dtoPct: Number(l.dtoPct ?? 0),
          dtoEur: Number(l.dtoEur ?? 0),
          total: Number(l.total ?? 0),
        });
      }
    }

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[albaranes] listComprasPorProducto:", err);
    return { ok: false, data: [] };
  }
}

type CreateAlbaranResult =
  | { ok: true; id: string; numero: string; numeroSecuencial: number }
  | { ok: false; error: string };

export async function createAlbaran(input: {
  pedidoId: string;
  proveedorNombre: string;
  almacen: string;
  documento: string;
  fecha: string;
  dtoPct: number;
  dtoEur: number;
  notas: string;
  creador: string;
  lineas: unknown[];
  /** Si viene del pedido, se copia para que albarán y pedido compartan numeración. */
  numeroSecuencial?: number;
  /** Número que pone el proveedor en su albarán (opcional, lo extrae OCR o se edita manualmente). */
  numeroProveedor?: string | null;
}): Promise<CreateAlbaranResult> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Regla dura: ningún albarán puede guardarse con una línea sin productoId.
    // El productoId es lo que vincula cada línea con su producto (stock, histórico de
    // compras, etc.), así que un albarán sin él sería un dato roto.
    const lineas = Array.isArray(input.lineas) ? input.lineas : [];
    const lineasInvalidas = lineas.filter((l) => {
      const pid = (l as { productoId?: unknown })?.productoId;
      return typeof pid !== "string" || pid.trim() === "";
    });
    if (lineas.length === 0) {
      return { ok: false, error: "El albarán no tiene líneas." };
    }
    if (lineasInvalidas.length > 0) {
      return {
        ok: false,
        error:
          "Hay líneas sin producto asociado. Cada línea debe corresponder a un producto del catálogo antes de confirmar el albarán.",
      };
    }

    const year = new Date(input.fecha || new Date().toISOString()).getFullYear();
    const insertPayload: Record<string, unknown> = {
      empresa_id: empresaId,
      pedido_id: input.pedidoId,
      proveedor_nombre: input.proveedorNombre,
      almacen: input.almacen,
      documento: input.documento,
      fecha: input.fecha,
      estado: "Pendiente",
      dto_pct: input.dtoPct,
      dto_eur: input.dtoEur,
      notas: input.notas,
      creador: input.creador,
      lineas: input.lineas,
      numero_proveedor: input.numeroProveedor ?? null,
    };

    if (typeof input.numeroSecuencial === "number") {
      insertPayload.numero_secuencial = input.numeroSecuencial;
      insertPayload.numero = `ALB-${year}-${String(input.numeroSecuencial).padStart(3, "0")}`;
    } else {
      // Sin pedido de origen: el trigger asigna numero_secuencial; numero se compone luego.
      insertPayload.numero = "";
    }

    const { data, error } = await supabase
      .from("albaranes")
      .insert(insertPayload)
      .select("id, numero, numero_secuencial")
      .single();
    if (error) throw error;

    // Encadenado: el pedido de origen pasa a "Confirmado" (🔒) y queda vinculado al albarán.
    if (input.pedidoId) {
      await supabase
        .from("pedidos")
        .update({ estado: "Confirmado", albaran_id: data.id, updated_at: new Date().toISOString() })
        .eq("id", input.pedidoId);
    }

    // Si el numero quedó vacío (caso huérfano), lo actualizamos con el secuencial asignado.
    if (!data.numero && typeof data.numero_secuencial === "number") {
      const numeroFinal = `ALB-${year}-${String(data.numero_secuencial).padStart(3, "0")}`;
      await supabase.from("albaranes").update({ numero: numeroFinal }).eq("id", data.id);
      return { ok: true, id: data.id as string, numero: numeroFinal, numeroSecuencial: data.numero_secuencial };
    }

    return {
      ok: true,
      id: data.id as string,
      numero: data.numero as string,
      numeroSecuencial: data.numero_secuencial as number,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] createAlbaran:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateAlbaranNumeroProveedor(id: string, numeroProveedor: string | null) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    // Guarda de inmutabilidad: si ya tiene factura (Confirmado) no se edita.
    const { data: alb } = await supabase
      .from("albaranes")
      .select("estado")
      .eq("id", id)
      .maybeSingle();
    if (alb?.estado === "Confirmado") {
      return { ok: false, error: "El albarán tiene factura y no se puede editar." };
    }
    const { error } = await supabase
      .from("albaranes")
      .update({ numero_proveedor: numeroProveedor })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] updateAlbaranNumeroProveedor:", msg);
    return { ok: false, error: msg };
  }
}

const BUCKET_ALBARANES = "logistica-albaranes";

function sanitizeFilenameAlb(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * Sube el archivo del albarán del proveedor a Storage y persiste el documento
 * (con su análisis OCR) en `albaranes.documentos`. Devuelve el documento guardado.
 */
export async function subirDocumentoAlbaran(formData: FormData) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const albaranId = String(formData.get("albaranId") ?? "");
    const file = formData.get("file") as File | null;
    const analisisRaw = String(formData.get("analisis") ?? "");
    const hayAlerta = String(formData.get("hayAlerta") ?? "false") === "true";
    const uploadedBy = String(formData.get("uploadedBy") ?? "");
    if (!albaranId) return { ok: false as const, error: "Falta albaranId" };
    if (!file || file.size === 0) return { ok: false as const, error: "No se recibió ningún archivo" };
    if (file.size > 20 * 1024 * 1024) return { ok: false as const, error: "El archivo supera los 20 MB" };

    const path = `${empresaId}/${albaranId}/${Date.now()}_${sanitizeFilenameAlb(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET_ALBARANES)
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (upErr) return { ok: false as const, error: `No se pudo subir el archivo: ${upErr.message}` };

    let analisis: unknown = null;
    try { analisis = analisisRaw ? JSON.parse(analisisRaw) : null; } catch { analisis = null; }

    const doc = {
      id: `doc-${Date.now()}`,
      fileName: file.name,
      fileUrl: path,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      analisis,
      hayAlerta,
    };

    // Append al array documentos (lee actual y reescribe).
    const { data: alb } = await supabase
      .from("albaranes")
      .select("documentos")
      .eq("id", albaranId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const prev = Array.isArray(alb?.documentos) ? (alb!.documentos as unknown[]) : [];
    const { error: updErr } = await supabase
      .from("albaranes")
      .update({ documentos: [...prev, doc] })
      .eq("id", albaranId)
      .eq("empresa_id", empresaId);
    if (updErr) {
      await supabase.storage.from(BUCKET_ALBARANES).remove([path]);
      return { ok: false as const, error: updErr.message };
    }

    return { ok: true as const, data: doc };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] subirDocumentoAlbaran:", msg);
    return { ok: false as const, error: msg };
  }
}

/** URL firmada para ver/descargar el archivo de un documento de albarán. */
export async function getDocumentoAlbaranSignedUrl(path: string) {
  try {
    const { supabase } = await getContext();
    const signed = await supabase.storage.from(BUCKET_ALBARANES).createSignedUrl(path, 60 * 10);
    if (!signed.data?.signedUrl) return { ok: false as const, error: "No se pudo generar la URL" };
    return { ok: true as const, url: signed.data.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export async function updateAlbaranEstado(id: string, estado: string) {
  try {
    const { supabase, user } = await getContext();

    // Estado anterior para decidir si hay que mover stock al entrar/salir de la zona
    // recepcionada ("Entregado"/"Confirmado"). El stock se aplica al recepcionar (Entregado)
    // y permanece en Confirmado; solo se revierte al volver a "Pendiente".
    const { data: previo } = await supabase
      .from("albaranes")
      .select("estado")
      .eq("id", id)
      .maybeSingle();
    const estadoAnterior = (previo?.estado as string | undefined) ?? null;

    const { error } = await supabase
      .from("albaranes")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    // Movimientos de stock por recepción (PRP-057). Idempotente.
    const recibido = (e: string | null) => e === "Entregado" || e === "Confirmado";
    if (recibido(estado) && !recibido(estadoAnterior)) {
      const res = await aplicarEntradasAlbaran(id, user?.id ?? null);
      if (!res.ok) {
        // Regla de seguridad: no tragarse el error de stock, pero el estado ya cambió.
        return { ok: true, stockAviso: res.error };
      }
    } else if (!recibido(estado) && recibido(estadoAnterior)) {
      // Se deshace la recepción (vuelve a Pendiente) → devolver el stock.
      await revertirEntradasAlbaran(id);
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] updateAlbaranEstado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Borra un albarán. No se puede borrar si ya tiene factura (estado "Confirmado"): primero
 * hay que borrar la factura. Al borrarlo: revierte el stock recepcionado y el pedido de
 * origen retrocede un puesto (Confirmado → Enviado), volviendo a ser editable.
 */
export async function deleteAlbaran(id: string) {
  try {
    const { supabase } = await getContext();

    const { data: alb } = await supabase
      .from("albaranes")
      .select("id, estado, pedido_id, empresa_id")
      .eq("id", id)
      .maybeSingle();
    if (!alb) return { ok: false, error: "Albarán no encontrado" };
    if (alb.estado === "Confirmado") {
      return { ok: false, error: "Este albarán tiene factura. Borra antes la factura." };
    }

    // Devolver el stock recepcionado antes de borrar.
    if (alb.estado === "Entregado") {
      await revertirEntradasAlbaran(id);
    }

    const { error } = await supabase.from("albaranes").delete().eq("id", id);
    if (error) throw error;

    // Retroceso del pedido: vuelve a "Enviado" SOLO si llegó a enviarse por correo
    // (enviado_at); si fue directo a crear albarán, vuelve a "Pendiente". Se desvincula el albarán.
    if (alb.pedido_id) {
      const { data: ped } = await supabase
        .from("pedidos")
        .select("enviado_at")
        .eq("id", alb.pedido_id as string)
        .maybeSingle();
      const estadoDestino = ped?.enviado_at ? "Enviado" : "Pendiente";
      await supabase
        .from("pedidos")
        .update({ estado: estadoDestino, albaran_id: null, updated_at: new Date().toISOString() })
        .eq("id", alb.pedido_id as string);
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] deleteAlbaran:", msg);
    return { ok: false, error: msg };
  }
}
