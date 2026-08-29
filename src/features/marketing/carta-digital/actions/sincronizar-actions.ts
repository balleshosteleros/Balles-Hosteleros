"use server";

/**
 * Sincronización de la carta digital desde Logística → Productos (tipo venta).
 *
 * PRODUCTOS MANDA en precio, nombre base y alérgenos: se refrescan en cada
 * sincronización. Lo editorial de la carta —foto, descripción de venta, orden,
 * destacado, visible— NO se pisa: es trabajo que costó hacer y que no puede
 * perderse porque alguien cambie un precio en Logística.
 *
 * Protocolo MEMORY.md: try/catch + logs en toda escritura.
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  prepararItemsDesdeProductos,
  ordenarCategorias,
  type ProductoVenta,
} from "../services/sincronizar-desde-productos";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export interface ResumenSincronizacion {
  categoriasCreadas: number;
  itemsCreados: number;
  itemsActualizados: number;
  descartados: Array<{ nombre: string; motivo: string }>;
}

/**
 * Vista previa: qué entraría en la carta y qué se queda fuera y por qué.
 * No escribe nada.
 */
export async function previsualizarSincronizacion(): Promise<
  ActionResult<{
    porCategoria: Array<{ categoria: string; platos: number }>;
    total: number;
    descartados: Array<{ nombre: string; motivo: string }>;
  }>
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("productos")
      .select(
        "id, nombre, categoria, precio_venta, carta_nombre, carta_texto, carta_destacado, alergenos, estilo_imagen_url, estado, visible_carta",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", "venta");

    if (error) {
      console.error("[carta][previsualizarSincronizacion]", error.message);
      return { ok: false, error: "No se pudieron leer los productos." };
    }

    const { items, descartados } = prepararItemsDesdeProductos(
      (data ?? []) as ProductoVenta[],
    );

    const cuenta = new Map<string, number>();
    for (const i of items) cuenta.set(i.categoria, (cuenta.get(i.categoria) ?? 0) + 1);

    const porCategoria = ordenarCategorias([...cuenta.keys()]).map((categoria) => ({
      categoria,
      platos: cuenta.get(categoria) ?? 0,
    }));

    return { ok: true, data: { porCategoria, total: items.length, descartados } };
  } catch (err) {
    console.error("[carta][previsualizarSincronizacion] fatal:", err);
    return { ok: false, error: friendlyError(err, "previsualizarSincronizacion") };
  }
}

/**
 * Vuelca los productos de venta a la carta digital.
 *
 * Idempotente: se puede lanzar tantas veces como se quiera. Los items ya
 * existentes se localizan por `producto_id` y solo se refresca de ellos lo que
 * es competencia de Productos.
 */
export async function sincronizarCartaDesdeProductos(): Promise<
  ActionResult<ResumenSincronizacion>
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: productos, error: errProd } = await supabase
      .from("productos")
      .select(
        "id, nombre, categoria, precio_venta, carta_nombre, carta_texto, carta_destacado, alergenos, estilo_imagen_url, estado, visible_carta",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", "venta");

    if (errProd) {
      console.error("[carta][sincronizar] productos:", errProd.message);
      return { ok: false, error: "No se pudieron leer los productos." };
    }

    const { items, categorias, descartados } = prepararItemsDesdeProductos(
      (productos ?? []) as ProductoVenta[],
    );

    if (items.length === 0) {
      return {
        ok: false,
        error:
          "No hay productos marcados como visibles en carta con precio. Enciende «Visible en carta digital» en la ficha de los productos.",
      };
    }

    // ── Categorías ──────────────────────────────────────────────
    const { data: catExistentes, error: errCat } = await supabase
      .from("carta_categorias")
      .select("id, nombre")
      .eq("empresa_id", empresaId);

    if (errCat) {
      console.error("[carta][sincronizar] categorias:", errCat.message);
      return { ok: false, error: "No se pudieron leer las categorías." };
    }

    const mapaCategorias = new Map<string, string>();
    for (const c of (catExistentes ?? []) as Array<{ id: string; nombre: string }>) {
      mapaCategorias.set(c.nombre.toLowerCase(), c.id);
    }

    let categoriasCreadas = 0;
    const ordenadas = ordenarCategorias(categorias);

    for (let i = 0; i < ordenadas.length; i++) {
      const nombre = ordenadas[i];
      const existente = mapaCategorias.get(nombre.toLowerCase());

      if (existente) {
        await supabase.from("carta_categorias").update({ orden: i }).eq("id", existente);
        continue;
      }

      const { data: creada, error: errIns } = await supabase
        .from("carta_categorias")
        .insert({ empresa_id: empresaId, nombre, orden: i, visible: true })
        .select("id")
        .single();

      if (errIns) {
        console.error("[carta][sincronizar] crear categoría:", errIns.message);
        return { ok: false, error: `No se pudo crear la categoría «${nombre}».` };
      }
      mapaCategorias.set(nombre.toLowerCase(), (creada as { id: string }).id);
      categoriasCreadas++;
    }

    // ── Items ───────────────────────────────────────────────────
    const { data: itemsExistentes, error: errItems } = await supabase
      .from("carta_items")
      .select("id, producto_id")
      .eq("empresa_id", empresaId);

    if (errItems) {
      console.error("[carta][sincronizar] items:", errItems.message);
      return { ok: false, error: "No se pudieron leer los platos de la carta." };
    }

    const porProducto = new Map<string, string>();
    for (const it of (itemsExistentes ?? []) as Array<{ id: string; producto_id: string | null }>) {
      if (it.producto_id) porProducto.set(it.producto_id, it.id);
    }

    let itemsCreados = 0;
    let itemsActualizados = 0;

    for (const item of items) {
      const categoriaId = mapaCategorias.get(item.categoria.toLowerCase());
      if (!categoriaId) continue;

      const existenteId = porProducto.get(item.producto_id);

      if (existenteId) {
        // Solo lo que manda Productos. La descripción, la foto, el orden y el
        // destacado son de la carta y se respetan.
        const { error } = await supabase
          .from("carta_items")
          .update({
            nombre: item.nombre,
            precio: item.precio,
            alergenos: item.alergenos,
            categoria_id: categoriaId,
          })
          .eq("id", existenteId)
          .eq("empresa_id", empresaId);

        if (error) {
          console.error("[carta][sincronizar] update item:", error.message);
          return { ok: false, error: `No se pudo actualizar «${item.nombre}».` };
        }
        itemsActualizados++;
        continue;
      }

      const { error } = await supabase.from("carta_items").insert({
        empresa_id: empresaId,
        categoria_id: categoriaId,
        producto_id: item.producto_id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        alergenos: item.alergenos,
        foto_url: item.foto_url,
        orden: item.orden,
        visible: true,
        destacado: item.destacado,
      });

      if (error) {
        console.error("[carta][sincronizar] insert item:", error.message);
        return { ok: false, error: `No se pudo añadir «${item.nombre}».` };
      }
      itemsCreados++;
    }

    revalidatePath("/marketing/carta-digital");

    return {
      ok: true,
      data: { categoriasCreadas, itemsCreados, itemsActualizados, descartados },
    };
  } catch (err) {
    console.error("[carta][sincronizar] fatal:", err);
    return { ok: false, error: friendlyError(err, "sincronizarCartaDesdeProductos") };
  }
}
