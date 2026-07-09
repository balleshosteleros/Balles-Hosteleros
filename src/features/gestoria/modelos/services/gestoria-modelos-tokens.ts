import "server-only";

/**
 * Servicios del flujo «email a la gestoría → enlace tokenizado → subida de los
 * modelos de un periodo». Espejo de gestoria-contrato.ts (PRP-068), adaptado a
 * PRP-072: un enlace por periodo (trimestral o anual), la gestoría sube cada
 * modelo por separado y una IA valida que cada PDF corresponde al hueco.
 *
 * Lo usan: el cron de emails (genera el token) y la API pública de subida.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import type { ModeloTipo, ModeloPeriodo, GrupoModelo } from "../types/modelos";
import { MODELO_LABEL, COMBOS_MODELOS_DEFAULT, grupoDeModelo } from "../types/modelos";
import { validarModeloPdfIA } from "./validar-modelo-ia";

const BUCKET_MODELOS = "modelos-aeat-pdf";
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Enlace público que abre la gestoría para subir los modelos del periodo. */
export function urlSubidaModelos(token: string): string {
  return `${getSiteUrl()}/gestoria/modelos/${encodeURIComponent(token)}`;
}

export interface ModelosTokenRow {
  id: string;
  empresa_id: string;
  ejercicio: number;
  grupo: GrupoModelo;
  periodo: ModeloPeriodo;
}

/**
 * Crea un token de subida de modelos para un periodo y devuelve el token en
 * claro (para el correo). Se ejecuta con service role desde el cron.
 */
