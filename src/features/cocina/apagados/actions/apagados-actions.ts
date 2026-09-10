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
 * CUÁNDO VUELVE: solo, al arrancar el día de servicio siguiente (corte a las
 * 06:00: la madrugada es el mismo servicio). Un interruptor suelto se queda
 * encendido; una fecha caduca sola.
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { diaNegocioHoy } from "@/features/sala/lib/dia-negocio";
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

/** Catálogo de venta agrupado por categoría, con lo que está apagado hoy. */
export async function listarProductosApagables(): Promise<Resultado<CategoriaApagable[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const diaServicio = diaNegocioHoy(await getZonaHorariaEmpresa(supabase, empresaId));

    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, categoria, agotado_dia, agotado_por")
      .eq("empresa_id", empresaId)
      .eq("tipo", "venta")
      // Un producto dado de baja no se vende ni encendido: enseñarlo aquí solo
      // alarga la lista que cocina tiene que recorrer con las manos ocupadas.
      .eq("estado", "Activo")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("[cocina][apagados][listar]", error.message);
      return { ok: false, error: "No se pudo cargar el catálogo." };
    }

    const filas = (data ?? []) as Array<{
      id: string;
      nombre: string;
      categoria: string | null;
      agotado_dia: string | null;
      agotado_por: string | null;
    }>;

    // Nombre de quien apagó cada producto: se resuelve en una sola consulta.
    const apagadores = Array.from(
      new Set(filas.filter((f) => f.agotado_por).map((f) => f.agotado_por as string)),
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

    const porCategoria = new Map<string, ProductoApagable[]>();
    for (const f of filas) {
      const categoria = f.categoria?.trim() || "Sin categoría";
      const lista = porCategoria.get(categoria) ?? [];
      lista.push({
        id: f.id,
        nombre: f.nombre,
        categoria,
        apagado: !!f.agotado_dia && f.agotado_dia === diaServicio,
        apagadoPor: f.agotado_por ? nombres.get(f.agotado_por) ?? null : null,
      });
      porCategoria.set(categoria, lista);
    }

    const categorias = Array.from(porCategoria.entries())
      .map(([nombre, productos]) => ({ nombre, productos }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return { ok: true, data: categorias };
  } catch (err) {
    console.error("[cocina][apagados][listar] fatal:", err);
    return { ok: false, error: friendlyError(err, "listarProductosApagables") };
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

    const diaServicio = diaNegocioHoy(await getZonaHorariaEmpresa(supabase, empresaId));

    const { error } = await supabase
      .from("productos")
      .update(
        apagar
          ? { agotado_dia: diaServicio, agotado_por: userId, agotado_at: new Date().toISOString() }
          : { agotado_dia: null, agotado_por: null, agotado_at: null },
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
