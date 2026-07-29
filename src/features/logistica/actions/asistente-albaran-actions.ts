"use server";

/**
 * Asistente de albaranes por foto (decisión de Iván, 2026-07-29).
 *
 * Cuando se sube un albarán por foto, la IA (OCR) lee líneas { nombre, cantidad, precio }.
 * Este módulo empareja cada línea leída contra el CATÁLOGO de productos de compra:
 *   - coincide exacto (por nombre o por nombreProveedor) → se liga sola.
 *   - hay parecidos → se proponen candidatos para que la persona ligue.
 *   - no encaja ninguno → se propone crear producto de compra desde el albarán.
 * Además devuelve el precio vigente de cada producto ligado para el indicador de
 * variación de precio (flecha amarilla/roja/verde).
 *
 * El backend del estado "Revisión" (guardar sin sumar stock, validar al confirmar) vive en
 * `albaranes-actions.ts`. Aquí está solo la resolución línea-a-línea.
 */

import { randomUUID } from "crypto";
import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { createProducto } from "@/features/logistica/actions/producto-actions";
import { addPrecioCompra } from "@/features/logistica/actions/precios-compra-actions";
import { updateAlbaranEstado } from "@/features/logistica/actions/albaranes-actions";
import {
  emparejarConCatalogo,
  type ProductoCatalogo,
  type CandidatoMatch,
} from "@/features/logistica/lib/albaranes/emparejar-catalogo";

/** Línea leída por el OCR del albarán. */
export interface LineaLeida {
  /** id temporal de la línea en el cliente (para casar la resolución). */
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number | null;
  iva?: string | null;
  formato?: string | null;
}

export interface SugerenciaCandidato {
  productoId: string;
  nombre: string;
  nombreProveedor: string | null;
  score: number;
  via: CandidatoMatch["via"];
  /** Precio vigente del producto (para el indicador de variación). Null si no tiene. */
  precioVigente: number | null;
}

export interface LineaEmparejada {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number | null;
  /** Ligado automático (score alto). Null si necesita intervención. */
  ligadoAuto: SugerenciaCandidato | null;
  /** Candidatos propuestos por si la persona quiere ligar a uno. */
  candidatos: SugerenciaCandidato[];
}

/** Línea leída por el OCR de un albarán suelto (LineaLeida + datos para el jsonb). */
export interface LineaOcrAlbaran extends LineaLeida {
  unidad: string;
  /** Importe total de la línea tal y como lo imprime el proveedor. */
  importe: number | null;
}

export interface CabeceraOcrAlbaran {
  proveedor: string | null;
  numero: string | null;
  /** YYYY-MM-DD */
  fecha: string | null;
  total: number | null;
}

const OCR_ALBARAN_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    proveedorNombreDetectado: { type: SchemaType.STRING, nullable: true },
    numeroAlbaranDetectado: { type: SchemaType.STRING, nullable: true },
    fechaAlbaranDetectada: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
    totalDetectado: { type: SchemaType.NUMBER, nullable: true },
    lineas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          cantidad: { type: SchemaType.NUMBER },
          unidad: { type: SchemaType.STRING },
          formato: { type: SchemaType.STRING },
          precioUnitario: { type: SchemaType.NUMBER },
          ivaPorcentaje: { type: SchemaType.NUMBER },
          importeLinea: { type: SchemaType.NUMBER },
        },
        required: ["nombre", "cantidad"],
      },
    },
  },
  required: ["lineas"],
};

