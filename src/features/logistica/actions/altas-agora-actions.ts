"use server";

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireLogisticaEdit } from "@/features/logistica/lib/require-logistica";
import { descontarDiaSiCorte } from "@/features/logistica/services/agora-descuento-dia";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Altas de producto detectadas en Ágora (PRP-080 Fase 5).
 *
 * Cuando el TPV vende algo que Balles no conoce, la venta **no se tira**: se guarda con
 * el identificador de Ágora y queda esperando a que alguien diga a qué producto
 * corresponde. Esto es lo que la enseña y lo que la resuelve.
 *
 * Al resolverla se enlaza **todo el histórico de golpe**, no solo lo que venga a partir
 * de ahora: si un sabor de shisha lleva vendiéndose desde junio, esos 140 consumos se
 * recuperan enteros.
 */

export interface AltaPendiente {
  origen: "venta" | "complemento";
  agoraProductId: number;
  nombre: string;
  veces: number;
  unidades: number;
  desde: string;
  hasta: string;
  /** Producto de Balles con el mismo nombre, si lo hay: la propuesta lista para un clic. */
  coincidencia?: { id: string; nombre: string; tipo: string; tieneAgoraId: boolean };
}

/** Quita acentos, signos y mayúsculas para poder comparar nombres de verdad. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Lo que Ágora ha vendido y Balles no sabe a qué producto corresponde.
 *
 * A cada pendiente se le busca un producto del mismo nombre, porque el caso más
 * frecuente no es que falte el producto: es que **ya existe** y en Ágora está dado de
 * alta dos veces con identificadores distintos. Ahí la respuesta no es crear un
 * duplicado, es vincular.
 */
export async function listAltasPendientes(): Promise<{
  ok: boolean;
  data: AltaPendiente[];
  error?: string;
}> {
  try {
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: true, data: [] };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("agora_ventas_huerfanas", { p_empresa: empresaId });
    if (error) throw error;

    const filas = (data ?? []) as {
      origen: "venta" | "complemento";
      agora_product_id: number;
      nombre: string;
      veces: number;
      unidades: number;
      desde: string;
      hasta: string;
    }[];
    if (filas.length === 0) return { ok: true, data: [] };

    // Candidatos por nombre. Se traen los activos de la empresa y se casan en memoria:
    // son unos cientos y hay que normalizar acentos y signos, que SQL no hace igual.
    const { data: prods } = await admin
      .from("productos")
      .select("id, nombre, tipo, agora_id")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo");

    const porNombre = new Map<string, { id: string; nombre: string; tipo: string; agora_id: string | null }[]>();
    for (const p of prods ?? []) {
      const k = normalizar(p.nombre as string);
      const lista = porNombre.get(k) ?? [];
      lista.push({
        id: p.id as string,
        nombre: p.nombre as string,
        tipo: p.tipo as string,
        agora_id: (p.agora_id as string | null) ?? null,
      });
      porNombre.set(k, lista);
    }

    const data2: AltaPendiente[] = filas.map((f) => {
      const candidatos = porNombre.get(normalizar(f.nombre ?? "")) ?? [];
      // Si el producto existe como venta y como compra, se propone la ficha de VENTA:
      // es la que prefiere la ingesta al resolver, así que es la que hay que enlazar
      // para que mañana case sola.
      const elegido = candidatos.find((c) => c.tipo === "venta") ?? candidatos[0];
      return {
        origen: f.origen,
        agoraProductId: f.agora_product_id,
        nombre: f.nombre,
        veces: Number(f.veces ?? 0),
        unidades: Number(f.unidades ?? 0),
        desde: f.desde,
        hasta: f.hasta,
        coincidencia: elegido
          ? {
              id: elegido.id,
              nombre: elegido.nombre,
              tipo: elegido.tipo,
              tieneAgoraId: elegido.agora_id != null && elegido.agora_id !== "",
            }
          : undefined,
      };
    });

    return { ok: true, data: data2 };
  } catch (err) {
    console.error("[altas-agora] listAltasPendientes:", err);
    return { ok: false, data: [], error: friendlyError(err, "listAltasPendientes") };
  }
}

