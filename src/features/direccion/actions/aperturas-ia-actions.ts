"use server";

/**
 * Server actions IA para Aperturas (PRP-038).
 *
 * Dos endpoints públicos:
 *   - analizarRellenoIA: rellena UN bloque del estudio (pestaña).
 *   - generarAperturaCompletaIA: rellena todos los bloques en una sola llamada.
 *
 * Ambas:
 *   - Validan auth y resuelven empresa_id desde profiles.
 *   - Normalizan attachments: tablas → texto del prompt; binarios → inline a Gemini.
 *   - Validan la respuesta con Zod (rechaza campos extra / tipos inválidos).
 *   - Auditan en ia_uso_log con `feature` correcto (también los errores).
 *   - Devuelven `{ ok, draft|drafts, tokens?, modelo?, error? }`.
 */

import { z } from "zod";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import { createClient } from "@/lib/supabase/server";
import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GEMINI_SCHEMA_POR_BLOQUE,
  Z_POR_BLOQUE,
  GEMINI_SCHEMA_MAESTRO,
  Z_MAESTRO,
} from "@/features/direccion/services/aperturas-ia/schemas";
import {
  PROMPT_POR_BLOQUE,
  promptMaestro,
} from "@/features/direccion/services/aperturas-ia/prompts";
import {
  IA_FEATURE_RELLENO,
  IA_FEATURE_COMPLETA,
  type BloqueIAKey,
  type BloqueIAAnyKey,
  type AnalizarRellenoIAInput,
  type AnalizarRellenoIAResult,
  type GenerarAperturaCompletaIAInput,
  type GenerarAperturaCompletaIAResult,
  type DraftIAEstudio,
} from "@/features/direccion/types/aperturas-ia";

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers comunes                                                      */
/* ──────────────────────────────────────────────────────────────────── */

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

/** Separa payloads del cliente en (a) texto que se concatena al prompt,
 *  y (b) attachments inline para Gemini. */
function dividirPayloads(payloads: PayloadExtraido[] | undefined): {
  textoExtra: string;
  attachments: Array<{ mimeType: string; base64: string }>;
  metaArchivos: Array<{ nombre: string; tamano: number | null; mimeType: string | null }>;
} {
  const textos: string[] = [];
  const attachments: Array<{ mimeType: string; base64: string }> = [];
  const meta: Array<{ nombre: string; tamano: number | null; mimeType: string | null }> = [];

  for (const p of payloads ?? []) {
    if (p.kind === "tabla") {
      const muestra = p.filas.slice(0, 200);
      textos.push(
        [
          `--- Tabla adjunta: ${p.nombreArchivo} ---`,
          `Cabeceras: ${JSON.stringify(p.cabeceras)}`,
          "Filas (JSON):",
          JSON.stringify(muestra, null, 2),
        ].join("\n"),
      );
      meta.push({ nombre: p.nombreArchivo, tamano: null, mimeType: "text/csv" });
    } else {
      attachments.push({ mimeType: p.mimeType, base64: p.base64 });
      textos.push(`--- Documento adjunto: ${p.nombreArchivo} (${p.mimeType}) ---`);
      meta.push({
        nombre: p.nombreArchivo,
        tamano: Math.floor((p.base64.length * 3) / 4),
        mimeType: p.mimeType,
      });
    }
  }

  return {
    textoExtra: textos.length > 0 ? `\n\nDOCUMENTOS:\n${textos.join("\n\n")}` : "",
    attachments,
    metaArchivos: meta,
  };
}

/** Normaliza un hex que la IA pueda devolver en variantes distintas
 *  (#fff, FFAABB, #FFAABBCC con alpha, rgb(...)). Devuelve `#RRGGBB`
 *  en minúscula, o null si no se puede recuperar. */
function normalizarHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase().replace(/\s+/g, "");
  // rgb(r,g,b) o rgba(r,g,b,a)
  const rgb = s.match(/^rgba?\((\d+),(\d+),(\d+)/);
  if (rgb) {
    const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if ([r, g, b].every((n) => n >= 0 && n <= 255)) {
      return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    }
    return null;
  }
  s = s.replace(/^#/, "").replace(/^0x/, "");
  if (/^[0-9a-f]{3}$/.test(s)) {
    s = s.split("").map((c) => c + c).join("");
  } else if (/^[0-9a-f]{4}$/.test(s)) {
    // RGBA abreviado → quita alpha, expande RGB
    s = s.slice(0, 3).split("").map((c) => c + c).join("");
  } else if (/^[0-9a-f]{8}$/.test(s)) {
    // RGBA completo → quita alpha
    s = s.slice(0, 6);
  }
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

/** Saneamientos específicos por bloque antes del Zod parse — recupera
 *  variantes que Gemini suele devolver fuera de spec sin tirar todo el draft. */
function sanitizarPorBloque(bloque: string, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  if (bloque === "marca" && Array.isArray(obj.paleta)) {
    obj.paleta = (obj.paleta as Array<Record<string, unknown>>)
      .map((c) => ({ ...c, hex: normalizarHex(c.hex) }))
      .filter((c) => typeof c.hex === "string");
  }
  return obj;
}

/** Limpia recursivamente los `null` que devuelve Gemini convirtiéndolos
 *  en `undefined`, de forma que los Zod `.optional()` los acepten sin chocar
 *  con `.strip()` y para que el merge ignore esos campos en vez de pisarlos. */
function dropNulls<T>(value: T): T {
  if (value === null) return undefined as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => dropNulls(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = dropNulls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out as unknown as T;
  }
  return value;
}

interface AuditPayload {
  empresaId: string;
  userId: string | null;
  feature: string;
  entidad: string | null;
  modelo: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  bloquesPropuestos: number | null;
  bloquesAceptados: number | null;
  metaArchivos: Array<{ nombre: string; tamano: number | null }>;
  error: string | null;
}

async function audit(payload: AuditPayload): Promise<void> {
  try {
    const supabase = await createClient();
    const archivoNombre =
      payload.metaArchivos.length > 0
        ? payload.metaArchivos.map((m) => m.nombre).join("; ").slice(0, 500)
        : null;
    const archivoTamano =
      payload.metaArchivos.length > 0
        ? payload.metaArchivos.reduce((sum, m) => sum + (m.tamano ?? 0), 0)
        : null;
    await supabase.from("ia_uso_log").insert({
      empresa_id: payload.empresaId,
      user_id: payload.userId,
      feature: payload.feature,
      entidad_detectada: payload.entidad,
      modelo: payload.modelo,
      tokens_input: payload.tokensInput,
      tokens_output: payload.tokensOutput,
      filas_detectadas: payload.bloquesPropuestos,
      filas_importadas: payload.bloquesAceptados,
      archivo_nombre: archivoNombre,
      archivo_tamano_bytes: archivoTamano,
      error: payload.error,
    });
  } catch (err) {
    console.error("[aperturas-ia] audit insert failed:", err);
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof GeminiKeyMissingError) {
    return "Falta configurar GEMINI_API_KEY en el servidor.";
  }
  if (err instanceof z.ZodError) {
    return `La IA devolvió datos con forma inesperada: ${err.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}`;
  }
  return err instanceof Error ? err.message : "Error desconocido al llamar a la IA.";
}

/* ──────────────────────────────────────────────────────────────────── */
/* analizarRellenoIA — UN bloque                                        */
/* ──────────────────────────────────────────────────────────────────── */

export async function analizarRellenoIA(
  input: AnalizarRellenoIAInput,
): Promise<AnalizarRellenoIAResult> {
  const { bloque, prompt: promptUsuario, payloads } = input;
  const { user, empresaId } = await getContext();

  if (!user || !empresaId) {
    return { ok: false, error: "No autenticado." };
  }
  if (!(bloque in GEMINI_SCHEMA_POR_BLOQUE)) {
    return { ok: false, error: `Bloque desconocido: ${bloque}` };
  }
  if (!promptUsuario?.trim() && (!payloads || payloads.length === 0)) {
    return { ok: false, error: "Indica un prompt o adjunta al menos un documento." };
  }

  const { textoExtra, attachments, metaArchivos } = dividirPayloads(payloads);
  const promptFinal = [
    "PROMPT DEL USUARIO:",
    promptUsuario?.trim() || "(sin texto, usa solo los documentos)",
    textoExtra,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await geminiJSON<Record<string, unknown>>(promptFinal, {
      systemInstruction: PROMPT_POR_BLOQUE[bloque],
      responseSchema: GEMINI_SCHEMA_POR_BLOQUE[bloque],
      temperature: 0.4,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const limpio = sanitizarPorBloque(bloque, dropNulls(res.data));
    const parsed = Z_POR_BLOQUE[bloque].parse(limpio);

    const draft: DraftIAEstudio = { [bloque]: parsed } as DraftIAEstudio;

    await audit({
      empresaId,
      userId: user.id,
      feature: IA_FEATURE_RELLENO,
      entidad: bloque,
      modelo: res.modelo,
      tokensInput: res.tokensInput,
      tokensOutput: res.tokensOutput,
      bloquesPropuestos: 1,
      bloquesAceptados: null,
      metaArchivos,
      error: null,
    });

    return {
      ok: true,
      draft,
      tokens: { input: res.tokensInput, output: res.tokensOutput },
      modelo: res.modelo,
    };
  } catch (err) {
    const msg = errorMessage(err);
    await audit({
      empresaId,
      userId: user.id,
      feature: IA_FEATURE_RELLENO,
      entidad: bloque,
      modelo: null,
      tokensInput: null,
      tokensOutput: null,
      bloquesPropuestos: 0,
      bloquesAceptados: 0,
      metaArchivos,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* generarAperturaCompletaIA — todos los bloques                        */
/* ──────────────────────────────────────────────────────────────────── */

const BLOQUES_VALIDABLES: BloqueIAKey[] = [
  "datos",
  "local",
  "marca",
  "gastronomia",
  "ocupacion",
];

export async function generarAperturaCompletaIA(
  input: GenerarAperturaCompletaIAInput,
): Promise<GenerarAperturaCompletaIAResult> {
  const { prompt: promptUsuario, payloads, incluirCifrasFinancieras } = input;
  const { user, empresaId } = await getContext();

  if (!user || !empresaId) {
    return { ok: false, error: "No autenticado." };
  }
  if (!promptUsuario?.trim() && (!payloads || payloads.length === 0)) {
    return { ok: false, error: "Indica un prompt o adjunta al menos un documento." };
  }

  const { textoExtra, attachments, metaArchivos } = dividirPayloads(payloads);
  const promptFinal = [
    "PROMPT DEL USUARIO:",
    promptUsuario?.trim() || "(sin texto, usa solo los documentos)",
    textoExtra,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await geminiJSON<Record<string, unknown>>(promptFinal, {
      systemInstruction: promptMaestro({
        incluirCifrasFinancieras: !!incluirCifrasFinancieras,
      }),
      responseSchema: GEMINI_SCHEMA_MAESTRO,
      temperature: 0.5,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const limpioRaw = dropNulls(res.data) as Record<string, unknown> | null | undefined;
    if (limpioRaw && typeof limpioRaw === "object") {
      for (const b of BLOQUES_VALIDABLES) {
        if (b in limpioRaw) {
          limpioRaw[b] = sanitizarPorBloque(b, limpioRaw[b]);
        }
      }
    }
    const parsed = Z_MAESTRO.parse(limpioRaw);

    const drafts: DraftIAEstudio = {};
    const propuestos: BloqueIAAnyKey[] = [];
    for (const b of BLOQUES_VALIDABLES) {
      const v = (parsed as Record<string, unknown>)[b];
      if (v && Object.keys(v as Record<string, unknown>).length > 0) {
        (drafts as Record<string, unknown>)[b] = v;
        propuestos.push(b);
      }
    }

    if (propuestos.length === 0) {
      const msg = "La IA no pudo proponer ningún bloque con la información dada.";
      await audit({
        empresaId,
        userId: user.id,
        feature: IA_FEATURE_COMPLETA,
        entidad: "apertura_completa",
        modelo: res.modelo,
        tokensInput: res.tokensInput,
        tokensOutput: res.tokensOutput,
        bloquesPropuestos: 0,
        bloquesAceptados: 0,
        metaArchivos,
        error: msg,
      });
      return { ok: false, error: msg };
    }

    await audit({
      empresaId,
      userId: user.id,
      feature: IA_FEATURE_COMPLETA,
      entidad: "apertura_completa",
      modelo: res.modelo,
      tokensInput: res.tokensInput,
      tokensOutput: res.tokensOutput,
      bloquesPropuestos: propuestos.length,
      bloquesAceptados: null,
      metaArchivos,
      error: null,
    });

    return {
      ok: true,
      drafts,
      bloquesPropuestos: propuestos,
      tokens: { input: res.tokensInput, output: res.tokensOutput },
      modelo: res.modelo,
    };
  } catch (err) {
    const msg = errorMessage(err);
    await audit({
      empresaId,
      userId: user.id,
      feature: IA_FEATURE_COMPLETA,
      entidad: "apertura_completa",
      modelo: null,
      tokensInput: null,
      tokensOutput: null,
      bloquesPropuestos: 0,
      bloquesAceptados: 0,
      metaArchivos,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}