const OCR_ALBARAN_SYSTEM = `
Eres un extractor de albaranes de proveedores de un restaurante en España.
Tu tarea: leer el documento adjunto (foto o PDF de un albarán de entrega) y devolver un JSON con:
- Cabecera: nombre del proveedor, número de albarán, fecha (YYYY-MM-DD) y total del documento.
- Una lista de líneas de PRODUCTO con: nombre tal y como lo escribe el proveedor, cantidad,
  unidad (kg, L, ud, caja...), formato, precio unitario NETO (con descuento aplicado si lo hay),
  IVA % e importe de la línea.
- NO incluyas como líneas los gastos o servicios (portes, desplazamiento, punto verde) ni las
  líneas de regalo sin importe.
- IVA %: SOLO si el documento imprime un porcentaje de IVA explícito (0, 4, 10 o 21). Muchos
  albaranes (p.ej. Makro) imprimen una columna "Imp" con CÓDIGOS de impuesto (1, 2, 5...):
  eso NO es un porcentaje — en ese caso devuelve null.
Si un dato no se ve, devuélvelo como null. NO inventes (ni sabores, ni formatos). Idioma: español.
`.trim();

interface OcrAlbaranRaw {
  proveedorNombreDetectado?: string | null;
  numeroAlbaranDetectado?: string | null;
  fechaAlbaranDetectada?: string | null;
  totalDetectado?: number | null;
  lineas?: Array<{
    nombre?: string;
    cantidad?: number;
    unidad?: string;
    formato?: string;
    precioUnitario?: number;
    ivaPorcentaje?: number;
    importeLinea?: number;
  }>;
}

/**
 * OCR EXTRACTIVO de un albarán suelto (sin pedido de referencia): lee el documento y
 * devuelve cabecera + líneas, sin comparar contra nada. Es la entrada del asistente
 * (a diferencia de la Edge Function `analizar-albaran`, que es comparativa contra un pedido).
 */
export async function analizarAlbaranFoto(input: {
  base64: string;
  mimeType: string;
}): Promise<
  | { ok: true; cabecera: CabeceraOcrAlbaran; lineas: LineaOcrAlbaran[] }
  | { ok: false; error: string }
> {
  try {
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.base64) return { ok: false, error: "No se recibió el documento" };

    const ocr = await geminiJSON<OcrAlbaranRaw>(
      "Extrae los datos estructurados de este albarán del proveedor.",
      {
        systemInstruction: OCR_ALBARAN_SYSTEM,
        responseSchema: OCR_ALBARAN_SCHEMA,
        temperature: 0.1,
        attachments: [{ mimeType: input.mimeType || "image/jpeg", base64: input.base64 }],
      },
    );

    const raw = ocr.data ?? {};
    const lineas: LineaOcrAlbaran[] = (raw.lineas ?? [])
      .filter((l) => (l.nombre ?? "").trim() !== "")
      .map((l) => ({
        id: randomUUID(),
        nombre: (l.nombre ?? "").trim(),
        cantidad: Number.isFinite(l.cantidad) ? (l.cantidad as number) : 0,
        precioUnitario: Number.isFinite(l.precioUnitario) ? (l.precioUnitario as number) : null,
        iva: Number.isFinite(l.ivaPorcentaje) ? String(l.ivaPorcentaje) : null,
        formato: (l.formato ?? "").trim() || null,
        unidad: (l.unidad ?? "").trim(),
        importe: Number.isFinite(l.importeLinea) ? (l.importeLinea as number) : null,
      }));

    if (lineas.length === 0) {
      return { ok: false, error: "La IA no encontró líneas de producto en el documento. Prueba con una foto más nítida." };
    }

    return {
      ok: true,
      cabecera: {
        proveedor: (raw.proveedorNombreDetectado ?? "").trim() || null,
        numero: (raw.numeroAlbaranDetectado ?? "").trim() || null,
        fecha: (raw.fechaAlbaranDetectada ?? "").trim() || null,
        total: Number.isFinite(raw.totalDetectado) ? (raw.totalDetectado as number) : null,
      },
      lineas,
    };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { ok: false, error: "La IA no está configurada (falta GEMINI_API_KEY)." };
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] analizarAlbaranFoto:", msg);
    return { ok: false, error: msg };
  }
}

