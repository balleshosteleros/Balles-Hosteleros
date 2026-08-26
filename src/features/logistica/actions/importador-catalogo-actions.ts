"use server";

/**
 * Importador de catálogo desde Ágora — acciones de servidor.
 *
 * FILOSOFÍA (encargo de Iván, 25-ago): el importador NO traga y vuelca. PROPONE
 * y el usuario APRUEBA. `previsualizarCatalogoAgora` no escribe nada; sólo
 * `importarCatalogoAgora` lo hace, y sólo con las líneas que la persona aprobó.
 *
 * INCREMENTAL, NUNCA DESTRUCTIVO. El script antiguo `scripts/agora/migrar-catalogo.mjs`
 * BORRA el catálogo entero antes de insertar (`delete().eq('empresa_id', …)`), lo
 * que hoy se llevaría por delante los ~215 productos creados a mano en Bacanal y
 * sus escandallos por CASCADE. Aquí sólo se dan altas y se vinculan existentes.
 */

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { leerCatalogoAgora } from "@/features/logistica/services/agora-catalogo";
import {
  clasificarCatalogo,
  resumirPropuestas,
  normalizarNombre,
  type PropuestaProducto,
  type ProductoNuestro,
  type ResumenPropuestas,
} from "@/features/logistica/lib/importador-catalogo/clasificar";
import {
  importarCatalogoInputSchema,
  type LineaAprobada,
  type ResultadoImportacion,
} from "@/features/logistica/types/importador-catalogo";
import { EMPRESA_WORKPLACE } from "@/features/logistica/services/agora-ventas-ingesta";

// ─── PERMISO ────────────────────────────────────────────────────────────────

/**
 * Manda el permiso LOGÍSTICA (editar) de Ajustes → Roles, no el flag de director
 * (mismo criterio que `producto-actions.ts`: sin bypass de admin).
 */
async function requierePermisoLogistica(): Promise<void> {
  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "LOGÍSTICA")) {
    throw new Error("Sin permisos: necesitas Logística para importar el catálogo");
  }
}

// ─── PREVISUALIZAR (no escribe nada) ────────────────────────────────────────

export interface PrevisualizacionCatalogo {
  ok: boolean;
  error?: string;
  empresa?: "BACANAL" | "HABANA";
  totalEnAgora?: number;
  yaVinculados?: number;
  omitidosOtroLocal?: number;
  propuestas?: PropuestaProducto[];
  resumen?: ResumenPropuestas;
  invalidos?: number;
}

async function leerNuestroCatalogo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  empresaId: string,
): Promise<ProductoNuestro[]> {
  const out: ProductoNuestro[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, tipo, agora_id")
      .eq("empresa_id", empresaId)
      .range(desde, desde + 999);
    if (error) throw error;
    const filas = (data ?? []) as Array<{
      id: string; nombre: string; tipo: string; agora_id: string | null;
    }>;
    for (const f of filas) {
      out.push({ id: f.id, nombre: f.nombre ?? "", tipo: f.tipo, agoraId: f.agora_id });
    }
    if (filas.length < 1000) break;
  }
  return out;
}

/**
 * Lee Ágora y devuelve la propuesta de importación. NO escribe nada.
 */
export async function previsualizarCatalogoAgora(): Promise<PrevisualizacionCatalogo> {
  try {
    await requierePermisoLogistica();
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No tienes empresa asignada." };

    const workplaceId = EMPRESA_WORKPLACE[empresaId];
    const empresa: "BACANAL" | "HABANA" | null =
      workplaceId === 4 ? "BACANAL" : workplaceId === 1 ? "HABANA" : null;
    if (!empresa) {
      return {
        ok: false,
        error:
          "Esta empresa no tiene almacén de Ágora asociado. El importador sólo está preparado " +
          "para Bacanal y Habana.",
      };
    }

    const lectura = await leerCatalogoAgora(supabase, empresaId);
    if (!lectura.ok) return { ok: false, error: lectura.error };

    const nuestros = await leerNuestroCatalogo(supabase, empresaId);
    const { propuestas, omitidosOtroLocal } = clasificarCatalogo({
      productos: lectura.catalogo.productos,
      familiasPorId: lectura.catalogo.familiasPorId,
      empresa,
      warehouseId: lectura.catalogo.warehouseId,
      nuestros,
    });

    return {
      ok: true,
      empresa,
      // Sólo los ACTIVOS: Ágora devuelve también los borrados (616 de 1.255) y
      // enseñarlos en la cabecera daría una cifra que no cuadra con lo que se ve.
      totalEnAgora: lectura.catalogo.productos.filter((p) => !p.DeletionDate).length,
      yaVinculados: nuestros.filter((n) => n.agoraId).length,
      omitidosOtroLocal,
      propuestas,
      resumen: resumirPropuestas(propuestas),
      invalidos: lectura.catalogo.invalidos.length,
    };
  } catch (err) {
    console.error("[importador-catalogo] previsualizar:", err);
    return { ok: false, error: "No se pudo leer el catálogo de Ágora." };
  }
}