/**
 * Dice que ese identificador de Ágora es este producto, y recupera todo su histórico.
 *
 * Dos caminos según el producto tenga ya un identificador de Ágora o no:
 *  · **Sin identificador** → se le escribe en su ficha. Es el caso limpio.
 *  · **Con OTRO identificador** → se guarda un alias. En Ágora el mismo artículo puede
 *    estar dado de alta dos veces (como producto y como complemento) y la ficha solo
 *    tiene sitio para uno; sin el alias, mañana volvería a quedar sin reconocer.
 *
 * Después se rehace el descuento de stock de los días afectados. Hoy no hace nada
 * —el descuento está apagado— pero queda puesto para cuando se encienda.
 */
export async function vincularVentasHuerfanas(input: {
  agoraProductId: number;
  productoId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  lineas?: number;
  addins?: number;
  dias?: number;
  diasSinDescontar?: number;
}> {
  try {
    const user = await requireLogisticaEdit("enlazar las ventas de Ágora");
    const { empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();

    const { data: prod } = await admin
      .from("productos")
      .select("id, nombre, agora_id")
      .eq("id", input.productoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!prod) return { ok: false, error: "Ese producto no es de esta empresa." };

    const agoraId = String(input.agoraProductId);
    const yaTiene = (prod.agora_id as string | null) ?? null;

    if (!yaTiene) {
      const { error } = await admin
        .from("productos")
        .update({ agora_id: agoraId })
        .eq("id", input.productoId)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    } else if (yaTiene !== agoraId) {
      const { error } = await admin.from("producto_agora_alias").upsert(
        {
          empresa_id: empresaId,
          agora_product_id: input.agoraProductId,
          producto_id: input.productoId,
          nota: `Segundo identificador de Ágora de "${prod.nombre}" (el primero es ${yaTiene}).`,
          created_by: user.id,
        },
        { onConflict: "empresa_id,agora_product_id" },
      );
      if (error) throw error;
    }

    // Enlazar el histórico entero.
    const { data, error: errRpc } = await admin.rpc("vincular_ventas_huerfanas", {
      p_empresa: empresaId,
      p_agora_id: input.agoraProductId,
      p_producto: input.productoId,
    });
    if (errRpc) throw errRpc;

    const fila = (Array.isArray(data) ? data[0] : data) as
      | { lineas: number; addins: number; dias: string[] | null }
      | undefined;
    const dias = fila?.dias ?? [];

    // Rehacer el descuento de los días tocados. Con el descuento apagado esto no hace
    // nada (la función se planta en cuanto ve que no hay fecha de corte), y con él
    // encendido solo entran los días posteriores a esa fecha. Se limita a 60 para no
    // convertir un clic en un proceso eterno.
    let diasSinDescontar = 0;
    for (const dia of dias.slice(0, 60)) {
      try {
        const r = await descontarDiaSiCorte(admin, empresaId, dia);
        if (!r.aplicado && r.motivo === "almacen_cerrado") diasSinDescontar++;
      } catch (e) {
        console.error(`[altas-agora] re-descuento del día ${dia}:`, e);
      }
    }

    revalidatePath("/logistica/altas-agora");
    revalidatePath("/logistica/stock");
    revalidatePath("/logistica/productos");

    return {
      ok: true,
      lineas: Number(fila?.lineas ?? 0),
      addins: Number(fila?.addins ?? 0),
      dias: dias.length,
      diasSinDescontar,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[altas-agora] vincularVentasHuerfanas:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Productos de la empresa para el buscador de «vincular a uno que ya existe».
 * Incluye compra y venta a propósito: un complemento como el tabaco de la shisha se
 * consume 1:1 contra su producto de compra, y eso es lo correcto.
 */
export async function buscarProductosParaVincular(texto: string): Promise<{
  ok: boolean;
  data: { id: string; nombre: string; tipo: string; agoraId: string | null }[];
}> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: true, data: [] };

    let q = supabase
      .from("productos")
      .select("id, nombre, tipo, agora_id")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .in("tipo", ["venta", "compra", "elaboracion"])
      .order("nombre")
      .limit(40);
    if (texto.trim()) q = q.ilike("nombre", `%${texto.trim()}%`);

    const { data, error } = await q;
    if (error) throw error;

    return {
      ok: true,
      data: (data ?? []).map((p) => ({
        id: p.id as string,
        nombre: p.nombre as string,
        tipo: p.tipo as string,
        agoraId: (p.agora_id as string | null) ?? null,
      })),
    };
  } catch (err) {
    console.error("[altas-agora] buscarProductosParaVincular:", err);
    return { ok: false, data: [] };
  }
}