/** Devuelve el precio de compra vigente por producto (más reciente, sin fecha_fin). */
async function preciosVigentes(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  productoIds: string[],
  hoy: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (productoIds.length === 0) return map;
  const { data } = await supabase
    .from("producto_precios_compra")
    .select("producto_id, precio, fecha_inicio, created_at")
    .in("producto_id", productoIds)
    .lte("fecha_inicio", hoy)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false });
  for (const row of (data ?? []) as Array<{ producto_id: string; precio: number | string }>) {
    if (!map.has(row.producto_id)) {
      const p = typeof row.precio === "string" ? parseFloat(row.precio) : row.precio;
      if (Number.isFinite(p)) map.set(row.producto_id, p as number);
    }
  }
  return map;
}

/**
 * Empareja las líneas leídas del albarán contra el catálogo de productos de compra.
 * No escribe nada: es de solo lectura, para pintar el asistente.
 */
export async function emparejarLineasAlbaran(
  lineas: LineaLeida[],
): Promise<{ ok: boolean; lineas: LineaEmparejada[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, lineas: [], error: "No autenticado" };

    const { data } = await supabase
      .from("productos")
      .select("id, nombre, nombre_proveedor")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .eq("estado", "Activo");

    const catalogo: ProductoCatalogo[] = ((data ?? []) as Array<{
      id: string;
      nombre: string;
      nombre_proveedor: string | null;
    }>).map((p) => ({ id: p.id, nombre: p.nombre, nombreProveedor: p.nombre_proveedor }));

    // Precio vigente de TODO el catálogo (una sola consulta) para el indicador.
    const hoy = hoyEnZona(await getZonaHorariaEmpresa(supabase, empresaId));
    const vigentes = await preciosVigentes(supabase, catalogo.map((c) => c.id), hoy);

    const toSugerencia = (c: CandidatoMatch): SugerenciaCandidato => ({
      productoId: c.producto.id,
      nombre: c.producto.nombre,
      nombreProveedor: c.producto.nombreProveedor ?? null,
      score: c.score,
      via: c.via,
      precioVigente: vigentes.get(c.producto.id) ?? null,
    });

    const resultado: LineaEmparejada[] = lineas.map((l) => {
      const match = emparejarConCatalogo(l.nombre, catalogo);
      return {
        id: l.id,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        ligadoAuto: match.exacto ? toSugerencia(match.exacto) : null,
        candidatos: match.candidatos.map(toSugerencia),
      };
    });

    return { ok: true, lineas: resultado };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] emparejarLineasAlbaran:", msg);
    return { ok: false, lineas: [], error: msg };
  }
}

/**
 * Crea un producto de compra NUEVO desde una línea del albarán y le carga el precio del
 * propio albarán (lo que pidió Iván: sugerir el precio del albarán). Devuelve el productoId
 * para que el cliente ligue la línea. Guarda `nombreProveedor` con el texto leído para que
 * el próximo albarán de ese proveedor case solo.
 */
