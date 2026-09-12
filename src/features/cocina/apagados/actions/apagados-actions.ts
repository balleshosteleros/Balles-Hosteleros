"use server";

/**
 * Apagar y encender productos durante el servicio ("se ha acabado").
 *
 * QUÉ ES: el 86 de toda la vida. Cocina marca lo que se ha terminado y deja de
 * venderse al instante, sin llamar a nadie ni escribirlo en una pizarra.
 *
 * DÓNDE SE NOTA: el apagado se guarda en el PRODUCTO, que es lo único que
 * comparten la carta del QR, la tecla del TPV y la comanda del camarero. Así un
 * solo toque vale para los tres y nunca puede pasar que el comensal lo vea
 * agotado y el camarero lo siga cobrando.
 *
 * CUÁNDO VUELVE: solo, pasadas las horas configuradas en Cocina → Comandas
 * (12 por defecto). Un interruptor suelto se queda encendido; un plazo caduca
 * solo, y en horas dura lo mismo se marque a las seis de la tarde o a las
 * cinco de la madrugada.
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { apagadoVigente } from "../lib/caducidad";
import { getHorasApagado } from "../lib/horas-apagado-server";
import { friendlyError } from "@/shared/lib/friendly-errors";

export interface ProductoApagable {
  id: string;
  nombre: string;
  categoria: string;
  apagado: boolean;
  /** Solo se rellena si está apagado: quién y cuándo, para poder preguntar. */
  apagadoPor: string | null;
}

export interface CategoriaApagable {
  nombre: string;
  productos: ProductoApagable[];
}

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CatalogoApagable {
  categorias: CategoriaApagable[];
  /** Horas que dura el apagado en esta empresa, para poder decirlo en el panel. */
  horas: number;
}

/**
 * Lo que hay EN LA CARTA, agrupado por sus categorías, con lo que está apagado
 * ahora mismo.
 *
 * Solo entra lo que el cliente puede pedir: productos de venta activos, con el
 * interruptor «Visible en carta digital» encendido y con su plato en la carta.
 * Fuera queda todo lo demás —consumibles internos, artículos de inventario,
 * marcas sueltas de destilado—: cocina busca aquí con las manos ocupadas y una
 * lista con 600 referencias que no se sirven no se recorre (Iván, 12-09-2026).
 *
 * Las categorías son las de la CARTA, no las del inventario, y en su mismo
 * orden: es la lista que cocina tiene delante en la mesa.
 */
export async function listarProductosApagables(): Promise<Resultado<CatalogoApagable>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const horas = await getHorasApagado(supabase, empresaId);

    const [itemsRes, catsRes] = await Promise.all([
      supabase
        .from("carta_items")
        .select("producto_id, categoria_id, orden")
        .eq("empresa_id", empresaId)
        .eq("visible", true)
        .not("producto_id", "is", null)
        .order("orden", { ascending: true }),
      supabase
        .from("carta_categorias")
        .select("id, nombre, orden")
        .eq("empresa_id", empresaId)
        .eq("visible", true)
        .order("orden", { ascending: true }),
    ]);

    if (itemsRes.error || catsRes.error) {
      console.error("[cocina][apagados][listar]", itemsRes.error?.message ?? catsRes.error?.message);
      return { ok: false, error: "No se pudo cargar la carta." };
    }

    const items = (itemsRes.data ?? []) as Array<{
      producto_id: string;
      categoria_id: string;
      orden: number;
    }>;
    const cats = (catsRes.data ?? []) as Array<{ id: string; nombre: string; orden: number }>;
    if (items.length === 0) return { ok: true, data: { categorias: [], horas } };

    const { data: prodRows, error: prodErr } = await supabase
      .from("productos")
      .select("id, nombre, tipo, estado, visible_carta, agotado_at, agotado_por")
      .eq("empresa_id", empresaId)
      .in("id", Array.from(new Set(items.map((i) => i.producto_id))));

    if (prodErr) {
      console.error("[cocina][apagados][listar/productos]", prodErr.message);
      return { ok: false, error: "No se pudo cargar el catálogo." };
    }

    const productos = new Map<
      string,
      { nombre: string; agotado_at: string | null; agotado_por: string | null }
    >();
    for (const p of (prodRows ?? []) as Array<{
      id: string;
      nombre: string;
      tipo: string | null;
      estado: string | null;
      visible_carta: boolean | null;
      agotado_at: string | null;
      agotado_por: string | null;
    }>) {
      // Un producto de baja no se vende ni encendido, y uno con el interruptor
      // maestro apagado no llega a la carta: ninguno de los dos pinta aquí.
      if (p.tipo !== "venta" || p.estado === "Inactivo" || p.visible_carta === false) continue;
      productos.set(p.id, {
        nombre: p.nombre,
        agotado_at: p.agotado_at,
        agotado_por: p.agotado_por,
      });
    }

    // Nombre de quien apagó cada producto: se resuelve en una sola consulta.
    const apagadores = Array.from(
      new Set(
        Array.from(productos.values())
          .map((p) => p.agotado_por)
          .filter((v): v is string => !!v),
      ),
    );
    const nombres = new Map<string, string>();
    if (apagadores.length > 0) {
      const { data: users } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .in("id", apagadores);
      for (const u of (users ?? []) as Array<{ id: string; nombre: string | null }>) {
        if (u.nombre) nombres.set(u.id, u.nombre);
      }
    }

    const nombreCategoria = new Map(cats.map((c) => [c.id, c.nombre]));
    const porCategoria = new Map<string, ProductoApagable[]>();
    const yaPuesto = new Set<string>();

    for (const it of items) {
      const prod = productos.get(it.producto_id);
      const categoria = nombreCategoria.get(it.categoria_id);
      // Sin categoría visible, el plato no está en la carta que ve el cliente.
      if (!prod || !categoria) continue;
      // Un mismo producto puede figurar en dos apartados; en la lista va una vez.
      if (yaPuesto.has(it.producto_id)) continue;
      yaPuesto.add(it.producto_id);

      const lista = porCategoria.get(categoria) ?? [];
      lista.push({
        id: it.producto_id,
        nombre: prod.nombre,
        categoria,
        apagado: apagadoVigente(prod.agotado_at, horas),
        apagadoPor: prod.agotado_por ? nombres.get(prod.agotado_por) ?? null : null,
      });
      porCategoria.set(categoria, lista);
    }

    const ordenPorNombre = new Map(cats.map((c) => [c.nombre, c.orden]));
    const categorias = Array.from(porCategoria.entries())
      .map(([nombre, productos]) => ({ nombre, productos }))
      // El orden de la CARTA: cocina espera encontrarlas como están en la mesa.
      .sort((a, b) => (ordenPorNombre.get(a.nombre) ?? 0) - (ordenPorNombre.get(b.nombre) ?? 0));

    return { ok: true, data: { categorias, horas } };
  } catch (err) {
    console.error("[cocina][apagados][listar] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarProductosApagables") };
  }
}

