"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  aplicarEntradasAlbaran,
  revertirEntradasAlbaran,
} from "@/features/logistica/services/entradas-stock-por-albaran";
import {
  detectarDuplicadoNegocio,
  type CandidatoDuplicado,
} from "@/features/logistica/lib/albaranes/duplicados";
import { registrarEventoAlbaran } from "@/features/logistica/lib/albaranes/eventos";
import {
  ESTADO_REVISION,
  ESTADOS_COMPRA_CONFIRMADA,
} from "@/features/logistica/data/albaranes";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";

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
  /** Posible duplicado de negocio: la persona debe abrir el existente o registrar la excepción. */
  | { ok: false; duplicado: CandidatoDuplicado; error?: undefined }
  | { ok: false; error: string; duplicado?: undefined };

export async function createAlbaran(input: {
  /** null = albarán suelto (subido por foto, sin pedido de origen). */
  pedidoId: string | null;
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
  /** Importación de origen (flujo por foto, PRP-073): vincula el albarán con su captura. */
  importacionId?: string | null;
  /**
   * Excepción de duplicado (TASK-207): si la detección devolvió un candidato y la
   * persona decide registrar de todos modos, debe venir el candidato + motivo.
   * Se persiste y audita; sin esto, un candidato detectado bloquea la creación.
   */
  duplicadoOverride?: { posibleDuplicadoDe: string; motivo: string } | null;
  /**
   * Estado inicial. Por defecto "Pendiente". Si es "Revisión" (albarán subido por foto con
   * líneas aún sin producto), se relaja la regla del productoId: se permite guardar con
   * líneas huérfanas para que la persona las resuelva en el asistente. "Revisión" NO suma
   * stock (no está en ESTADOS_COMPRA_CONFIRMADA).
   */
  estado?: string;
}): Promise<CreateAlbaranResult> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Sin perfil en cliente (p.ej. móvil, sin AuthProvider): se resuelve aquí por user_id.
    let creador = input.creador?.trim() || "";
    if (!creador && user?.id) {
      const { data: u } = await supabase
        .from("usuarios")
        .select("nombre, apellidos")
        .eq("user_id", user.id)
        .single();
      if (u) creador = `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim();
    }

    const estadoInicial = input.estado === ESTADO_REVISION ? ESTADO_REVISION : "Pendiente";

    // Regla dura: ningún albarán puede guardarse con una línea sin productoId... EXCEPTO en
    // estado "Revisión". El productoId es lo que vincula cada línea con su producto (stock,
    // histórico de compras), así que un albarán CONFIRMADO sin él sería un dato roto; pero
    // uno en Revisión existe precisamente para resolver esas líneas huérfanas.
    const lineas = Array.isArray(input.lineas) ? input.lineas : [];
    if (lineas.length === 0) {
      return { ok: false, error: "El albarán no tiene líneas." };
    }
    if (estadoInicial !== ESTADO_REVISION) {
      const lineasInvalidas = lineas.filter((l) => {
        const pid = (l as { productoId?: unknown })?.productoId;
        return typeof pid !== "string" || pid.trim() === "";
      });
      if (lineasInvalidas.length > 0) {
        return {
          ok: false,
          error:
            "Hay líneas sin producto asociado. Cada línea debe corresponder a un producto del catálogo antes de confirmar el albarán.",
        };
      }
    }

    // Detección de duplicado de NEGOCIO (TASK-207) — solo para albaranes sueltos:
    // los que vienen de pedido ya están protegidos por el unique de pedido_id.
    if (!input.pedidoId) {
      const candidato = await detectarDuplicadoNegocio(supabase, empresaId, {
        proveedorNombre: input.proveedorNombre,
        numeroProveedor: input.numeroProveedor ?? null,
        fecha: input.fecha || null,
      });
      if (candidato && input.duplicadoOverride?.posibleDuplicadoDe !== candidato.id) {
        return { ok: false, duplicado: candidato };
      }
    }

    // Identidad de proveedor (TASK-207): si el nombre corresponde inequívocamente
    // a un proveedor real de la empresa, se guarda proveedor_id además del snapshot.
    let proveedorId: string | null = null;
    {
      const { data: provs } = await supabase
        .from("proveedores")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nombre_comercial", input.proveedorNombre.trim());
      if ((provs ?? []).length === 1) proveedorId = (provs![0].id as string) ?? null;
    }

    const year = new Date(input.fecha || new Date().toISOString()).getFullYear();
    const insertPayload: Record<string, unknown> = {
      empresa_id: empresaId,
      // "" también cae a null: pedido_id es uuid y un string vacío rompe el casteo.
      pedido_id: input.pedidoId || null,
      proveedor_nombre: input.proveedorNombre,
      almacen: input.almacen,
      documento: input.documento,
      fecha: input.fecha,
      estado: estadoInicial,
      dto_pct: input.dtoPct,
      dto_eur: input.dtoEur,
      notas: input.notas,
      creador,
      lineas: input.lineas,
      numero_proveedor: input.numeroProveedor ?? null,
    };

    if (proveedorId) {
      insertPayload.proveedor_id = proveedorId;
    }

    // Solo se incluye si viene: así los flujos sin importación (pedidos, recepción)
    // no dependen de que la columna exista ya en la BD desplegada.
    if (input.importacionId) {
      insertPayload.importacion_id = input.importacionId;
    }

    if (input.duplicadoOverride) {
      insertPayload.posible_duplicado_de = input.duplicadoOverride.posibleDuplicadoDe;
      insertPayload.duplicado_override_motivo = input.duplicadoOverride.motivo;
      insertPayload.duplicado_override_por = user?.id ?? null;
      insertPayload.duplicado_override_at = new Date().toISOString();
    }

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

    // La excepción de duplicado queda auditada en la traza (append-only).
    if (input.duplicadoOverride) {
      await registrarEventoAlbaran(supabase, {
        empresaId,
        albaranId: data.id as string,
        importacionId: input.importacionId ?? null,
        actorId: user?.id ?? null,
        tipo: "duplicado_override",
        payload: {
          posibleDuplicadoDe: input.duplicadoOverride.posibleDuplicadoDe,
          motivo: input.duplicadoOverride.motivo,
        },
      });
    }

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
    if (file.size > MAX_DOCUMENTO_BYTES) return { ok: false as const, error: `El archivo supera los ${MAX_DOCUMENTO_MB} MB` };

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
      .select("estado, lineas, empresa_id, pedido_id, proveedor_nombre, numero_proveedor, fecha, posible_duplicado_de, duplicado_override_at")
      .eq("id", id)
      .maybeSingle();
    const estadoAnterior = (previo?.estado as string | undefined) ?? null;

    // Salir de "Revisión" hacia un estado que suma stock exige que TODAS las líneas tengan
    // ya un producto asociado. Es la aprobación de la que habló Iván: no se confirma (ni se
    // toca stock) hasta que todo está resuelto.
    const recibidoDestino = estado === "Entregado" || estado === "Confirmado";
    if (estadoAnterior === ESTADO_REVISION && recibidoDestino) {
      const lineasPrev = Array.isArray(previo?.lineas)
        ? (previo!.lineas as Array<{ productoId?: unknown; ignorada?: unknown }>)
        : [];
      const huerfanas = lineasPrev.filter((l) => {
        if (l?.ignorada === true) return false; // líneas marcadas "ignorar" no bloquean
        const pid = (l as { productoId?: unknown })?.productoId;
        return typeof pid !== "string" || (pid as string).trim() === "";
      });
      if (huerfanas.length > 0) {
        return {
          ok: false,
          error: `Quedan ${huerfanas.length} línea(s) sin resolver. Vincula, crea o ignora cada producto antes de confirmar.`,
        };
      }
    }

    // Re-check de duplicado de negocio antes de que el albarán toque stock (TASK-208):
    // pudo registrarse otro albarán igual DESPUÉS de crear este. Solo albaranes sueltos
    // (los de pedido los protege el unique de pedido_id) y sin override ya registrado.
    const yaRecibido = estadoAnterior === "Entregado" || estadoAnterior === "Confirmado";
    if (recibidoDestino && !yaRecibido && previo && !previo.pedido_id && !previo.duplicado_override_at) {
      const candidato = await detectarDuplicadoNegocio(supabase, previo.empresa_id as string, {
        proveedorNombre: (previo.proveedor_nombre as string) ?? "",
        numeroProveedor: (previo.numero_proveedor as string | null) ?? null,
        fecha: (previo.fecha as string | null) ?? null,
        excluirId: id,
      });
      if (candidato) {
        return {
          ok: false,
          error: `Posible duplicado del albarán ${candidato.numero} (${candidato.proveedorNombre}, ${candidato.fecha}). Revísalo antes de confirmar; si es otro documento, regístralo con motivo desde el asistente.`,
        };
      }
    }

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