// ─── IMPORTAR (sólo lo aprobado) ────────────────────────────────────────────

/** Categoría por defecto de lo que entra del TPV, para que sea localizable después. */
const CATEGORIA_IMPORTADO = "Importado de Ágora";

/**
 * Crea/vincula en nuestro catálogo las líneas que el usuario aprobó.
 *
 * Reglas duras:
 *   · `descartar` y `revisar` NO se importan nunca (revisar = falta decidir).
 *   · `vincular` sólo escribe `agora_id` en un producto que ya existe.
 *   · Una venta cuya pareja de compra existe se enlaza por escandallo 1:1
 *     (regla de bebidas de Iván): la bebida vive dos veces y va enlazada.
 *   · Nada se borra. Si algo falla, esa línea se reporta y las demás siguen.
 */
export async function importarCatalogoAgora(
  input: unknown,
): Promise<{ ok: boolean; error?: string; resultado?: ResultadoImportacion }> {
  try {
    await requierePermisoLogistica();
    const parsed = importarCatalogoInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No tienes empresa asignada." };

    // Se relee Ágora: no nos fiamos de los datos que vienen del navegador para
    // el CONTENIDO. Del cliente sólo se respeta la decisión y el criterio humano
    // (cantidad del enlace y precio puesto a mano).
    const lectura = await leerCatalogoAgora(supabase, empresaId);
    if (!lectura.ok) return { ok: false, error: lectura.error };

    // Sólo los ACTIVOS. Ágora devuelve también los borrados y un producto dado de
    // baja allí no debe poder entrar en nuestro catálogo aunque figure en la lista
    // que el navegador manda (pudo borrarse mientras la persona revisaba).
    const porId = new Map<string, (typeof lectura.catalogo.productos)[number]>();
    for (const p of lectura.catalogo.productos) {
      if (p.DeletionDate) continue;
      porId.set(String(p.Id), p);
    }

    const nuestros = await leerNuestroCatalogo(supabase, empresaId);
    const yaVinculado = new Set(nuestros.filter((n) => n.agoraId).map((n) => String(n.agoraId)));
    const porNombreTipo = new Map<string, ProductoNuestro>();
    for (const n of nuestros) porNombreTipo.set(`${n.tipo}|${normalizarNombre(n.nombre)}`, n);

    const resultado: ResultadoImportacion = {
      creadosVenta: 0, creadosCompra: 0, creadosElaboracion: 0,
      vinculados: 0, enlacesEscandallo: 0, omitidos: 0, errores: [],
    };

    const warehouseId = lectura.catalogo.warehouseId;

    for (const linea of parsed.data.lineas as LineaAprobada[]) {
      const agora = porId.get(linea.agoraId);
      const nombre = agora?.Name?.trim() ?? linea.agoraId;

      // Lo que no se importa.
      if (linea.decision === "descartar" || linea.decision === "revisar") {
        resultado.omitidos++;
        continue;
      }
      if (!agora) {
        resultado.errores.push({
          agoraId: linea.agoraId, nombre,
          motivo: "Ya no existe en Ágora (¿lo han borrado mientras revisabas?)",
        });
        continue;
      }
      if (yaVinculado.has(linea.agoraId)) {
        resultado.omitidos++;
        continue;
      }

      // ── Vincular: el producto ya existe, sólo le falta el agora_id ────────
      if (linea.decision === "vincular") {
        if (!linea.vincularAId) {
          resultado.errores.push({
            agoraId: linea.agoraId, nombre, motivo: "No se indicó con qué producto vincular",
          });
          continue;
        }
        const { error } = await supabase
          .from("productos")
          .update({ agora_id: linea.agoraId })
          .eq("id", linea.vincularAId)
          .eq("empresa_id", empresaId);
        if (error) {
          resultado.errores.push({ agoraId: linea.agoraId, nombre, motivo: error.message });
          continue;
        }
        resultado.vinculados++;
        yaVinculado.add(linea.agoraId);
        continue;
      }

      // ── Crear producto nuevo ──────────────────────────────────────────────
      const tipo = linea.decision; // venta | compra | elaboracion

      // Guarda anti-duplicado: mismo nombre + mismo tipo en la misma empresa.
      // Compra y venta SÍ pueden compartir nombre (es el diseño de las bebidas).
      const clave = `${tipo}|${normalizarNombre(nombre)}`;
      const yaExiste = porNombreTipo.get(clave);
      if (yaExiste) {
        const { error } = await supabase
          .from("productos")
          .update({ agora_id: linea.agoraId })
          .eq("id", yaExiste.id)
          .eq("empresa_id", empresaId);
        if (error) {
          resultado.errores.push({ agoraId: linea.agoraId, nombre, motivo: error.message });
          continue;
        }
        resultado.vinculados++;
        yaVinculado.add(linea.agoraId);
        continue;
      }

      const precioLista = (agora.Prices ?? []).find((x) => x.PriceListId === 1)?.MainPrice ?? null;
      const precioVenta =
        linea.precioVentaManual != null
          ? linea.precioVentaManual
          : typeof precioLista === "number"
            ? precioLista
            : null;
      const costeAlmacen =
        (agora.CostPrices ?? []).find((x) => x.WarehouseId === warehouseId)?.CostPrice ??
        agora.CostPrice ??
        null;

      const fila: Record<string, unknown> = {
        empresa_id: empresaId,
        nombre,
        tipo,
        categoria: CATEGORIA_IMPORTADO,
        estado: "Activo",
        medida: agora.IsSoldByWeight ? "kg" : "ud",
        agora_id: linea.agoraId,
        observaciones: `Importado de Ágora (${new Date().toISOString().slice(0, 10)})`,
      };
      if (tipo === "venta") fila.precio_venta = precioVenta != null ? String(precioVenta) : null;
      if (tipo !== "venta" && costeAlmacen != null) fila.coste = String(costeAlmacen);

      const { data: creado, error } = await supabase
        .from("productos")
        .insert(fila)
        .select("id")
        .single();
      if (error || !creado) {
        resultado.errores.push({
          agoraId: linea.agoraId, nombre, motivo: error?.message ?? "No se pudo crear",
        });
        continue;
      }

      if (tipo === "venta") resultado.creadosVenta++;
      else if (tipo === "compra") resultado.creadosCompra++;
      else resultado.creadosElaboracion++;

      yaVinculado.add(linea.agoraId);
      porNombreTipo.set(clave, {
        id: creado.id as string, nombre, tipo, agoraId: linea.agoraId,
      });

      // ── Regla de bebidas: enlazar la venta con su ficha de compra ─────────
      // Una bebida existe dos veces a propósito (botella que entra por albarán +
      // consumición que se cobra) y van unidas por escandallo 1:1. Sin este
      // enlace, la bebida entra en almacén y no sale nunca.
      if (tipo === "venta" && linea.parejaCompraId) {
        const cantidad = linea.cantidadEnlace ?? 1;
        const { error: errEnlace } = await supabase.from("producto_composicion").insert({
          producto_venta_id: creado.id,
          ingrediente_id: linea.parejaCompraId,
          cantidad,
          merma_pct: 0,
        });
        if (errEnlace) {
          resultado.errores.push({
            agoraId: linea.agoraId,
            nombre,
            motivo: `Producto creado, pero no se pudo enlazar con su ficha de compra: ${errEnlace.message}`,
          });
        } else {
          resultado.enlacesEscandallo++;
        }
      }
    }

    revalidatePath("/logistica/productos");
    revalidatePath("/logistica/importar-catalogo");
    return { ok: true, resultado };
  } catch (err) {
    console.error("[importador-catalogo] importar:", err);
    return { ok: false, error: "No se pudo completar la importación." };
  }
}