/**
 * Guarda de golpe todo lo que se ha marcado y desmarcado en el panel.
 *
 * Va en DOS consultas (una para apagar, otra para encender) y no una por
 * producto: cocina marca cinco o seis cosas seguidas antes de guardar, y con
 * una llamada por toque el panel se quedaba esperando entre pulsaciones.
 */
export async function guardarApagadosProductos(
  cambios: Array<{ id: string; apagado: boolean }>,
): Promise<Resultado<{ guardados: number }>> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    if (cambios.length === 0) return { ok: true, data: { guardados: 0 } };

    const apagar = cambios.filter((c) => c.apagado).map((c) => c.id);
    const encender = cambios.filter((c) => !c.apagado).map((c) => c.id);

    if (apagar.length > 0) {
      const { error } = await supabase
        .from("productos")
        .update({ agotado_por: userId, agotado_at: new Date().toISOString() })
        .in("id", apagar)
        .eq("empresa_id", empresaId);
      if (error) {
        console.error("[cocina][apagados][guardar/apagar]", error.message);
        return { ok: false, error: "No se pudieron apagar los productos." };
      }
    }

    if (encender.length > 0) {
      const { error } = await supabase
        .from("productos")
        .update({ agotado_por: null, agotado_at: null })
        .in("id", encender)
        .eq("empresa_id", empresaId);
      if (error) {
        console.error("[cocina][apagados][guardar/encender]", error.message);
        return { ok: false, error: "No se pudieron encender los productos." };
      }
    }

    revalidatePath("/marketing/carta-digital");
    return { ok: true, data: { guardados: cambios.length } };
  } catch (err) {
    console.error("[cocina][apagados][guardar] fatal:", err);
    return { ok: false, error: friendlyError(err, "guardarApagadosProductos") };
  }
}

/** Apaga o enciende un producto para el servicio de hoy. */
export async function alternarApagadoProducto(
  productoId: string,
  apagar: boolean,
): Promise<Resultado<{ apagado: boolean }>> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { error } = await supabase
      .from("productos")
      .update(
        apagar
          ? { agotado_por: userId, agotado_at: new Date().toISOString() }
          : { agotado_por: null, agotado_at: null },
      )
      .eq("id", productoId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[cocina][apagados][alternar]", error.message);
      return { ok: false, error: "No se pudo cambiar el producto." };
    }

    // La carta pública se sirve sin caché (`force-dynamic`), así que el cambio
    // se ve en el siguiente escaneo del QR. Esto es para el panel de carta.
    revalidatePath("/marketing/carta-digital");
    return { ok: true, data: { apagado: apagar } };
  } catch (err) {
    console.error("[cocina][apagados][alternar] fatal:", err);
    return { ok: false, error: friendlyError(err, "alternarApagadoProducto") };
  }
}