export async function crearProductoDesdeAlbaran(input: {
  nombre: string;
  categoria: string;
  proveedor: string;
  iva: string;
  precio: number;
  /** Cómo lo llamó el proveedor en el albarán (texto OCR). */
  nombreProveedor: string;
  formato?: string | null;
  unidad?: string;
}): Promise<{ ok: boolean; productoId?: string; error?: string }> {
  try {
    // Campos obligatorios (los mismos que exige el alta manual de un producto de compra
    // con precio): nombre, categoría, proveedor, IVA y precio.
    if (!input.nombre?.trim()) return { ok: false, error: "El nombre es obligatorio" };
    if (!input.categoria?.trim()) return { ok: false, error: "La categoría es obligatoria" };
    if (!input.proveedor?.trim()) return { ok: false, error: "El proveedor es obligatorio" };
    if (!input.iva?.trim()) return { ok: false, error: "El IVA es obligatorio" };
    if (!Number.isFinite(input.precio) || input.precio < 0) {
      return { ok: false, error: "El precio del albarán es obligatorio" };
    }

    const creado = await createProducto({
      nombre: input.nombre.trim(),
      tipo: "compra",
      categoria: input.categoria.trim(),
      estado: "Activo",
      proveedor: input.proveedor.trim(),
      nombreProveedor: input.nombreProveedor?.trim() || null,
      medida: input.unidad || "Unidades",
      formato: input.formato ?? null,
      // El precio de compra va por el histórico (addPrecioCompra), no aquí.
    });
    if (creado.error || !creado.producto) {
      return { ok: false, error: creado.error ?? "No se pudo crear el producto" };
    }

    const { supabase, empresaId } = await getLogisticaContext();
    const hoy = hoyEnZona(await getZonaHorariaEmpresa(supabase, empresaId));
    const precioRes = await addPrecioCompra({
      productoId: creado.producto.id,
      precio: input.precio,
      iva: input.iva,
      proveedor: input.proveedor.trim(),
      formato: input.formato ?? null,
      fechaInicio: hoy,
    });
    if (!precioRes.ok) {
      // El producto se creó; el precio falló. No es fatal para el flujo (se puede
      // reintentar), pero lo reportamos para que el usuario lo sepa.
      return { ok: true, productoId: creado.producto.id, error: precioRes.error };
    }

    return { ok: true, productoId: creado.producto.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] crearProductoDesdeAlbaran:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Al vincular una línea a un producto EXISTENTE, memoriza el alias: guarda en
 * `productos.nombre_proveedor` el texto que venía en el albarán, para que la próxima vez
 * ese producto case solo. No pisa un alias ya existente salvo que esté vacío.
 */
interface LineaAlbaranJsonb {
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
  /** Texto original del proveedor en el albarán (doble nombre). */
  nombreProveedor?: string;
  ignorada?: boolean;
  formato?: string | null;
}

/**
 * Persiste las resoluciones del asistente sobre un albarán en "Revisión" y, si
 * `confirmar`, registra los precios de compra de las líneas resueltas y transiciona a
 * "Confirmado" (donde `updateAlbaranEstado` valida huérfanas y suma stock — esa lógica
 * NO se duplica aquí).
 *
 * Caso borde: resoluciones parciales + `confirmar:false` = guardar progreso; el albarán
 * se queda en Revisión y otra persona puede continuar después.
 */
export async function resolverAlbaranRevision(
  albaranId: string,
  resoluciones: Record<string, { productoId: string | null; ignorada: boolean }>,
  confirmar: boolean,
): Promise<{ ok: boolean; error?: string; stockAviso?: string; preciosRegistrados?: number }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: alb, error: albErr } = await supabase
      .from("albaranes")
      .select("id, estado, fecha, proveedor_nombre, lineas")
      .eq("id", albaranId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (albErr || !alb) return { ok: false, error: "Albarán no encontrado" };
    if (alb.estado !== "Revisión") {
      return { ok: false, error: `El albarán está en estado "${alb.estado}", no en Revisión.` };
    }

    const lineas = (Array.isArray(alb.lineas) ? alb.lineas : []) as LineaAlbaranJsonb[];

    // 1) Aplicar resoluciones (por id de línea) y recopilar productos a nombrar.
    const idsANombrar = new Set<string>();
    for (const l of lineas) {
      const res = l.id ? resoluciones[l.id] : undefined;
      if (!res) {
        if (l.productoId) idsANombrar.add(l.productoId);
        continue;
      }
      l.ignorada = res.ignorada === true;
      l.productoId = res.productoId ?? "";
      if (l.productoId) idsANombrar.add(l.productoId);
    }

    // 2) Nombre de catálogo para las líneas ligadas (el texto OCR se conserva en
    //    `nombreProveedor`, que es la otra mitad del doble nombre).
    if (idsANombrar.size > 0) {
      const { data: prods } = await supabase
        .from("productos")
        .select("id, nombre")
        .eq("empresa_id", empresaId)
        .in("id", [...idsANombrar]);
      const nombres = new Map(
        ((prods ?? []) as Array<{ id: string; nombre: string }>).map((p) => [p.id, p.nombre]),
      );
      for (const l of lineas) {
        if (l.productoId && nombres.has(l.productoId)) {
          if (!l.nombreProveedor && l.producto && l.producto !== nombres.get(l.productoId)) {
            l.nombreProveedor = l.producto;
          }
          l.producto = nombres.get(l.productoId);
        }
      }
    }

    const { error: upErr } = await supabase
      .from("albaranes")
      .update({ lineas: lineas as unknown as object, updated_at: new Date().toISOString() })
      .eq("id", albaranId)
      .eq("empresa_id", empresaId);
    if (upErr) throw upErr;

    if (!confirmar) return { ok: true, preciosRegistrados: 0 };

    // 3) Registrar precios de compra de las líneas resueltas (idempotente por
    //    producto+proveedor+fecha). Automatiza el histórico que hasta ahora se cargaba a mano.
    const proveedor = ((alb.proveedor_nombre as string) ?? "").trim();
    const fecha = (alb.fecha as string) ?? hoyEnZona(await getZonaHorariaEmpresa(supabase, empresaId));
    const candidatas = lineas.filter(
      (l) => l.ignorada !== true && l.productoId && Number(l.precioUC) > 0,
    );
    let preciosRegistrados = 0;
    if (candidatas.length > 0 && proveedor) {
      const { data: existentes } = await supabase
        .from("producto_precios_compra")
        .select("producto_id")
        .in("producto_id", candidatas.map((l) => l.productoId as string))
        .eq("proveedor", proveedor)
        .eq("fecha_inicio", fecha);
      const yaCargados = new Set(
        ((existentes ?? []) as Array<{ producto_id: string }>).map((e) => e.producto_id),
      );
      for (const l of candidatas) {
        if (yaCargados.has(l.productoId as string)) continue;
        const res = await addPrecioCompra({
          productoId: l.productoId as string,
          precio: Number(l.precioUC),
          // Solo porcentajes de IVA reales: un código de impuesto del proveedor (Makro
          // imprime 1/2/5 en su columna "Imp") no debe acabar registrado como IVA.
          iva: [0, 4, 10, 21].includes(Number(l.impuesto)) ? String(l.impuesto) : undefined,
          proveedor,
          formato: l.formato ?? null,
          fechaInicio: fecha,
        });
        if (res.ok) preciosRegistrados++;
        // Un fallo de precio no aborta la confirmación: el albarán es válido igualmente.
      }
    }

    // 4) Transición Revisión→Confirmado: valida huérfanas y suma stock.
    const trans = await updateAlbaranEstado(albaranId, "Confirmado");
    if (!trans.ok) return { ok: false, error: trans.error, preciosRegistrados };
    return { ok: true, stockAviso: trans.stockAviso, preciosRegistrados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] resolverAlbaranRevision:", msg);
    return { ok: false, error: msg };
  }
}

export async function memorizarAliasProveedor(
  productoId: string,
  nombreEnAlbaran: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const alias = (nombreEnAlbaran ?? "").trim();
    if (!alias) return { ok: true };

    const { data: prod } = await supabase
      .from("productos")
      .select("nombre_proveedor")
      .eq("id", productoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    // Solo rellena si está vacío (un solo nombre de proveedor por producto; no lo pisamos
    // si el usuario ya puso uno a mano).
    if (prod && (prod.nombre_proveedor as string | null)?.trim()) {
      return { ok: true };
    }
    const { error } = await supabase
      .from("productos")
      .update({ nombre_proveedor: alias })
      .eq("id", productoId)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] memorizarAliasProveedor:", msg);
    return { ok: false, error: msg };
  }
}