export async function crearTokenModelosGestoria(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    ejercicio: number;
    grupo: GrupoModelo;
    periodo: ModeloPeriodo;
    plazoDias?: number;
  },
): Promise<{ ok: true; token: string; tokenId: string } | { ok: false; error: string }> {
  try {
    const plazoDias = Math.max(1, Math.min(60, params.plazoDias ?? 30));
    const token = generarToken();
    const tokenHash = hashToken(token);
    const expira = new Date(Date.now() + plazoDias * 86_400_000).toISOString();

    const { data, error } = await admin
      .from("gestoria_modelos_tokens")
      .insert({
        empresa_id: params.empresaId,
        ejercicio: params.ejercicio,
        grupo: params.grupo,
        periodo: params.periodo,
        token_hash: tokenHash,
        expira_en: expira,
        email_enviado_en: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el token" };
    return { ok: true, token, tokenId: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando token de modelos";
    return { ok: false, error: msg };
  }
}

/** Resuelve un token de subida de modelos (multi-uso hasta expirar/completar). */
export async function resolverTokenModelosGestoria(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: ModelosTokenRow }
  | { ok: false; reason: "not_found" | "expired" | "completed" }
> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("gestoria_modelos_tokens")
    .select("id, empresa_id, ejercicio, grupo, periodo, token_hash, expira_en, completado_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (data.completado_en) return { ok: false, reason: "completed" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      ejercicio: data.ejercicio as number,
      grupo: data.grupo as GrupoModelo,
      periodo: data.periodo as ModeloPeriodo,
    },
  };
}

export interface ModeloDelPeriodo {
  modeloId: string | null;
  tipo: ModeloTipo;
  label: string;
  periodo: ModeloPeriodo;
  tienePdf: boolean;
}

/**
 * Devuelve los modelos que la gestoría debe subir en este enlace, con su estado
 * (ya subido o hueco). Para trimestrales = todos los tipos Q del periodo Q; para
 * anuales = todos los tipos ANUAL del ejercicio.
 */
export async function listarModelosDelToken(
  admin: SupabaseClient,
  row: ModelosTokenRow,
): Promise<ModeloDelPeriodo[]> {
  // Tipos esperados según el grupo del token.
  const tiposEsperados = COMBOS_MODELOS_DEFAULT.filter((c) => {
    if (row.grupo === "TRIMESTRALES") return c.periodo === row.periodo && grupoDeModelo(c.tipo) === "TRIMESTRALES";
    return c.periodo === "ANUAL" && grupoDeModelo(c.tipo) === "ANUALES";
  });

  const { data: existentes } = await admin
    .from("modelos_aeat")
    .select("id, tipo, periodo, pdf_url")
    .eq("empresa_id", row.empresa_id)
    .eq("ejercicio", row.ejercicio)
    .eq("periodo", row.periodo);

  const porTipo = new Map<string, { id: string; pdf_url: string | null }>();
  for (const m of (existentes ?? []) as Array<{ id: string; tipo: string; pdf_url: string | null }>) {
    porTipo.set(m.tipo, { id: m.id, pdf_url: m.pdf_url });
  }

  return tiposEsperados.map((c) => {
    const existente = porTipo.get(c.tipo);
    return {
      modeloId: existente?.id ?? null,
      tipo: c.tipo,
      label: MODELO_LABEL[c.tipo],
      periodo: row.periodo,
      tienePdf: Boolean(existente?.pdf_url),
    };
  });
}

/**
 * Procesa la subida de UN modelo por la gestoría: valida el PDF con IA, lo sube
 * al bucket y hace upsert de pdf_url en modelos_aeat. Todo por service_role.
 */
export async function procesarSubidaModelo(
  admin: SupabaseClient,
  row: ModelosTokenRow,
  tipo: ModeloTipo,
  file: File,
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number; iaMotivo?: string }
> {
  if (file.type !== "application/pdf") return { ok: false, error: "El modelo debe ser un PDF", status: 400 };
  if (file.size === 0) return { ok: false, error: "Adjunta el modelo (PDF)", status: 400 };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: "El PDF supera 25 MB", status: 400 };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Datos de la empresa para que la IA verifique NIF/razón social.
  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre, razon_social, nif")
    .eq("id", row.empresa_id)
    .maybeSingle();

  // 1) Validación IA: ¿este PDF es el modelo/empresa/periodo correcto?
  const ia = await validarModeloPdfIA({
    buffer,
    esperado: {
      tipo,
      ejercicio: row.ejercicio,
      periodo: row.periodo,
      nif: (empresa?.nif as string | null) ?? null,
      razonSocial:
        (empresa?.razon_social as string | null) ?? (empresa?.nombre as string | null) ?? null,
    },
  });
  if (!ia.coincide) {
    return {
      ok: false,
      status: 422,
      error: "El documento no coincide con el modelo solicitado",
      iaMotivo: ia.motivo,
    };
  }

  // 2) Asegurar la fila modelos_aeat (crear si no existe) y subir el PDF.
  let modeloId: string;
  const { data: existente } = await admin
    .from("modelos_aeat")
    .select("id, pdf_url")
    .eq("empresa_id", row.empresa_id)
    .eq("tipo", tipo)
    .eq("periodo", row.periodo)
    .eq("ejercicio", row.ejercicio)
    .maybeSingle();

  if (existente) {
    modeloId = existente.id as string;
  } else {
    const { data: creado, error: crearErr } = await admin
      .from("modelos_aeat")
      .insert({
        empresa_id: row.empresa_id,
        tipo,
        periodo: row.periodo,
        ejercicio: row.ejercicio,
        estado: "BORRADOR",
        casillas: {},
      })
      .select("id")
      .single();
    if (crearErr || !creado) {
      return { ok: false, error: crearErr?.message ?? "No se pudo registrar el modelo", status: 500 };
    }
    modeloId = creado.id as string;
  }

  const path = `${row.empresa_id}/${row.ejercicio}/${row.periodo}/${tipo}_${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET_MODELOS)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: `No se pudo guardar el PDF: ${upErr.message}`, status: 500 };

  const { error: updErr } = await admin
    .from("modelos_aeat")
    .update({
      pdf_url: path,
      ia_corrida_en: new Date().toISOString(),
    })
    .eq("id", modeloId);
  if (updErr) {
    // Compensación: borrar el objeto subido.
    await admin.storage.from(BUCKET_MODELOS).remove([path]);
    return { ok: false, error: `No se pudo enlazar el PDF: ${updErr.message}`, status: 500 };
  }

  // Contador de modelos subidos en el token (traza).
  await admin
    .from("gestoria_modelos_tokens")
    .update({
      primer_uso_en: (row as { primer_uso_en?: string }).primer_uso_en ?? new Date().toISOString(),
      modelos_subidos: (await contarSubidos(admin, row)),
    })
    .eq("id", row.id);

  return { ok: true };
}

async function contarSubidos(admin: SupabaseClient, row: ModelosTokenRow): Promise<number> {
  const modelos = await listarModelosDelToken(admin, row);
  return modelos.filter((m) => m.tienePdf).length;
}
