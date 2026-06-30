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

    // Índice de escandallos existentes por nombre normalizado (para idempotencia).
    const { data: existentes, error: exErr } = await supabase
      .from("escandallos")
      .select("id,nombre")
      .eq("empresa_id", empresaId);
    if (exErr) throw exErr;
    const idPorNombre = new Map<string, string>();
    for (const e of existentes ?? []) {
      idPorNombre.set(String(e.nombre).toLowerCase().trim(), e.id as string);
    }

    const informe: ImportInforme = {
      creados: 0,
      actualizados: 0,
      fallidos: [],
      faltan: [],
    };

    for (const plato of payload.platos) {
      const ingredientes: EscandalloIngredienteInput[] = [];
      for (const l of plato.lineas) {
        if (l.falta || !l.productoId) {
          informe.faltan.push({ plato: plato.plato, ingrediente: l.ingrediente });
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
        nombre: plato.plato,
        categoria: plato.categoria,
        estado: "Activa",
        ingredientes,
      };

      const existenteId = idPorNombre.get(plato.plato.toLowerCase().trim());
      const res = existenteId
        ? await updateEscandallo(existenteId, input)
        : await createEscandallo(input);

      if (!res.ok) {
        informe.fallidos.push({ plato: plato.plato, error: res.error ?? "error" });
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
