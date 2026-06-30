"use server";

/**
 * Server actions del importador de fichas técnicas — PRP-071, Fase 3.
 * previewFichas: parsea el Excel + empareja contra candidatos de la empresa
 * activa, SIN escribir nada en BD. La escritura es de la Fase 4.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { parseFichasBuffer } from "@/features/cocina/services/import-fichas/parser";
import { construirPreview } from "@/features/cocina/services/import-fichas/preview";
import type { Candidato, PreviewResult } from "@/features/cocina/services/import-fichas/types";
import {
  createEscandallo,
  updateEscandallo,
  type EscandalloIngredienteInput,
} from "@/features/cocina/actions/escandallos-actions";

export type PreviewResponse =
  | { ok: true; data: PreviewResult }
  | { ok: false; error: string };

/** Sentence case + colapsa espacios: primera letra mayúscula, resto minúscula. */
function sentenceCase(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Normaliza para emparejar nombres (sin acentos, sin signos, sin espacios extra). */
function normNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * Recibe el Excel como base64 (lo manda el cliente tras leer el File), lo
 * parsea y devuelve la previsualización emparejada contra los productos de
 * compra + elaboraciones de la empresa ACTIVA.
 */
export async function previewFichas(base64: string): Promise<PreviewResponse> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa." };

    // Candidatos = productos de compra + elaboraciones de la empresa.
    const { data: prods, error } = await supabase
      .from("productos")
      .select("id,nombre,tipo,categoria")
      .eq("empresa_id", empresaId)
      .in("tipo", ["compra", "elaboracion"]);
    if (error) throw error;

    const candidatos: Candidato[] = (prods ?? []).map((p) => ({
      id: p.id as string,
      nombre: p.nombre as string,
      tipo: p.tipo as "compra" | "elaboracion",
      categoria: (p.categoria as string | null) ?? null,
    }));

    // Decodificar base64 → bytes y parsear con el módulo de Fase 1.
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const parsed = parseFichasBuffer(bytes);

    const preview = construirPreview(empresaId, parsed, candidatos);
    return { ok: true, data: preview };
  } catch (err) {
    console.error("[import-fichas] previewFichas:", err);
    return { ok: false, error: "No se pudo procesar el Excel." };
  }
}

// ─── Importación (escritura) ───────────────────────────────────────

/** Una línea decidida por el usuario que se va a escribir. */
export interface ImportLineaInput {
  ingrediente: string;
  cantidad: number | null;
  unidad: string;
  /** Producto/elaboración elegido. null si va como "falta" (se omite). */
  productoId: string | null;
  tipo: "compra" | "elaboracion" | null;
  /** true = el usuario lo marcó como "falta" → no se escribe, va al informe. */
  falta: boolean;
}

export interface ImportPlatoInput {
  plato: string;
  categoria: string | null;
  lineas: ImportLineaInput[];
}

export interface ImportPayload {
  platos: ImportPlatoInput[];
}

export interface ImportInforme {
  creados: number;
  actualizados: number;
  fallidos: { plato: string; error: string }[];
  /** Líneas omitidas por marcarse "falta" (productos a dar de alta). */
  faltan: { plato: string; ingrediente: string }[];
  /** Platos que NO se importaron por no existir su producto de venta (regla: escandallo ligado obligatorio). */
  sinProductoVenta: string[];
}

export type ImportResponse =
  | { ok: true; informe: ImportInforme }
  | { ok: false; error: string };

/**
 * Escribe las fichas decididas. Idempotente por (empresa, nombre de plato):
 * si ya existe un escandallo con ese nombre, lo ACTUALIZA; si no, lo CREA.
 * Reutiliza createEscandallo/updateEscandallo (que sincronizan a
 * producto_composicion). NO toca proveedores ni productos de compra.
 */
export async function importarFichas(payload: ImportPayload): Promise<ImportResponse> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No hay empresa activa." };

    // Productos de venta de la empresa: un escandallo de plato DEBE ligarse a uno
    // (regla de integridad). Indexados por nombre normalizado.
    const { data: ventas, error: vErr } = await supabase
      .from("productos")
      .select("id,nombre")
      .eq("empresa_id", empresaId)
      .eq("tipo", "venta");
    if (vErr) throw vErr;
    const ventaPorNombre = new Map<string, { id: string; nombre: string }>();
    for (const v of ventas ?? []) {
      ventaPorNombre.set(normNombre(String(v.nombre)), { id: v.id as string, nombre: String(v.nombre) });
    }

    // Escandallos existentes (idempotencia por producto_id, que es único).
    const { data: existentes, error: exErr } = await supabase
      .from("escandallos")
      .select("id,producto_id")
      .eq("empresa_id", empresaId);
    if (exErr) throw exErr;
    const escPorProducto = new Map<string, string>();
    for (const e of existentes ?? []) {
      if (e.producto_id) escPorProducto.set(e.producto_id as string, e.id as string);
    }

    const informe: ImportInforme = {
      creados: 0,
      actualizados: 0,
      fallidos: [],
      faltan: [],
      sinProductoVenta: [],
    };

    for (const plato of payload.platos) {
      // Regla: el escandallo debe ligarse a un producto de venta existente.
      const venta = ventaPorNombre.get(normNombre(plato.plato));
      if (!venta) {
        informe.sinProductoVenta.push(plato.plato);
        continue; // NO se crea escandallo huérfano.
      }

      const ingredientes: EscandalloIngredienteInput[] = [];
      for (const l of plato.lineas) {
        if (l.falta || !l.productoId) {
          informe.faltan.push({ plato: venta.nombre, ingrediente: l.ingrediente });
          continue;
        }
        ingredientes.push({
          productoId: l.productoId,
          nombre: l.ingrediente,
          cantidad: l.cantidad ?? 0,
          unidad: l.unidad || "ud",
          tipo: l.tipo ?? "compra",
        });
      }

      const input = {
        // Mismo nombre que el producto de venta (manda la carta), sentence case.
        nombre: sentenceCase(venta.nombre),
        categoria: plato.categoria,
        estado: "Activa",
        productoId: venta.id,
        ingredientes,
      };

      const existenteId = escPorProducto.get(venta.id);
      const res = existenteId
        ? await updateEscandallo(existenteId, input)
        : await createEscandallo(input);

      if (!res.ok) {
        informe.fallidos.push({ plato: venta.nombre, error: res.error ?? "error" });
      } else if (existenteId) {
        informe.actualizados++;
      } else {
        informe.creados++;
      }
    }

    return { ok: true, informe };
  } catch (err) {
    console.error("[import-fichas] importarFichas:", err);
    return { ok: false, error: "Falló la importación." };
  }
}
