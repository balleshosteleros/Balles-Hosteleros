import "server-only";

/**
 * Lectura del catálogo maestro de Ágora (productos, familias y stock).
 *
 * SOLO LECTURA: este servicio nunca escribe en Ágora ni en nuestra BD. Lo que
 * devuelve alimenta la pantalla de propuestas, donde una persona decide.
 *
 * REGLA DE SEGURIDAD ÁGORA (igual que `agora-sync.ts`): ante timeout o error,
 * se detiene y devuelve el error exacto. No reintenta en bucle ni se lo traga.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAgoraCredenciales } from "@/features/logistica/services/agora-credenciales";
import {
  agoraFamiliaSchema,
  agoraProductoSchema,
  agoraStockSchema,
  type AgoraProducto,
} from "@/features/logistica/types/importador-catalogo";

const TIMEOUT_MS = 20_000; // el maestro son ~640 productos; más holgado que el sync de ventas

export interface CatalogoAgora {
  productos: AgoraProducto[];
  familiasPorId: Map<string, string>;
  warehouseId: number;
  /** Registros que Ágora devolvió pero no validaron. Se muestran, no se ocultan. */
  invalidos: Array<{ motivo: string; registro: unknown }>;
}

async function pedirAgora<T>(
  url: string,
  token: string,
  filtro: string,
): Promise<{ ok: true; json: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/api/export-master/?filter=${filtro}`, {
      headers: { "Api-Token": token, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `Ágora respondió HTTP ${res.status} al pedir ${filtro}.` };
    }
    return { ok: true, json: (await res.json()) as T };
  } catch (err) {
    const esTimeout = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: esTimeout
        ? `Ágora no respondió en ${TIMEOUT_MS / 1000}s al pedir ${filtro}.`
        : `No se pudo contactar con Ágora: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Descarga el catálogo maestro de la empresa activa y le inyecta a cada
 * producto el stock de SU almacén.
 */
export async function leerCatalogoAgora(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  empresaId: string,
): Promise<{ ok: true; catalogo: CatalogoAgora } | { ok: false; error: string }> {
  const cred = await getAgoraCredenciales(supabase, empresaId);
  if (!cred) {
    return {
      ok: false,
      error:
        "Esta empresa no tiene Ágora configurado. Actívalo en Ajustes → Ágora antes de importar el catálogo.",
    };
  }

  const invalidos: Array<{ motivo: string; registro: unknown }> = [];

  // ─── Productos ────────────────────────────────────────────────────────────
  const resProd = await pedirAgora<{ Products?: unknown[] }>(cred.url, cred.token, "Products");
  if (!resProd.ok) return { ok: false, error: resProd.error };

  const productos: AgoraProducto[] = [];
  for (const registro of resProd.json.Products ?? []) {
    const parsed = agoraProductoSchema.safeParse(registro);
    if (parsed.success) {
      productos.push(parsed.data as AgoraProducto);
    } else {
      invalidos.push({
        motivo: parsed.error.issues[0]?.message ?? "Registro de producto no válido",
        registro,
      });
    }
  }

  if (productos.length === 0) {
    return {
      ok: false,
      error: "Ágora no devolvió ningún producto válido. Revisa la conexión antes de importar.",
    };
  }

  // ─── Familias (dicen a qué local pertenece cada producto) ─────────────────
  const familiasPorId = new Map<string, string>();
  const resFam = await pedirAgora<{ Families?: unknown[] }>(cred.url, cred.token, "Families");
  if (resFam.ok) {
    for (const registro of resFam.json.Families ?? []) {
      const parsed = agoraFamiliaSchema.safeParse(registro);
      if (parsed.success) familiasPorId.set(String(parsed.data.Id), parsed.data.Name);
    }
  }
  // Sin familias no se puede separar por local: es un dato crítico, no opcional.
  if (familiasPorId.size === 0) {
    return {
      ok: false,
      error:
        "Ágora no devolvió las familias de producto. Sin ellas no se puede saber qué productos " +
        "son de este local y la importación metería productos de la otra empresa.",
    };
  }

  // ─── Stock del almacén de esta empresa ────────────────────────────────────
  const resStock = await pedirAgora<{ Stocks?: unknown[] }>(cred.url, cred.token, "Stocks");
  if (resStock.ok) {
    const stockPorProducto = new Map<string, number>();
    for (const registro of resStock.json.Stocks ?? []) {
      const parsed = agoraStockSchema.safeParse(registro);
      if (!parsed.success) continue;
      if (parsed.data.WarehouseId !== cred.workplaceId) continue;
      const cantidad = parsed.data.Quantity;
      if (typeof cantidad === "number") {
        stockPorProducto.set(String(parsed.data.ProductId), cantidad);
      }
    }
    for (const p of productos) {
      p.__stock = stockPorProducto.get(String(p.Id)) ?? null;
    }
  }

  return {
    ok: true,
    catalogo: { productos, familiasPorId, warehouseId: cred.workplaceId, invalidos },
  };
}
