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

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  ejecutarOcrAlbaran,
  type CabeceraOcrAlbaran,
  type LineaOcrAlbaran,
} from "@/features/logistica/lib/albaranes/ocr-albaran";
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

// Tipos del OCR: viven en el extractor único (lib/albaranes/ocr-albaran.ts).
// OJO: en un fichero "use server" NO se puede re-exportar tipos (Turbopack no
// borra el `export type` y revienta en runtime): los consumidores los importan
// directamente de la lib con `import type`.

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

    const res = await ejecutarOcrAlbaran(input);
    if (!res.ok) return { ok: false, error: res.message };
    return { ok: true, cabecera: res.cabecera, lineas: res.lineas };
  } catch (err) {
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
  /** Proveedor detectado/elegido: activa el tramo de ALIAS por proveedor (Etapa C). */
  proveedorNombre?: string | null,
): Promise<{ ok: boolean; lineas: LineaEmparejada[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, lineas: [], error: "No autenticado" };

    // Tramo 1 (máxima evidencia): alias exacto del MISMO proveedor en la tabla
    // producto_proveedor_aliases. Si casa, liga con score 1 sin pasar por similitud.
    const aliasMap = new Map<string, string>(); // alias_normalizado -> producto_id
    const provTxt = (proveedorNombre ?? "").trim();
    if (provTxt) {
      const { data: provRows } = await supabase
        .from("proveedores")
        .select("id")
        .eq("empresa_id", empresaId)
        .or(`nombre_comercial.ilike.${provTxt},razon_social.ilike.${provTxt}`);
      if ((provRows ?? []).length === 1) {
        const { data: aliases } = await supabase
          .from("producto_proveedor_aliases")
          .select("alias_normalizado, producto_id")
          .eq("empresa_id", empresaId)
          .eq("proveedor_id", provRows![0].id as string);
        for (const a of (aliases ?? []) as Array<{ alias_normalizado: string; producto_id: string }>) {
          aliasMap.set(a.alias_normalizado, a.producto_id);
        }
      }
    }
    const normAlias = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

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

    const porId = new Map(catalogo.map((p) => [p.id, p]));
    const resultado: LineaEmparejada[] = lineas.map((l) => {
      // Tramo 1: alias exacto del proveedor → liga con score 1 (máxima evidencia).
      const aliasProd = aliasMap.get(normAlias(l.nombre));
      if (aliasProd && porId.has(aliasProd)) {
        const p = porId.get(aliasProd)!;
        const sug: SugerenciaCandidato = {
          productoId: p.id,
          nombre: p.nombre,
          nombreProveedor: p.nombreProveedor ?? null,
          score: 1,
          via: "nombre_proveedor",
          precioVigente: vigentes.get(p.id) ?? null,
        };
        return { id: l.id, nombre: l.nombre, cantidad: l.cantidad, precioUnitario: l.precioUnitario, ligadoAuto: sug, candidatos: [sug] };
      }
      // Tramo 2: similitud contra nombre/nombre_proveedor (comportamiento previo).
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
  /** Por qué se dejó fuera del albarán (PRP-074 F4): nada se omite en silencio. */
  motivoIgnorada?: string | null;
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
  resoluciones: Record<
    string,
    { productoId: string | null; ignorada: boolean; motivoIgnorada?: string }
  >,
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
      // El motivo viaja con la línea: dentro de meses se puede saber por qué faltaba.
      l.motivoIgnorada = l.ignorada ? (res.motivoIgnorada ?? null) : null;
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

    // Guardado (parcial o previo a confirmar) con sello de versión (PRP-073 F4):
    // la versión optimista completa con UI de conflicto llega en la Etapa C.
    const { userId } = await getLogisticaContext();
    const { error: upErr } = await supabase
      .from("albaranes")
      .update({
        lineas: lineas as unknown as object,
        revision_guardada_at: new Date().toISOString(),
        revision_guardada_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", albaranId)
      .eq("empresa_id", empresaId);
    if (upErr) throw upErr;

    if (!confirmar) return { ok: true, preciosRegistrados: 0 };

    // 3) Confirmación TRANSACCIONAL (PRP-073 F4): la función de BD valida huérfanas y
    //    duplicados bajo bloqueo, resuelve equivalencias (caja de 24 → 24), registra
    //    precios y stock, y cambia el estado al final. Fallo = rollback, sigue en Revisión.
    const trans = await updateAlbaranEstado(albaranId, "Confirmado");
    if (!trans.ok) return { ok: false, error: trans.error, preciosRegistrados: 0 };
    return { ok: true, preciosRegistrados: trans.preciosRegistrados ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] resolverAlbaranRevision:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Búsqueda PAGINADA sobre TODO el catálogo de compra de la empresa (PRP-073 F5/TASK-223).
 * Los 6 candidatos del matcher son sugerencias iniciales, no el universo: esta action es
 * la base para que "Vincular a existente" pueda encontrar cualquier producto.
 */
export async function buscarProductosCompra(input: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  ok: boolean;
  productos: Array<{ id: string; nombre: string; nombreProveedor: string | null; medida: string | null }>;
  total: number;
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, productos: [], total: 0, error: "No autenticado" };

    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
    const q = (input.query ?? "").trim();

    let query = supabase
      .from("productos")
      .select("id, nombre, nombre_proveedor, medida", { count: "exact" })
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .eq("estado", "Activo")
      .order("nombre");
    if (q) {
      // Busca en el nombre interno Y en el alias legacy del proveedor.
      query = query.or(`nombre.ilike.%${q}%,nombre_proveedor.ilike.%${q}%`);
    }
    const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;

    return {
      ok: true,
      total: count ?? 0,
      productos: ((data ?? []) as Array<{ id: string; nombre: string; nombre_proveedor: string | null; medida: string | null }>).map(
        (p) => ({ id: p.id, nombre: p.nombre, nombreProveedor: p.nombre_proveedor, medida: p.medida }),
      ),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[asistente-albaran] buscarProductosCompra:", msg);
    return { ok: false, productos: [], total: 0, error: msg };
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
